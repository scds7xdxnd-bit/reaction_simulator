import type { Stream, ProcessStream } from '../types/stream';
import type { ChemistryModel, SpeciesId, Reaction } from '../types/chemistry';
import type { ThermalMode } from '../types/simulation';
import { bisect, rk4Step, rk45Step, odeAdaptive, resampleUniform } from './numerics';
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
  // F17: detailed cooling (cooled-detailed mode)
  UA?: number;           // total UA [kJ/(s·K)] for CSTR (pre-multiplied U×A)
  Ua?: number;           // volumetric UA [kJ/(L·s·K)] for PFR
  mdot_c_Cp_c?: number;  // coolant capacity rate ṁ_c·Cp_c [kJ/(s·K)]
  Tc_in?: number;        // coolant inlet temperature [K]
  hx_flow?: 'co-current' | 'counter-current';
}

export interface ProfilePoint {
  cumTau: number;
  C: Record<SpeciesId, number>;
  T: number;
  P?: number;
  Tc?: number;  // coolant temperature [K], populated in cooled-detailed mode
}

export interface UnitDiagnostics {
  converged: boolean;
  iterations: number;
  warnings: string[];
  stiff?: boolean;
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
  return reactions.map((rxn) => {
    const missingReactant = Object.entries(rxn.stoichiometry)
      .some(([id, s]) => s < 0 && (C[id] ?? 0) < 1e-9);
    if (missingReactant) return 0;
    return rxn.rateLaw(C, T, rxn.kineticParams);
  });
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
  let C: Record<SpeciesId, number> = {};
  for (const id of speciesIds) C[id] = C_in[id] ?? 0;
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
  chemistry: ChemistryModel,
  volFlow: number  // [L/s] — needed for cooled-detailed mode to compute reactor volume
): { C_out: Record<SpeciesId, number>; T_out: number; converged: boolean; iterations: number } {
  const { reactions, thermo } = chemistry;

  // For cooled-detailed: compute effective kappa_v from NTU/ε model (jacketed CSTR).
  // NTU = UA / (ṁ_c·Cp_c),  ε = 1 − exp(−NTU)
  // Q̇ = UA·ε·(T − Tc_in)  [kJ/s total]  →  q_vol = Q̇ / V  where V = τ·Q_vol [L]
  // Equivalent to cooled mode with kappa_v_eff = UA·ε / V and Tc = Tc_in.
  let kappa_v: number = params.kappa_v;
  let Tc: number = params.Tc;
  if (params.thermalMode === 'cooled-detailed') {
    // Jacketed CSTR NTU model:
    //   Q̇ = ṁ_c·Cp_c·ε·(T − Tc_in)  where ε = 1 − exp(−UA/(ṁ_c·Cp_c))
    //   Q̇_vol = Q̇ / V  →  kappa_v_eff = ṁ_c·Cp_c·ε / V
    //   Limit: ṁ_c → ∞ → ε → UA/(ṁ_c·Cp_c) → kappa_v_eff → UA/V (constant-Tc)
    const UA = params.UA ?? 1.0;
    const mCp = Math.max(params.mdot_c_Cp_c ?? 4.18, 1e-9);
    const NTU = UA / mCp;
    const eps = 1 - Math.exp(-NTU);
    const V = Math.max(tau * volFlow, 1e-9);
    kappa_v = (mCp * eps) / V;
    Tc = params.Tc_in ?? params.Tc;
  }

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

    return T_out - (rhoCp * T_in + kappa_v * tau * Tc + Q_gen * tau) /
                  (rhoCp + kappa_v * tau);
  };

  // Lower bound: coolant temp (can't cool below Tc) or 200 K floor.
  // Upper bound: T_in + 600 K for exothermic adiabatic worst case.
  const T_lo = Math.max(200, Math.min(Tc - 50, T_in - 300));
  const T_hi = T_in + 600;
  const T_out = bisect(f, T_lo, T_hi, 60);
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

  const totalF = Object.values(inlet.F).reduce((a, b) => a + b, 0);
  const volFlow = params.Ca0 > 1e-12 ? totalF / params.Ca0 : 1.0;

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
    const result = nonIsothermalCstr(C_in, T_in, params.tau, params, chemistry, volFlow);
    C_out = result.C_out;
    T_out = result.T_out;
    converged = result.converged;
    iterations = result.iterations;
  }

  if (!converged) {
    warnings.push('CSTR did not converge');
  }

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

  // Gas-phase isothermal PFR: integrate dXa/dτ = k·(1-Xa)/(1+ε·Xa) with RK45
  if (params.gasPhase && params.thermalMode === 'isothermal') {
    const Ca0 = params.Ca0;
    const epsilon = params.epsilon ?? 0;
    const k = chemistry.reactions[0]?.kineticParams?.['k'] as number ?? 0;
    const totalF = Object.values(inlet.F).reduce((a, b) => a + b, 0);
    const volFlow = Ca0 > 1e-12 ? totalF / Ca0 : 1.0;

    const fnXa = (_t: number, y: number[]): number[] => [pfrGasPhaseODE(y[0]!, k, epsilon)];
    const { tPoints, yPoints, stiff, steps: gpSteps } = odeAdaptive(fnXa, 0, params.tau, [0]);
    const { t: tUnif, y: yUnif } = resampleUniform(tPoints, yPoints, 201);

    const gpProfile: ProfilePoint[] = tUnif.map((cumTau, idx) => {
      const Xa = Math.max(0, Math.min(0.9999, yUnif[idx][0]));
      const Ca = gasPhaseConc(Ca0, Xa, epsilon);
      const Cr = Ca0 * Xa / Math.max(1 + epsilon * Xa, 1e-9);
      return { cumTau, C: { A: Ca, R: Cr, S: 0 }, T: T_in };
    });

    const Xa_final = Math.max(0, Math.min(0.9999, yUnif[yUnif.length - 1][0]));
    const C_out_gp = {
      A: gasPhaseConc(Ca0, Xa_final, epsilon),
      R: Ca0 * Xa_final / Math.max(1 + epsilon * Xa_final, 1e-9),
      S: 0,
    };
    const outlet_gp = fromConc(C_out_gp, volFlow, T_in);
    return {
      outlet: outlet_gp,
      profile: gpProfile,
      diagnostics: {
        converged: true, iterations: gpSteps,
        warnings: stiff ? ['stiff: step-size collapsed — consider implicit solver'] : [],
        stiff,
      },
    };
  }

  const usePD = !!params.pressureDrop;
  const pdCfg: PressureDropConfig | null = usePD
    ? { Dp: params.Dp ?? 0.005, phi: params.phi ?? 0.4, P0: params.P0 ?? 101325, u0: params.u0 ?? 0.01 }
    : null;
  const dPdTau = pdCfg ? ergunDpDtau(pdCfg) : 0;

  const volFlow = (() => {
    const totalF = Object.values(inlet.F).reduce((a, b) => a + b, 0);
    return params.Ca0 > 1e-12 ? totalF / params.Ca0 : 1.0;
  })();

  const isDetailedCooling = params.thermalMode === 'cooled-detailed';

  // State layout:
  //   y[0..n-1]  — species concentrations
  //   y[n]       — process temperature T
  //   y[n+1]     — coolant temperature Tc (only when isDetailedCooling)
  //   y[n+1 or n+2] — pressure P (only when usePD)
  const TIdx  = speciesIds.length;
  const TcIdx = speciesIds.length + 1;
  const PIdx  = speciesIds.length + (isDetailedCooling ? 2 : 1);

  // Detailed cooling parameters
  const Ua_vol   = isDetailedCooling ? (params.Ua ?? 1.0) : 0;
  const mCp_c    = isDetailedCooling ? Math.max(params.mdot_c_Cp_c ?? 4.18, 1e-9) : 1;
  const ccFactor = isDetailedCooling ? (Ua_vol * volFlow) / mCp_c : 0; // [1/s] = dTc gain per (T-Tc)

  // Build initial state vector
  const buildY0 = (Tc0: number): number[] => {
    const y: number[] = speciesIds.map((id) => C_in[id] ?? 0);
    y.push(T_in);
    if (isDetailedCooling) y.push(Tc0);
    if (usePD) y.push(pdCfg!.P0);
    return y;
  };

  // Build ODE (sign = +1 co-current, −1 counter-current for Tc equation)
  const buildFn = (tcSign: number) => (_t: number, y: number[]): number[] => {
    const C: Record<SpeciesId, number> = {};
    for (let i = 0; i < speciesIds.length; i++) {
      C[speciesIds[i]] = Math.max(0, y[i]);
    }
    const T  = y[TIdx];
    const Tc = isDetailedCooling ? y[TcIdx] : (params.Tc_in ?? params.Tc);

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
      } else if (isDetailedCooling) {
        // dT/dτ = (heatGen − Ua·(T−Tc)) / rhoCp
        dydt.push((heatGen - Ua_vol * (T - Tc)) / rhoCp);
      } else {
        dydt.push((heatGen - params.kappa_v * (T - params.Tc)) / rhoCp);
      }
    }

    if (isDetailedCooling) {
      // dTc/dτ = ±(Ua·Q_vol / ṁ_c·Cp_c)·(T−Tc)
      // co-current (+): Tc rises when T>Tc; counter-current (−): Tc falls as τ increases
      dydt.push(tcSign * ccFactor * (y[TIdx] - y[TcIdx]));
    }

    if (usePD) dydt.push(dPdTau);

    return dydt;
  };

  // Co-current: Tc(0) = Tc_in, integrate forward
  // Counter-current: Tc(tau) = Tc_in — BVP; bisect on Tc(0)
  const isCounter = isDetailedCooling && params.hx_flow === 'counter-current';
  const Tc_in_val = params.Tc_in ?? params.Tc;

  let Tc0_init: number;
  let pfrSteps: number;
  let stiff: boolean | undefined;
  let tUnif: number[];
  let yUnif: number[][];

  if (isCounter) {
    // Shooting: find Tc(0) such that Tc(tau) = Tc_in
    // For counter-current, sign = −1 in the Tc ODE.
    const fn_cc = buildFn(-1);
    const shoot = (Tc0: number): number => {
      const { tPoints, yPoints } = odeAdaptive(fn_cc, 0, params.tau, buildY0(Tc0));
      const yLast = yPoints[yPoints.length - 1];
      return yLast[TcIdx] - Tc_in_val;
    };
    // When Tc0 < Tc_in, coolant warms through the reactor (outlet Tc < Tc0 due to −sign ODE → miss low)
    // Bracket: lo = Tc_in (coolant barely enters warm), hi = T_in (upper physical bound)
    const Tc0_solved = bisect(shoot, Tc_in_val, T_in + 200, 50);
    Tc0_init = Tc0_solved;
    const result = odeAdaptive(fn_cc, 0, params.tau, buildY0(Tc0_solved));
    const resampled = resampleUniform(result.tPoints, result.yPoints, 201);
    pfrSteps = result.steps;
    stiff = result.stiff;
    tUnif  = resampled.t;
    yUnif  = resampled.y;
  } else {
    Tc0_init = Tc_in_val;
    const fn_co = buildFn(+1);
    const result = odeAdaptive(fn_co, 0, params.tau, buildY0(Tc0_init));
    const resampled = resampleUniform(result.tPoints, result.yPoints, 201);
    pfrSteps = result.steps;
    stiff = result.stiff;
    tUnif  = resampled.t;
    yUnif  = resampled.y;
  }

  const profile: ProfilePoint[] = tUnif.map((cumTau, idx) => {
    const yi = yUnif[idx];
    const C: Record<SpeciesId, number> = {};
    for (let j = 0; j < speciesIds.length; j++) C[speciesIds[j]] = Math.max(0, yi[j]);
    return {
      cumTau,
      C,
      T: Math.max(200, Math.min(1500, yi[TIdx])),
      ...(isDetailedCooling ? { Tc: Math.max(200, Math.min(1500, yi[TcIdx])) } : {}),
      ...(usePD ? { P: Math.max(0, yi[PIdx]) } : {}),
    };
  });

  const yFinal = yUnif[yUnif.length - 1];
  const C_out: Record<SpeciesId, number> = {};
  for (let j = 0; j < speciesIds.length; j++) C_out[speciesIds[j]] = Math.max(0, yFinal[j]);
  const T_out = Math.max(200, Math.min(1500, yFinal[TIdx]));
  const P_final = usePD ? Math.max(0, yFinal[PIdx]) : 101325;
  const outlet = { ...fromConc(C_out, volFlow, T_out), P: P_final };

  return {
    outlet,
    profile,
    diagnostics: {
      converged: true, iterations: pfrSteps,
      warnings: stiff ? ['stiff: step-size collapsed — consider implicit solver'] : [],
      stiff,
    },
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

  const { tPoints, yPoints, stiff: sfStiff, steps: sfSteps } = odeAdaptive(fn, 0, params.tau, y0);
  const { t: tUnif, y: yUnif } = resampleUniform(tPoints, yPoints, 201);

  const profile: ProfilePoint[] = tUnif.map((cumTau, idx) => {
    const yi = yUnif[idx];
    const C: Record<SpeciesId, number> = {};
    for (let j = 0; j < allIds.length; j++) C[allIds[j]] = Math.max(0, yi[j]);
    return { cumTau, C, T: Math.max(200, Math.min(1500, yi[TIdx])) };
  });

  const yFinal = yUnif[yUnif.length - 1];
  const C_out: Record<SpeciesId, number> = {};
  for (let j = 0; j < speciesIds.length; j++) C_out[speciesIds[j]] = Math.max(0, yFinal[j]);
  const T_out = Math.max(200, Math.min(1500, yFinal[TIdx]));
  const volFlow = (() => {
    const totalF = Object.values(inlet.F).reduce((a, b) => a + b, 0);
    return params.Ca0 > 1e-12 ? totalF / params.Ca0 : 1.0;
  })();
  const outlet = fromConc(C_out, volFlow, T_out);

  return {
    outlet, profile,
    diagnostics: {
      converged: true, iterations: sfSteps,
      warnings: sfStiff ? ['stiff: step-size collapsed — consider implicit solver'] : [],
      stiff: sfStiff,
    },
  };
};

