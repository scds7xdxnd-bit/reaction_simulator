import type { SimulationParams } from '../types/reactor';
import { getRate } from './kinetics';
import { rk4 } from './rk4';

export function solveCSTR(
  Xa_in: number,
  tau: number,
  params: SimulationParams
): { Xa_out: number; profile: { cumTau: number; Xa: number }[] } {
  const Xa_in_clamped = Math.max(0, Math.min(0.9999, Xa_in));

  let Xa_out: number;

  switch (params.kinetics) {
    case 'first-order':
      Xa_out = solveCSTRFirstOrder(Xa_in_clamped, tau, params.k);
      break;
    case 'second-order':
      Xa_out = solveCSTRSecondOrder(Xa_in_clamped, tau, params.k, params.Ca0);
      break;
    case 'autocatalytic':
      Xa_out = solveCSTRAutocatalytic(Xa_in_clamped, tau, params.k, params.Ca0, params.Cr0_fraction);
      break;
  }

  const profile = [
    { cumTau: 0, Xa: Xa_in_clamped },
    { cumTau: tau, Xa: Xa_out },
  ];

  return { Xa_out, profile };
}

function solveCSTRFirstOrder(Xa_in: number, tau: number, k: number): number {
  const Da = k * tau;
  const Xa_out = (Xa_in + Da) / (1 + Da);
  return Math.max(0, Math.min(0.9999, Xa_out));
}

function solveCSTRSecondOrder(Xa_in: number, tau: number, k: number, Ca0: number): number {
  const Da = k * Ca0 * tau;
  const disc = 4 * Da * (1 - Xa_in) + 1;
  if (disc < 0) return Xa_in;
  if (Da < 1e-12) return Xa_in;
  const Xa_out = ((2 * Da + 1) - Math.sqrt(disc)) / (2 * Da);
  return Math.max(0, Math.min(0.9999, Xa_out));
}

function solveCSTRAutocatalytic(
  Xa_in: number,
  tau: number,
  k: number,
  Ca0: number,
  Cr0_frac: number
): number {
  const Da = k * Ca0 * tau;
  let lo = Xa_in;
  let hi = 0.999;

  const f = (Xa: number) => (Xa - Xa_in) - Da * (1 - Xa) * (Xa + Cr0_frac);

  if (f(hi) < 0) return hi;

  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const fMid = f(mid);
    if (fMid === 0) return mid;
    if (f(lo) * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return Math.max(0, Math.min(0.9999, (lo + hi) / 2));
}

export function solvePFR(
  Xa_in: number,
  tau: number,
  params: SimulationParams
): { Xa_out: number; profile: { cumTau: number; Xa: number }[] } {
  const Xa_in_clamped = Math.max(0, Math.min(0.9999, Xa_in));

  const f = (_t: number, X: number): number => {
    return getRate(X, params) / params.Ca0;
  };

  const rk4Result = rk4(f, 0, Xa_in_clamped, tau, 200);
  const profile = rk4Result.map((p) => ({ cumTau: p.t, Xa: p.X }));
  const Xa_out = profile[profile.length - 1].Xa;

  return { Xa_out, profile };
}

export function solveSeriesCSTR(
  Ca_in: number,
  Cr_in: number,
  Cs_in: number,
  tau: number,
  k1: number,
  k2: number
): { Ca_out: number; Cr_out: number; Cs_out: number } {
  const Ca_out = Ca_in / (1 + k1 * tau);
  const Cr_out = (k1 * Ca_out * tau + Cr_in) / (1 + k2 * tau);
  const Cs_out = Ca_in + Cr_in + Cs_in - Ca_out - Cr_out;
  return { Ca_out, Cr_out, Cs_out: Math.max(0, Cs_out) };
}

export function solveParallelCSTR(
  Ca_in: number,
  Cr_in: number,
  Cs_in: number,
  tau: number,
  k1: number,
  k2: number
): { Ca_out: number; Cr_out: number; Cs_out: number } {
  const Ca_out = Ca_in / (1 + (k1 + k2) * tau);
  const Cr_out = Cr_in + k1 * Ca_out * tau;
  const Cs_out = Cs_in + k2 * Ca_out * tau;
  return { Ca_out, Cr_out, Cs_out };
}

export function solveMultiPFR(
  Ca_in: number,
  Cr_in: number,
  Cs_in: number,
  tau: number,
  k1: number,
  k2: number,
  mode: 'series' | 'parallel'
): { Ca_out: number; Cr_out: number; Cs_out: number; profile: { t: number; Ca: number; Cr: number; Cs: number }[] } {
  const nSteps = 200;
  const h = tau / nSteps;
  let Ca = Ca_in;
  let Cr = Cr_in;
  let Cs = Cs_in;
  const profile = [{ t: 0, Ca, Cr, Cs }];

  const dCa = (c_a: number, _c_r: number) =>
    mode === 'series' ? -k1 * c_a : -(k1 + k2) * c_a;
  const dCr = (c_a: number, c_r: number) =>
    mode === 'series' ? k1 * c_a - k2 * c_r : k1 * c_a;
  const dCs = (c_a: number, c_r: number) =>
    mode === 'series' ? k2 * c_r : k2 * c_a;

  for (let i = 0; i < nSteps; i++) {
    const ka1 = h * dCa(Ca, Cr);
    const kr1 = h * dCr(Ca, Cr);
    const ks1 = h * dCs(Ca, Cr);
    const ka2 = h * dCa(Ca + ka1 / 2, Cr + kr1 / 2);
    const kr2 = h * dCr(Ca + ka1 / 2, Cr + kr1 / 2);
    const ks2 = h * dCs(Ca + ka1 / 2, Cr + kr1 / 2);
    const ka3 = h * dCa(Ca + ka2 / 2, Cr + kr2 / 2);
    const kr3 = h * dCr(Ca + ka2 / 2, Cr + kr2 / 2);
    const ks3 = h * dCs(Ca + ka2 / 2, Cr + kr2 / 2);
    const ka4 = h * dCa(Ca + ka3, Cr + kr3);
    const kr4 = h * dCr(Ca + ka3, Cr + kr3);
    const ks4 = h * dCs(Ca + ka3, Cr + kr3);
    Ca = Math.max(0, Ca + (ka1 + 2 * ka2 + 2 * ka3 + ka4) / 6);
    Cr = Math.max(0, Cr + (kr1 + 2 * kr2 + 2 * kr3 + kr4) / 6);
    Cs = Math.max(0, Cs + (ks1 + 2 * ks2 + 2 * ks3 + ks4) / 6);
    profile.push({ t: (i + 1) * h, Ca, Cr, Cs });
  }

  return { Ca_out: Ca, Cr_out: Cr, Cs_out: Cs, profile };
}
