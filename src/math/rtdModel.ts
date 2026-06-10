/**
 * RTD (Residence Time Distribution) models — pure math, no framework imports.
 *
 * Tanks-in-Series (TIS): N equal CSTRs in series, each with τ_i = τ/N
 *   E(t) = N*(N*t/τ)^(N-1) * exp(-N*t/τ) / (τ*(N-1)!)
 *   Xa_TIS = 1 - 1/(1 + Da/N)^N  for 1st-order irreversible
 *
 * Limiting cases:
 *   N=1 → perfect mixing (CSTR exponential)
 *   N→∞ → plug flow (PFR delta function)
 */

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

export interface RTDPoint {
  t: number;
  E_TIS: number;
  E_CSTR: number;
  E_PFR: number;
}

export interface RTDResult {
  curve: RTDPoint[];
  Xa_CSTR: number;
  Xa_TIS: number;
  Xa_PFR: number;
}

/**
 * Compute RTD curves and 1st-order conversions.
 * @param tau   Mean residence time (s)
 * @param N     Number of tanks in series (integer ≥ 1)
 * @param Da    Damköhler number = k*τ
 * @param nPts  Number of points on the E(t) curve
 */
export function computeRTD(
  tau: number,
  N: number,
  Da: number,
  nPts = 120,
): RTDResult {
  const n = Math.max(1, Math.round(N));
  const tMax = tau * Math.max(5, n + 2);
  const dt = tMax / nPts;
  const factNm1 = factorial(n - 1);

  const curve: RTDPoint[] = [];
  for (let i = 0; i <= nPts; i++) {
    const t = i * dt;
    const theta = t / tau;
    const E_CSTR = (1 / tau) * Math.exp(-t / tau);
    const E_TIS =
      n === 1
        ? E_CSTR
        : ((n / tau) * Math.pow(n * theta, n - 1) * Math.exp(-n * theta)) / factNm1;
    // PFR: delta function at t=tau — approximate as narrow Gaussian
    const sig = tau * 0.02;
    const E_PFR = (1 / (sig * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((t - tau) / sig) ** 2);
    curve.push({ t, E_TIS: isFinite(E_TIS) ? E_TIS : 0, E_CSTR, E_PFR });
  }

  const k = Da / tau;
  const Xa_CSTR = Da / (1 + Da);
  const Xa_PFR  = 1 - Math.exp(-Da);
  const Xa_TIS  = 1 - 1 / Math.pow(1 + k * (tau / n), n);

  return { curve, Xa_CSTR, Xa_TIS, Xa_PFR };
}