export interface CatalyticPFRParams extends UnitParams {
  W_cat: number;        // catalyst weight (kg)
  rho_bulk?: number;    // bulk density (kg/m³), default 1200
  epsilon_bed?: number; // void fraction, default 0.4
  eta_eff?: number;     // F19.3: internal effectiveness factor η ∈ (0,1]; default 1 (no diffusion limit)
}

export const catalyticPFR: (
  inlet: Stream,
  params: CatalyticPFRParams,
  chemistry: ChemistryModel
) => UnitResult = (inlet, params, chemistry) => {
  const rho_bulk    = params.rho_bulk    ?? 1200;
  const epsilon_bed = params.epsilon_bed ?? 0.4;
  const eta         = Math.max(0.001, Math.min(1, params.eta_eff ?? 1));

  // V_bed = W_cat / (rho_bulk * (1 - epsilon_bed)), τ_equiv = V_bed / Q_ref
  const V_bed   = params.W_cat / (rho_bulk * (1 - epsilon_bed));
  const pfrParams: UnitParams = { ...params, tau: V_bed };

  // When η < 1, wrap each rate law so that rate_observed = η × rate_intrinsic
  const scaledChemistry: ChemistryModel = eta < 0.9999 ? {
    ...chemistry,
    reactions: chemistry.reactions.map((rxn) => ({
      ...rxn,
      rateLaw: (C: Record<string, number>, T: number, p: Record<string, number>) =>
        eta * rxn.rateLaw(C, T, p),
    })),
  } : chemistry;

  return pfrModel(inlet, pfrParams, scaledChemistry);
};

