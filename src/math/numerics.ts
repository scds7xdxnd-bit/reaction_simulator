/**
 * Solve f(x) = 0 on [lo, hi] by bisection.
 * If the bracket is invalid (f(lo)*f(hi) > 0), returns the endpoint with
 * smaller |f|. Runs exactly maxIter halvings.
 */
export function bisect(
  f: (x: number) => number,
  lo: number,
  hi: number,
  maxIter: number = 60,
): number {
  let a = lo;
  let b = hi;
  const fa = f(a);
  const fb = f(b);
  if (fa * fb > 0) return Math.abs(fa) < Math.abs(fb) ? a : b;
  if (fa > 0) {
    [a, b] = [b, a];
  }
  for (let i = 0; i < maxIter; i++) {
    const mid = (a + b) / 2;
    if (f(mid) < 0) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

export type RecycleMethod = 'direct' | 'wegstein' | 'newton';

export interface WegsteinState {
  prevAssumed: number[];
  prevComputed: number[];
  iter: number;
}

// Wegstein update per component. 3-iteration direct warm-up, then secant acceleration.
// s = (g(xₙ)-g(xₙ₋₁))/(xₙ-xₙ₋₁), q = s/(s-1) clamped to [-5,0], xₙ₊₁ = q·xₙ+(1-q)·g(xₙ).
// Falls back to 50% damping when the secant denominator is degenerate.
export function wegsteinStep(
  assumed: number[],
  computed: number[],
  state: WegsteinState | null,
  warmupIter = 3
): { updated: number[]; nextState: WegsteinState } {
  const iter = state?.iter ?? 0;
  const nextState: WegsteinState = {
    prevAssumed: [...assumed],
    prevComputed: [...computed],
    iter: iter + 1,
  };

  if (iter < warmupIter || !state) {
    return { updated: assumed.map((a, i) => 0.5 * a + 0.5 * computed[i]), nextState };
  }

  const updated = assumed.map((x_n, i) => {
    const gx_n   = computed[i];
    const x_nm1  = state.prevAssumed[i];
    const gx_nm1 = state.prevComputed[i];
    const dx = x_n - x_nm1;
    if (Math.abs(dx) < 1e-12 || Math.abs((gx_n - gx_nm1) / (Math.abs(dx) + 1e-12) - 1) < 1e-12) {
      return 0.5 * x_n + 0.5 * gx_n;
    }
    const s = (gx_n - gx_nm1) / dx;
    if (Math.abs(s - 1) < 1e-10) return 0.5 * x_n + 0.5 * gx_n;
    const q = Math.max(-5, Math.min(0, s / (s - 1)));
    return q * x_n + (1 - q) * gx_n;
  });
  return { updated, nextState };
}

/**
 * Single 4th-order Runge-Kutta step for the ODE y' = fn(t, y).
 * Returns a new array. Does not mutate y.
 */
export function rk4Step(
  fn: (t: number, y: number[]) => number[],
  t: number,
  y: number[],
  h: number,
): number[] {
  const k1 = fn(t, y);
  const y2 = y.map((yi, i) => yi + k1[i] * h / 2);
  const k2 = fn(t + h / 2, y2);
  const y3 = y.map((yi, i) => yi + k2[i] * h / 2);
  const k3 = fn(t + h / 2, y3);
  const y4 = y.map((yi, i) => yi + k3[i] * h);
  const k4 = fn(t + h, y4);
  return y.map((yi, i) => yi + h * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
}
