import type { Stream } from '../types/stream';
import type { ChemistryModel, SpeciesId, Reaction } from '../types/chemistry';
import type { ThermalMode } from '../types/simulation';
import { bisect, rk4Step } from './numerics';
import { ergunDpDtau, type PressureDropConfig } from './pressureDropModel';
import { gasPhaseConc, gasPhaseXaFromCa, cstrGasPhaseXa, pfrGasPhaseODE } from './gasPhaseFactor';

export interface UnitParams {
  tau: number;
  thermalMode: ThermalMode;
  Tc: number;
  kappa_v: number;
  Ca0: number;
  pressureDrop?: boolean;
  Dp?: number;   // particle diameter [m]
  phi?: number;  // void fraction [-]
  P0?: number;   // inlet pressure [Pa]
  u0?: number;   // superficial velocity [m/s]
  gasPhase?: boolean;
  epsilon?: number;  // volumetric expansion factor [-]
}

export interface ProfilePoint {
  cumTau: number;
  C: Record<SpeciesId, number>;
  T: number;
  P?: number;
}

export interface UnitDiagnostics {
  converged: boolean;
  iterations: number;
  warnings: string[];
}

export interface UnitResult {
  outlet: Stream;
  profile: ProfilePoint[];
  diagnostics: UnitDiagnostics;
}

export type UnitModel = (
  inlet: Stream,
  params: UnitParams,
  chemistry: ChemistryModel
) => UnitResult;

function toConc(
  inlet: Stream,
  Ca0: number
): Record<SpeciesId, number> {
  const totalF = Object.values(inlet.F).reduce((a, b) => a + b, 0);
  const volFlow = Ca0 > 1e-12 ? totalF / Ca0 : 1.0;
  const C: Record<SpeciesId, number> = {};
  for (const [s, f] of Object.entries(inlet.F)) {
    C[s] = volFlow > 1e-12 ? f / volFlow : 0;
  }
  return C;
}

function fromConc(
  C: Record<SpeciesId, number>,
  volFlow: number,
  T: number
): Stream {
  const F: Record<SpeciesId, number> = {};
  for (const [s, c] of Object.entries(C)) {
    F[s] = Math.max(0, c * volFlow);
  }
  return { F, T, P: 101325 };
}

function evaluateRates(
  C: Record<SpeciesId, number>,
  T: number,
  reactions: Reaction[]
): number[] {
  return reactions.map((rxn) => rxn.rateLaw(C, T, rxn.kineticParams));
}

function netProductionRate(
  C: Record<SpeciesId, number>,
  T: number,
  reactions: Reaction[],
  speciesIds: SpeciesId[]
): Record<SpeciesId, number> {
  const rates = evaluateRates(C, T, reactions);
  const dC: Record<SpeciesId, number> = {};
  for (const id of speciesIds) dC[id] = 0;
  for (let r = 0; r < reactions.length; r++) {
    const rxn = reactions[r];
    const rate = rates[r];
    for (const [s, stoich] of Object.entries(rxn.stoichiometry)) {
      dC[s] = (dC[s] ?? 0) + stoich * rate;
    }
  }
  return dC;
}

function isothermalCstr(
  C_in: Record<SpeciesId, number>,
  T: number,
  tau: number,
  chemistry: ChemistryModel
): { C_out: Record<SpeciesId, number>; converged: boolean; iterations: number } {
  const { reactions, keyReactantId, species } = chemistry;
  const speciesIds = species.map((s) => s.id);

  if (reactions.length === 1) {
    return isothermalCstrSingle(C_in, T, tau, reactions[0], keyReactantId, speciesIds);
  }
  return isothermalCstrMulti(C_in, T, tau, reactions, speciesIds);
}

