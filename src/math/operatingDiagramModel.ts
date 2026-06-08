import type { SimulationParams } from '../types/reactor';
import { kArrhenius } from './kinetics';
import { bisect } from './numerics';

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
