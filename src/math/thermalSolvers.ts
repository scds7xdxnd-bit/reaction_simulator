import type { SimulationParams } from '../types/reactor';
import { kArrhenius, k2Arrhenius, getRate } from './kinetics';
import { rk4, rk4_system } from './rk4';

export function adiabaticT(
  T_in: number,
  Xa_in: number,
  Xa_out: number,
  params: SimulationParams
): number {
  const deltaT = (-params.delta_H) * params.Ca0 * (Xa_out - Xa_in) / params.rho_Cp;
  return Math.max(200, Math.min(1500, T_in + deltaT));
}

function bisect(f: (x: number) => number, lo: number, hi: number, n: number): number {
  let a = lo;
  let b = hi;
  const fa = f(a);
  const fb = f(b);
  if (fa * fb > 0) return Math.abs(fa) < Math.abs(fb) ? a : b;
  if (fa > 0) { const tmp = a; a = b; b = tmp; }
  for (let i = 0; i < n; i++) {
    const mid = (a + b) / 2;
    if (f(mid) < 0) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

function computeDa(
  _Xa_in: number,
  Xa_out: number,
  tau: number,
  k_eff: number,
  _k2_eff: number,
  params: SimulationParams
): number {
  switch (params.kinetics) {
    case 'first-order':
      return k_eff * tau * (1 - Xa_out);
    case 'second-order':
      return k_eff * params.Ca0 * tau * (1 - Xa_out) ** 2;
    case 'autocatalytic':
      return k_eff * params.Ca0 * tau * (1 - Xa_out) * (Xa_out + params.Cr0_fraction);
  }
}

export function solveCSTRAdiabatic(
  Xa_in: number,
  T_in: number,
  tau: number,
  params: SimulationParams
): { Xa_out: number; T_out: number } {
  const f = (Xa_out: number): number => {
    const T_out = adiabaticT(T_in, Xa_in, Xa_out, params);
    const k_eff = kArrhenius(params, T_out);
    const k2_eff = k2Arrhenius(params, T_out);
    const Da = computeDa(Xa_in, Xa_out, tau, k_eff, k2_eff, params);
    return Da - (Xa_out - Xa_in);
  };

  const Xa_out = bisect(f, Xa_in + 1e-9, 0.9999, 60);
  const T_out = adiabaticT(T_in, Xa_in, Xa_out, params);
  return { Xa_out, T_out };
}

export function solveCSTRCooled(
  Xa_in: number,
  T_in: number,
  tau: number,
  Tc: number,
  kappa_v: number,
  params: SimulationParams
): { Xa_out: number; T_out: number } {
  const cooledT = (Xa_out: number): number => {
    const heat_gen = (-params.delta_H) * params.Ca0 * (Xa_out - Xa_in);
    return (params.rho_Cp * T_in + kappa_v * tau * Tc + heat_gen) /
           (params.rho_Cp + kappa_v * tau);
  };

  const f = (Xa_out: number): number => {
    const T_out = Math.max(200, Math.min(1500, cooledT(Xa_out)));
    const k_eff = kArrhenius(params, T_out);
    const k2_eff = k2Arrhenius(params, T_out);
    const Da = computeDa(Xa_in, Xa_out, tau, k_eff, k2_eff, params);
    return Da - (Xa_out - Xa_in);
  };

  const Xa_out = bisect(f, Xa_in + 1e-9, 0.9999, 60);
  const T_out = Math.max(200, Math.min(1500, cooledT(Xa_out)));
  return { Xa_out, T_out };
}

export function solvePFRAdiabatic(
  Xa_in: number,
  T_in: number,
  tau: number,
  params: SimulationParams
): { Xa_out: number; T_out: number; profile: { t: number; Xa: number; T: number }[] } {
  const f = (_t: number, Xa: number): number => {
    const T = adiabaticT(T_in, Xa_in, Xa, params);
    return getRate(Xa, params, T) / params.Ca0;
  };

  const rk4Result = rk4(f, 0, Xa_in, tau, 200);
  const profile = rk4Result.map((p) => ({
    t: p.t,
    Xa: p.X,
    T: adiabaticT(T_in, Xa_in, p.X, params),
  }));

  const Xa_out = profile[profile.length - 1].Xa;
  const T_out = profile[profile.length - 1].T;
  return { Xa_out, T_out, profile };
}

export function solvePFRCooled(
  Xa_in: number,
  T_in: number,
  tau: number,
  Tc: number,
  kappa_v: number,
  params: SimulationParams
): { Xa_out: number; T_out: number; profile: { t: number; Xa: number; T: number }[] } {
  const f = (_t: number, y: number[]): number[] => {
    const [Xa, T] = y;
    const rate = getRate(Xa, params, T);
    const dXa_dt = rate / params.Ca0;
    const dT_dt = ((-params.delta_H) * rate - kappa_v * (T - Tc)) / params.rho_Cp;
    return [dXa_dt, dT_dt];
  };

  const result = rk4_system(f, 0, [Xa_in, T_in], tau, 200);
  const profile = result.map((p) => ({
    t: p.t,
    Xa: p.y[0],
    T: p.y[1],
  }));

  const last = profile[profile.length - 1];
  return { Xa_out: last.Xa, T_out: last.T, profile };
}

export interface OperatingDiagramData {
  curve: { T: number; G: number; R: number }[];
  steadyStates: { T: number; Xa: number; stable: boolean }[];
  T_in: number;
  Xa_in: number;
}

export function buildOperatingDiagram(
  Xa_in: number,
  T_in: number,
  tau: number,
  Tc: number,
  kappa_v: number,
  params: SimulationParams
): OperatingDiagramData {
  const T_min = T_in;
  const T_max = T_in + 300;
  const nPoints = 300;
  const curve: { T: number; G: number; R: number }[] = [];

  for (let i = 0; i < nPoints; i++) {
    const T = T_min + (i / (nPoints - 1)) * (T_max - T_min);
    const k_eff = kArrhenius(params, T);
    let Xa_eq: number;
    if (params.kinetics === 'first-order') {
      const Da = k_eff * tau;
      Xa_eq = (Xa_in + Da) / (1 + Da);
    } else if (params.kinetics === 'second-order') {
      const Da = k_eff * params.Ca0 * tau;
      const disc = 4 * Da * (1 - Xa_in) + 1;
      Xa_eq = disc >= 0 && Da > 1e-12
        ? ((2 * Da + 1) - Math.sqrt(disc)) / (2 * Da)
        : Xa_in;
    } else {
      const Da = k_eff * params.Ca0 * tau;
      Xa_eq = bisect(
        (x) => (x - Xa_in) - Da * (1 - x) * (x + params.Cr0_fraction),
        Xa_in + 1e-9, 0.9999, 30
      );
    }
    Xa_eq = Math.max(Xa_in, Math.min(0.9999, Xa_eq));

    const G = (-params.delta_H) * params.Ca0 * (Xa_eq - Xa_in);
    const R = params.rho_Cp * (T - T_in) + kappa_v * tau * (T - Tc);
    curve.push({ T, G, R });
  }

  const steadyStates: { T: number; Xa: number; stable: boolean }[] = [];
  for (let i = 0; i < curve.length - 1; i++) {
    const diff0 = curve[i].G - curve[i].R;
    const diff1 = curve[i + 1].G - curve[i + 1].R;
    if (diff0 * diff1 <= 0 && Math.abs(diff0 - diff1) > 1e-10) {
      const T_ss = curve[i].T + (0 - diff0) / (diff1 - diff0) * (curve[i + 1].T - curve[i].T);
      const k_eff_ss = kArrhenius(params, T_ss);
      let Xa_ss: number;
      if (params.kinetics === 'first-order') {
        const Da = k_eff_ss * tau;
        Xa_ss = (Xa_in + Da) / (1 + Da);
      } else {
        Xa_ss = Xa_in + ((-params.rho_Cp * (T_ss - T_in) - kappa_v * tau * (T_ss - Tc)) /
                         (-params.delta_H * params.Ca0));
        Xa_ss = Math.max(Xa_in, Math.min(0.9999, Xa_ss));
      }
      const dG_dT = i > 0 ? (curve[i + 1].G - curve[i - 1].G) / (curve[i + 1].T - curve[i - 1].T) : 0;
      const dR_dT = params.rho_Cp + kappa_v * tau;
      const stable = dG_dT < dR_dT;
      steadyStates.push({ T: T_ss, Xa: Xa_ss, stable });
    }
  }

  return { curve, steadyStates, T_in, Xa_in };
}