function isothermalCstrSingle(
  C_in: Record<SpeciesId, number>,
  T: number,
  tau: number,
  rxn: Reaction,
  keyReactantId: SpeciesId,
  speciesIds: SpeciesId[]
): { C_out: Record<SpeciesId, number>; converged: boolean; iterations: number } {
  const Ca_in = C_in[keyReactantId] ?? 0;
  const stoichKey = rxn.stoichiometry[keyReactantId] ?? -1;
  const scaleFactor = 1 / (-stoichKey);

  const f = (Ca_out: number): number => {
    const extent = (Ca_in - Ca_out) * scaleFactor;
    const C_trial: Record<SpeciesId, number> = {};
    for (const id of speciesIds) {
      C_trial[id] = C_in[id] ?? 0;
    }
    for (const [s, stoich] of Object.entries(rxn.stoichiometry)) {
      C_trial[s] = (C_in[s] ?? 0) + stoich * extent;
    }
    C_trial[keyReactantId] = Ca_out;
    const rate = rxn.rateLaw(C_trial, T, rxn.kineticParams);
    return (Ca_in - Ca_out) / tau - rate;
  };

  const Ca_out = bisect(f, 0, Ca_in, 60);
  const extent = (Ca_in - Ca_out) * scaleFactor;
  const C_out: Record<SpeciesId, number> = {};
  for (const id of speciesIds) C_out[id] = C_in[id] ?? 0;
  for (const [s, stoich] of Object.entries(rxn.stoichiometry)) {
    C_out[s] = (C_in[s] ?? 0) + stoich * extent;
  }
  C_out[keyReactantId] = Ca_out;

  const finalResidual = Math.abs(f(Ca_out));
  return { C_out, converged: finalResidual < 1e-6, iterations: 60 };
}

function isothermalCstrMulti(
  C_in: Record<SpeciesId, number>,
  T: number,
  tau: number,
  reactions: Reaction[],
  speciesIds: SpeciesId[]
): { C_out: Record<SpeciesId, number>; converged: boolean; iterations: number } {
  let C: Record<SpeciesId, number> = { ...C_in };
  for (let iter = 0; iter < 100; iter++) {
    const dC = netProductionRate(C, T, reactions, speciesIds);
    const C_new: Record<SpeciesId, number> = {};
    for (const id of speciesIds) {
      C_new[id] = Math.max(0, (C_in[id] ?? 0) + tau * (dC[id] ?? 0));
    }
    let maxDiff = 0;
    for (const id of speciesIds) {
      const damped = 0.5 * C_new[id] + 0.5 * C[id];
      const diff = Math.abs(damped - C[id]);
      if (diff > maxDiff) maxDiff = diff;
      C[id] = Math.max(0, damped);
    }
    if (maxDiff < 1e-8) {
      return { C_out: C, converged: true, iterations: iter + 1 };
    }
  }
  return { C_out: C, converged: false, iterations: 100 };
}

function nonIsothermalCstr(
  C_in: Record<SpeciesId, number>,
  T_in: number,
  tau: number,
  params: UnitParams,
  chemistry: ChemistryModel
): { C_out: Record<SpeciesId, number>; T_out: number; converged: boolean; iterations: number } {
  const { reactions, thermo } = chemistry;

  const f = (T_out: number): number => {
    const isoResult = isothermalCstr(C_in, T_out, tau, chemistry);
    const C_out = isoResult.C_out;
    const rates = evaluateRates(C_out, T_out, reactions);

    let Q_gen = 0;
    for (let r = 0; r < reactions.length; r++) {
      Q_gen += (-thermo.deltaH(reactions[r].id, T_out)) * rates[r];
    }

    const rhoCp = thermo.rhoCp(C_out, T_out);

    if (params.thermalMode === 'adiabatic') {
      return T_out - T_in - Q_gen * tau / rhoCp;
    }

    return T_out - (rhoCp * T_in + params.kappa_v * tau * params.Tc + Q_gen * tau) /
                  (rhoCp + params.kappa_v * tau);
  };

  const T_out = bisect(f, T_in, T_in + 600, 60);
  const isoResult = isothermalCstr(C_in, T_out, tau, chemistry);

  const finalResidual = Math.abs(f(T_out));
  return {
    C_out: isoResult.C_out,
    T_out,
    converged: finalResidual < 1e-6 && isoResult.converged,
    iterations: isoResult.iterations + 60,
  };
}

function gasPhaseIsothermalCstr(
  C_in: Record<SpeciesId, number>,
  T_in: number,
  tau: number,
  params: UnitParams,
  chemistry: ChemistryModel,
): { C_out: Record<SpeciesId, number>; T_out: number } {
  const Ca0 = params.Ca0;
  const epsilon = params.epsilon ?? 0;
  const k = chemistry.reactions[0]?.kineticParams?.['k'] as number ?? 0;
  const Da = k * tau;
  const Xa = cstrGasPhaseXa(Da, epsilon);
  return {
    C_out: {
      A: gasPhaseConc(Ca0, Xa, epsilon),
      R: Ca0 * Xa / Math.max(1 + epsilon * Xa, 1e-9),
      S: 0,
    },
    T_out: T_in,
  };
}

