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
