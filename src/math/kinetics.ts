import type { SimulationParams } from '../types/reactor';

export function rateFirstOrder(Xa: number, k: number, Ca0: number): number {
  return k * Ca0 * (1 - Xa);
}

export function rateSecondOrder(Xa: number, k: number, Ca0: number): number {
  return k * Ca0 * Ca0 * (1 - Xa) * (1 - Xa);
}

export function rateAutocatalytic(Xa: number, k: number, Ca0: number, Cr0_frac: number): number {
  return k * Ca0 * Ca0 * (1 - Xa) * (Xa + Cr0_frac);
}

export function getRate(Xa: number, params: SimulationParams): number {
  const clamped = Math.max(0, Math.min(0.9999, Xa));
  switch (params.kinetics) {
    case 'first-order':
      return rateFirstOrder(clamped, params.k, params.Ca0);
    case 'second-order':
      return rateSecondOrder(clamped, params.k, params.Ca0);
    case 'autocatalytic':
      return rateAutocatalytic(clamped, params.k, params.Ca0, params.Cr0_fraction);
  }
}

export function buildLevenspielCurve(params: SimulationParams): { Xa: number; inv_rA_norm: number }[] {
  const effectiveK = params.reactionMode === 'parallel'
    ? params.k + params.k2
    : params.k;
  const levenspielParams: SimulationParams = {
    ...params,
    kinetics: 'first-order',
    k: effectiveK,
  };

  const points: { Xa: number; inv_rA_norm: number }[] = [];
  const n = 200;
  const XaStart = 0.001;
  const XaEnd = 0.995;
  const step = (XaEnd - XaStart) / (n - 1);

  for (let i = 0; i < n; i++) {
    const Xa = XaStart + i * step;
    const rate = getRate(Xa, levenspielParams);
    const inv_rA_norm = rate > 1e-12 ? params.Ca0 / rate : params.Ca0 / 1e-12;
    points.push({ Xa, inv_rA_norm });
  }

  return points;
}