export const cstrModel: UnitModel = (
  inlet: Stream,
  params: UnitParams,
  chemistry: ChemistryModel
): UnitResult => {
  const C_in = toConc(inlet, params.Ca0);
  // Seed species not present in the inlet stream (e.g. co-reactant B for series-parallel mode)
  if (chemistry.initialConcentrations) {
    for (const [id, c] of Object.entries(chemistry.initialConcentrations)) {
      if (!(id in C_in)) C_in[id] = c;
    }
  }
  const T_in = inlet.T;
  const reactions = chemistry.reactions;

  // Gas-phase isothermal CSTR: use dedicated design equation
  if (params.gasPhase && params.thermalMode === 'isothermal') {
    const { C_out, T_out } = gasPhaseIsothermalCstr(C_in, T_in, params.tau, params, chemistry);
    const totalF = Object.values(inlet.F).reduce((a, b) => a + b, 0);
    const volFlow = params.Ca0 > 1e-12 ? totalF / params.Ca0 : 1.0;
    const outlet = fromConc(C_out, volFlow, T_out);
    const profile: ProfilePoint[] = [
      { cumTau: 0, C: C_in, T: T_in },
      { cumTau: params.tau, C: C_out, T: T_out },
    ];
    return { outlet, profile, diagnostics: { converged: true, iterations: 1, warnings: [] } };
  }

  let C_out: Record<SpeciesId, number>;
  let T_out: number;
  let converged = true;
  let iterations = 0;
  const warnings: string[] = [];

  if (params.thermalMode === 'isothermal' || reactions.length > 1) {
    if (reactions.length > 1 && params.thermalMode !== 'isothermal') {
      warnings.push('Non-isothermal mode ignored for multi-reaction CSTR');
    }
    const result = isothermalCstr(C_in, T_in, params.tau, chemistry);
    C_out = result.C_out;
    T_out = T_in;
    converged = result.converged;
    iterations = result.iterations;
  } else {
    const result = nonIsothermalCstr(C_in, T_in, params.tau, params, chemistry);
    C_out = result.C_out;
    T_out = result.T_out;
    converged = result.converged;
    iterations = result.iterations;
  }

  if (!converged) {
    warnings.push('CSTR did not converge');
  }

  const totalF = Object.values(inlet.F).reduce((a, b) => a + b, 0);
  const volFlow = params.Ca0 > 1e-12 ? totalF / params.Ca0 : 1.0;
  const outlet = fromConc(C_out, volFlow, T_out);

  const profile: ProfilePoint[] = [
    { cumTau: 0, C: C_in, T: T_in },
    { cumTau: params.tau, C: C_out, T: T_out },
  ];

  return {
    outlet,
    profile,
    diagnostics: { converged, iterations, warnings },
  };
};

