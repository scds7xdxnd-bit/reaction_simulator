import type { SimulationParams, ThermalMode } from '../types/reactor';

export type StateVec = [number, number, number, number];

export function getKeff(T: number, params: SimulationParams, useK2 = false): number {
  const kBase = useK2 ? params.k2 : params.k;
  if (params.Ea === 0) return kBase;
  const R = 8.314;
  const Ea_J = params.Ea * 1000;
  return kBase * Math.exp((Ea_J / R) * (1 / params.T_ref - 1 / Math.max(T, 200)));
}

export function computeRate1(state: StateVec, params: SimulationParams): number {
  const [Ca, Cr, , T] = state;
  const k = getKeff(T, params, false);
  switch (params.kinetics) {
    case 'first-order':    return k * Ca;
    case 'second-order':   return k * Ca * Ca;
    case 'autocatalytic':  return k * Ca * (Cr + params.Cr0_fraction * params.Ca0);
  }
}

export function computeRate2(state: StateVec, params: SimulationParams): number {
  const [, Cr, , T] = state;
  const k2 = getKeff(T, params, true);
  if (params.reactionMode === 'series')   return k2 * Cr;
  if (params.reactionMode === 'parallel') return k2 * state[0];
  return 0;
}

export function cstrDerivative(
  state: StateVec,
  inlet: StateVec,
  tau: number,
  thermalMode: ThermalMode,
  Tc: number,
  kappa_v: number,
  params: SimulationParams
): StateVec {
  const [Ca, Cr, Cs, T] = state;
  const [Ca_in, Cr_in, Cs_in, T_in] = inlet;

  const r1 = computeRate1(state, params);
  const r2 = computeRate2(state, params);

  const dCa = (Ca_in - Ca) / tau - r1 - (params.reactionMode === 'parallel' ? r2 : 0);
  const dCr = (Cr_in - Cr) / tau + r1 - (params.reactionMode === 'series' ? r2 : 0);
  const dCs = (Cs_in - Cs) / tau + r2;

  let dT = 0;
  if (thermalMode === 'isothermal') {
    dT = 0;
  } else {
    const heatGen = (-params.delta_H * 1000 * r1) / params.rho_Cp;
    const heatFlow = (T_in - T) / tau;
    const cooling = thermalMode === 'cooled' ? kappa_v * (T - Tc) : 0;
    dT = heatFlow + heatGen - cooling;
  }

  return [dCa, dCr, dCs, dT];
}

function addVec(a: StateVec, b: StateVec): StateVec {
  return [a[0]+b[0], a[1]+b[1], a[2]+b[2], a[3]+b[3]];
}

function scaleVec(a: StateVec, s: number): StateVec {
  return [a[0]*s, a[1]*s, a[2]*s, a[3]*s];
}

export function rk4StepVec(
  state: StateVec,
  f: (s: StateVec) => StateVec,
  dt: number,
  Ca0: number
): StateVec {
  const k1 = f(state);
  const k2 = f(addVec(state, scaleVec(k1, dt / 2)));
  const k3 = f(addVec(state, scaleVec(k2, dt / 2)));
  const k4 = f(addVec(state, scaleVec(k3, dt)));
  const step = scaleVec(addVec(addVec(k1, scaleVec(k2, 2)), addVec(scaleVec(k3, 2), k4)), dt / 6);
  const next = addVec(state, step);
  return [
    Math.max(0, Math.min(next[0], Ca0 * 2)),
    Math.max(0, next[1]),
    Math.max(0, next[2]),
    Math.max(200, Math.min(next[3], 1200)),
  ];
}
