export function rk4(
  f: (t: number, X: number) => number,
  t0: number,
  X0: number,
  t1: number,
  nSteps: number = 100
): { t: number; X: number }[] {
  const h = (t1 - t0) / nSteps;
  const result: { t: number; X: number }[] = [];
  let t = t0;
  let X = X0;
  result.push({ t, X });
  for (let i = 0; i < nSteps; i++) {
    const k1 = h * f(t, X);
    const k2 = h * f(t + h / 2, X + k1 / 2);
    const k3 = h * f(t + h / 2, X + k2 / 2);
    const k4 = h * f(t + h, X + k3);
    X = X + (k1 + 2 * k2 + 2 * k3 + k4) / 6;
    X = Math.max(0, Math.min(0.9999, X));
    t = t + h;
    result.push({ t, X });
  }
  return result;
}