export const pfrModel: UnitModel = (
  inlet: Stream,
  params: UnitParams,
  chemistry: ChemistryModel
): UnitResult => {
  const C_in = toConc(inlet, params.Ca0);
  // Seed species not present in the inlet stream (e.g. co-reactant B for series-parallel mode)
  if (chemistry.initialConcentrations) {
    for (const [id, c] of Object.entries(chemistry.initialConcentrations)) {
      if (!(id in C_in)) C_in[id] = c;
    }
  }
  const T_in = inlet.T;
  const { reactions, species, thermo } = chemistry;
  const speciesIds = species.map((s) => s.id);
  const nSteps = 200;
  const h = params.tau / nSteps;

  // Gas-phase isothermal PFR: integrate dXa/dτ = k·(1-Xa)/(1+ε·Xa) using RK4
  if (params.gasPhase && params.thermalMode === 'isothermal') {
    const Ca0 = params.Ca0;
    const epsilon = params.epsilon ?? 0;
    const k = chemistry.reactions[0]?.kineticParams?.['k'] as number ?? 0;
    const nStepsGP = 200;
    const hGP = params.tau / nStepsGP;
    const gpProfile: ProfilePoint[] = [];

    const fnXa = (_t: number, y: number[]): number[] => [pfrGasPhaseODE(y[0]!, k, epsilon)];

    let yXa = [0];
    const totalF = Object.values(inlet.F).reduce((a, b) => a + b, 0);
    const volFlow = Ca0 > 1e-12 ? totalF / Ca0 : 1.0;

    gpProfile.push({ cumTau: 0, C: { ...C_in, A: Ca0, R: 0, S: 0 }, T: T_in });

    for (let i = 0; i < nStepsGP; i++) {
      yXa = rk4Step(fnXa, i * hGP, yXa, hGP);
      yXa[0] = Math.max(0, Math.min(0.9999, yXa[0]!));
      const Xa = yXa[0]!;
      const Ca = gasPhaseConc(Ca0, Xa, epsilon);
      const Cr = Ca0 * Xa / Math.max(1 + epsilon * Xa, 1e-9);
      gpProfile.push({ cumTau: (i + 1) * hGP, C: { A: Ca, R: Cr, S: 0 }, T: T_in });
    }

    const Xa_final = yXa[0]!;
    const C_out_gp = {
      A: gasPhaseConc(Ca0, Xa_final, epsilon),
      R: Ca0 * Xa_final / Math.max(1 + epsilon * Xa_final, 1e-9),
      S: 0,
    };
    const outlet_gp = fromConc(C_out_gp, volFlow, T_in);
    return {
      outlet: outlet_gp,
      profile: gpProfile,
      diagnostics: { converged: true, iterations: nStepsGP, warnings: [] },
    };
  }

  const usePD = !!params.pressureDrop;
  const pdCfg: PressureDropConfig | null = usePD
    ? { Dp: params.Dp ?? 0.005, phi: params.phi ?? 0.4, P0: params.P0 ?? 101325, u0: params.u0 ?? 0.01 }
    : null;
  const dPdTau = pdCfg ? ergunDpDtau(pdCfg) : 0;

  // y = [...species concentrations, T]  or  [...species, T, P] when usePD
  const y0: number[] = speciesIds.map((id) => C_in[id] ?? 0);
  y0.push(T_in);
  if (usePD) y0.push(pdCfg!.P0);

  const volFlow = (() => {
    const totalF = Object.values(inlet.F).reduce((a, b) => a + b, 0);
    return params.Ca0 > 1e-12 ? totalF / params.Ca0 : 1.0;
  })();

  const profile: ProfilePoint[] = [
    { cumTau: 0, C: { ...C_in }, T: T_in, ...(usePD ? { P: pdCfg!.P0 } : {}) },
  ];

  const fn = (_t: number, y: number[]): number[] => {
    const C: Record<SpeciesId, number> = {};
    for (let i = 0; i < speciesIds.length; i++) {
      C[speciesIds[i]] = y[i];
    }
    const T = y[speciesIds.length];

    const dC = netProductionRate(C, T, reactions, speciesIds);
    const dydt: number[] = speciesIds.map((id) => dC[id] ?? 0);

    if (params.thermalMode === 'isothermal') {
      dydt.push(0);
    } else {
      const rates = evaluateRates(C, T, reactions);
      let heatGen = 0;
      for (let r = 0; r < reactions.length; r++) {
        heatGen += (-thermo.deltaH(reactions[r].id, T)) * rates[r];
      }
      const rhoCp = thermo.rhoCp(C, T);

      if (params.thermalMode === 'adiabatic') {
        dydt.push(heatGen / rhoCp);
      } else {
        dydt.push((heatGen - params.kappa_v * (T - params.Tc)) / rhoCp);
      }
    }

    if (usePD) dydt.push(dPdTau);

    return dydt;
  };

  const TIdx = speciesIds.length;
  const PIdx = speciesIds.length + 1;

  let y = [...y0];
  for (let i = 0; i < nSteps; i++) {
    y = rk4Step(fn, i * h, y, h);
    for (let j = 0; j < speciesIds.length; j++) {
      y[j] = Math.max(0, y[j]);
    }
    y[TIdx] = Math.max(200, Math.min(1500, y[TIdx]));
    if (usePD) y[PIdx] = Math.max(0, y[PIdx]);

    const C: Record<SpeciesId, number> = {};
    for (let j = 0; j < speciesIds.length; j++) {
      C[speciesIds[j]] = y[j];
    }
    profile.push({
      cumTau: (i + 1) * h,
      C,
      T: y[TIdx],
      ...(usePD ? { P: y[PIdx] } : {}),
    });
  }

  const C_out: Record<SpeciesId, number> = {};
  for (let j = 0; j < speciesIds.length; j++) {
    C_out[speciesIds[j]] = y[j];
  }
  const T_out = y[TIdx];
  const P_final = usePD ? Math.max(0, y[PIdx]) : 101325;
  const outlet = { ...fromConc(C_out, volFlow, T_out), P: P_final };

  return {
    outlet,
    profile,
    diagnostics: { converged: true, iterations: nSteps, warnings: [] },
  };
};

export interface SideFeedParams extends UnitParams {
  FB0_side: number;       // total B feed rate (mol/s)
  CB_feed_side?: number;  // B feed concentration (mol/L), default = Ca0
}

