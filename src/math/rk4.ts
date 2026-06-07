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

export function rk4_system(
  f: (t: number, y: number[]) => number[],
  t0: number,
  y0: number[],
  t1: number,
  nSteps: number = 200
): { t: number; y: number[] }[] {
  const h = (t1 - t0) / nSteps;
  const result: { t: number; y: number[] }[] = [];
  let t = t0;
  let y = [...y0];
  result.push({ t, y: [...y] });

  for (let i = 0; i < nSteps; i++) {
    const k1 = f(t, y).map((v) => h * v);
    const k2 = f(t + h / 2, y.map((yi, j) => yi + k1[j] / 2)).map((v) => h * v);
    const k3 = f(t + h / 2, y.map((yi, j) => yi + k2[j] / 2)).map((v) => h * v);
    const k4 = f(t + h, y.map((yi, j) => yi + k3[j])).map((v) => h * v);
    y = y.map((yi, j) => yi + (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]) / 6);
    if (y[0] !== undefined) y[0] = Math.max(0, Math.min(0.9999, y[0]));
    if (y[1] !== undefined) y[1] = Math.max(200, Math.min(1500, y[1]));
    t = t + h;
    result.push({ t, y: [...y] });
  }

  return result;
}