// ─── Heat Exchanger (utility mode) ─────────────────────────────────────────

export interface HXParams {
  mode: 'utility';
  T_out?: number;    // set outlet temperature [K]  → model computes Q [kJ/s]
  Q_duty?: number;   // set heat duty [kJ/s > 0 = heat in] → model computes T_out
  rho_Cp: number;    // stream heat-capacity density [kJ/(L·K)], same as SimulationParams.rho_Cp
  Ca0: number;       // reference total concentration [mol/L] to convert F→vol-flow
}

/**
 * Utility-mode heat exchanger: changes stream temperature to a set-point or
 * applies a fixed duty.  No reaction; species concentrations pass through unchanged.
 *
 * Energy balance (lumped, constant Cp):
 *   Q [kJ/s] = rho_Cp * V̇ * (T_out − T_in)
 *   V̇ = Σ F_i / Ca0   [L/s] (dilute-mixture approximation)
 */
export function hxModel(
  inlet: Stream,
  params: HXParams,
): { outlet: Stream; Q: number } {
  const totalF = Math.max(Object.values(inlet.F).reduce((s, v) => s + v, 0), 1e-9);
  const Vdot   = totalF / Math.max(params.Ca0, 1e-9);   // [L/s]
  const heatCap = params.rho_Cp * Vdot;                  // [kJ/K]

  let T_out: number;
  let Q: number;
  if (params.T_out !== undefined) {
    T_out = params.T_out;
    Q     = heatCap * (T_out - inlet.T);
  } else if (params.Q_duty !== undefined) {
    Q     = params.Q_duty;
    T_out = inlet.T + Q / heatCap;
  } else {
    T_out = inlet.T;
    Q     = 0;
  }
  return { outlet: { ...inlet, T: T_out }, Q };
}

// ─── Component Splitter (F14.3) ─────────────────────────────────────────────

export interface CSplitParams {
  splitFractions: Record<string, number>; // ξ_i ∈ [0,1] per species (top fraction); default 0.5
}

export interface CSplitResult {
  topOutlet: ProcessStream;
  bottomOutlet: ProcessStream;
}

/**
 * Per-species split: top gets ξ_i·F_i, bottom gets (1−ξ_i)·F_i.
 * Temperature and pressure pass through unchanged (no energy balance).
 * Species absent from splitFractions default to ξ = 0.5.
 */
export function csplitModel(inlet: ProcessStream, params: CSplitParams): CSplitResult {
  const topF: Record<string, number> = {};
  const botF: Record<string, number> = {};
  for (const [sp, f] of Object.entries(inlet.F)) {
    const xi = Math.max(0, Math.min(1, params.splitFractions[sp] ?? 0.5));
    topF[sp] = f * xi;
    botF[sp] = f * (1 - xi);
  }
  return {
    topOutlet:    { F: topF, T: inlet.T, P: inlet.P },
    bottomOutlet: { F: botF, T: inlet.T, P: inlet.P },
  };
}