export const sideFeedPFR: (
  inlet: Stream,
  params: SideFeedParams,
  chemistry: ChemistryModel
) => UnitResult = (inlet, params, chemistry) => {
  const { reactions, species, thermo } = chemistry;
  const speciesIds = species.map((s) => s.id);
  const hasBinChem = speciesIds.includes('B');
  // Extend speciesIds with 'B' if not already tracked
  const allIds: SpeciesId[] = hasBinChem ? speciesIds : [...speciesIds, 'B'];

  const nSteps = 200;
  const h = params.tau / nSteps;
  const Q0 = 1.0;  // unit inlet volumetric flow reference
  const CB_feed_side = params.CB_feed_side ?? params.Ca0;
  const FB0_dist = params.FB0_side / params.tau;       // distributed B rate per unit τ
  const dQdtau = FB0_dist / Math.max(CB_feed_side, 1e-12);  // dQ/dτ

  const C_in = toConc(inlet, params.Ca0);
  const T_in = inlet.T;

  // Initial concentrations: B starts at 0 (no B in feed)
  const y0: number[] = allIds.map((id) => id === 'B' ? 0 : (C_in[id] ?? 0));
  y0.push(T_in);  // T at index allIds.length

  const fn = (tau: number, y: number[]): number[] => {
    const Q = Q0 + dQdtau * tau;
    const C: Record<SpeciesId, number> = {};
    for (let i = 0; i < allIds.length; i++) C[allIds[i]] = Math.max(y[i], 0);
    const T = y[allIds.length];

    const dC = netProductionRate(C, T, reactions, speciesIds);

    const dydt: number[] = allIds.map((id) => {
      const source = id === 'B' ? FB0_dist : 0;
      return ((dC[id] ?? 0) * Q0 + source - (C[id] ?? 0) * dQdtau) / Math.max(Q, 1e-12);
    });

    if (params.thermalMode === 'isothermal') {
      dydt.push(0);
    } else {
      const rates = evaluateRates(C, T, reactions);
      let heatGen = 0;
      for (let r = 0; r < reactions.length; r++) {
        heatGen += (-thermo.deltaH(reactions[r].id, T)) * rates[r];
      }
      const rhoCp = thermo.rhoCp(C, T);
      dydt.push(
        params.thermalMode === 'adiabatic'
          ? heatGen / rhoCp
          : (heatGen - params.kappa_v * (T - params.Tc)) / rhoCp
      );
    }

    return dydt;
  };

  const TIdx = allIds.length;
  const profile: ProfilePoint[] = [{ cumTau: 0, C: { ...C_in }, T: T_in }];

  let y = [...y0];
  for (let i = 0; i < nSteps; i++) {
    y = rk4Step(fn, i * h, y, h);
    for (let j = 0; j < allIds.length; j++) y[j] = Math.max(0, y[j]);
    y[TIdx] = Math.max(200, Math.min(1500, y[TIdx]));
    const C: Record<SpeciesId, number> = {};
    for (let j = 0; j < allIds.length; j++) C[allIds[j]] = y[j];
    profile.push({ cumTau: (i + 1) * h, C, T: y[TIdx] });
  }

  const C_out: Record<SpeciesId, number> = {};
  for (let j = 0; j < speciesIds.length; j++) C_out[speciesIds[j]] = y[j];
  const T_out = y[TIdx];
  const volFlow = (() => {
    const totalF = Object.values(inlet.F).reduce((a, b) => a + b, 0);
    return params.Ca0 > 1e-12 ? totalF / params.Ca0 : 1.0;
  })();
  const outlet = fromConc(C_out, volFlow, T_out);

  return { outlet, profile, diagnostics: { converged: true, iterations: nSteps, warnings: [] } };
};

export interface CatalyticPFRParams extends UnitParams {
  W_cat: number;        // catalyst weight (kg)
  rho_bulk?: number;    // bulk density (kg/m³), default 1200
  epsilon_bed?: number; // void fraction, default 0.4
}

export const catalyticPFR: (
  inlet: Stream,
  params: CatalyticPFRParams,
  chemistry: ChemistryModel
) => UnitResult = (inlet, params, chemistry) => {
  const rho_bulk    = params.rho_bulk    ?? 1200;
  const epsilon_bed = params.epsilon_bed ?? 0.4;
  // V_bed = W_cat / (rho_bulk * (1 - epsilon_bed)), τ_equiv = V_bed / Q_ref
  const V_bed   = params.W_cat / (rho_bulk * (1 - epsilon_bed));
  const pfrParams: UnitParams = { ...params, tau: V_bed };
  return pfrModel(inlet, pfrParams, chemistry);
};
