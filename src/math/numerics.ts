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

/**
 * Dormand-Prince RK45 step (FSAL). Returns 5th-order solution and mixed-scale error norm.
 * errorNorm ≤ 1 means the step is within tolerance.
 */
export function rk45Step(
  fn: (t: number, y: number[]) => number[],
  t: number,
  y: number[],
  h: number,
  rtol: number,
  atol: number,
): { y5: number[]; errorNorm: number } {
  const k1 = fn(t, y);
  const y2 = y.map((yi, i) => yi + h * 0.2 * k1[i]);
  const k2 = fn(t + h * 0.2, y2);
  const y3 = y.map((yi, i) => yi + h * (3 / 40 * k1[i] + 9 / 40 * k2[i]));
  const k3 = fn(t + h * 0.3, y3);
  const y4 = y.map((yi, i) => yi + h * (44 / 45 * k1[i] - 56 / 15 * k2[i] + 32 / 9 * k3[i]));
  const k4 = fn(t + h * 0.8, y4);
  const y5a = y.map((yi, i) => yi + h * (19372 / 6561 * k1[i] - 25360 / 2187 * k2[i] + 64448 / 6561 * k3[i] - 212 / 729 * k4[i]));
  const k5 = fn(t + h * (8 / 9), y5a);
  const y6 = y.map((yi, i) => yi + h * (9017 / 3168 * k1[i] - 355 / 33 * k2[i] + 46732 / 5247 * k3[i] + 49 / 176 * k4[i] - 5103 / 18656 * k5[i]));
  const k6 = fn(t + h, y6);
  const y5 = y.map((yi, i) => yi + h * (35 / 384 * k1[i] + 500 / 1113 * k3[i] + 125 / 192 * k4[i] - 2187 / 6784 * k5[i] + 11 / 84 * k6[i]));
  const k7 = fn(t + h, y5);

  // Error = diff of 5th/4th order weights applied to stages (Dormand-Prince)
  let errorNorm = 0;
  for (let i = 0; i < y.length; i++) {
    const e = h * (71 / 57600 * k1[i] - 71 / 16695 * k3[i] + 71 / 1920 * k4[i]
                  - 17253 / 339200 * k5[i] + 22 / 525 * k6[i] - 1 / 40 * k7[i]);
    const scale = atol + rtol * Math.max(Math.abs(y[i]), Math.abs(y5[i]));
    errorNorm = Math.max(errorNorm, Math.abs(e) / Math.max(scale, 1e-30));
  }
  return { y5, errorNorm };
}

/**
 * Adaptive ODE integration (Dormand-Prince RK45) from t0 to tf.
 * PI step controller: h_next = h * clamp(0.9*(1/err)^0.2, 0.2, 5).
 * Stiffness guard: sets stiff=true if h collapses below span/1e5 for 3 consecutive steps.
 */
export function odeAdaptive(
  fn: (t: number, y: number[]) => number[],
  t0: number,
  tf: number,
  y0: number[],
  rtol = 1e-6,
  atol = 1e-9,
): { tPoints: number[]; yPoints: number[][]; stiff: boolean; steps: number } {
  const tPoints: number[] = [t0];
  const yPoints: number[][] = [[...y0]];
  const span = Math.max(tf - t0, 1e-15);
  const hMin = span / 1e5;

  let t = t0;
  let y = [...y0];
  let h = span / 50;
  let smallCount = 0;
  let stiff = false;
  let steps = 0;

  while (t < tf - 1e-14 * span) {
    h = Math.min(h, tf - t, span * 10);
    if (h < hMin) { h = hMin; }

    const { y5, errorNorm } = rk45Step(fn, t, y, h, rtol, atol);
    steps++;

    if (errorNorm <= 1.0 || h <= hMin * 1.01) {
      t += h;
      y = y5;
      tPoints.push(t);
      yPoints.push([...y]);
      if (h <= hMin * 1.5) { if (++smallCount >= 3) stiff = true; } else { smallCount = 0; }
    }

    const factor = errorNorm > 1e-15 ? 0.9 * Math.pow(1 / errorNorm, 0.2) : 5;
    h = h * Math.max(0.2, Math.min(5, factor));
  }

  return { tPoints, yPoints, stiff, steps };
}

/**
 * Linearly resample adaptive ODE output onto a uniform nOut-point grid.
 */
export function resampleUniform(
  tPoints: number[],
  yPoints: number[][],
  nOut: number,
): { t: number[]; y: number[][] } {
  const t0 = tPoints[0];
  const tf = tPoints[tPoints.length - 1];
  const span = tf - t0;
  const tOut: number[] = [];
  for (let i = 0; i < nOut; i++) tOut.push(t0 + (i / (nOut - 1)) * span);

  const yOut: number[][] = tOut.map((ti) => {
    if (ti <= t0) return [...yPoints[0]];
    if (ti >= tf) return [...yPoints[yPoints.length - 1]];
    let lo = 0, hi = tPoints.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (tPoints[mid] <= ti) lo = mid; else hi = mid;
    }
    const frac = (ti - tPoints[lo]) / Math.max(tPoints[hi] - tPoints[lo], 1e-30);
    return yPoints[lo].map((v, j) => v + frac * (yPoints[hi][j] - v));
  });

  return { t: tOut, y: yOut };
}

/**
 * Brent's method: bisection + secant + inverse quadratic interpolation.
 * Typically converges in ~10 iterations (vs ~50 for bisect).
 * Returns { root, converged: false } when bracket is invalid.
 */
export function brent(
  f: (x: number) => number,
  lo: number,
  hi: number,
  tol = 1e-8,
  maxIter = 100,
): { root: number; converged: boolean } {
  let a = lo, b = hi;
  let fa = f(a), fb = f(b);
  if (fa * fb > 0) return { root: Math.abs(fa) < Math.abs(fb) ? a : b, converged: false };
  if (Math.abs(fa) < tol) return { root: a, converged: true };
  if (Math.abs(fb) < tol) return { root: b, converged: true };
  if (Math.abs(fa) < Math.abs(fb)) { [a, b] = [b, a]; [fa, fb] = [fb, fa]; }
  let c = a, fc = fa, s = 0, d = 0, mflag = true;
  for (let i = 0; i < maxIter; i++) {
    if (Math.abs(fb) < tol || Math.abs(b - a) < tol) return { root: b, converged: true };
    if (fa !== fc && fb !== fc) {
      s = (a * fb * fc) / ((fa - fb) * (fa - fc))
        + (b * fa * fc) / ((fb - fa) * (fb - fc))
        + (c * fa * fb) / ((fc - fa) * (fc - fb));
    } else if (fa !== fb) {
      s = b - fb * (b - a) / (fb - fa);
    } else {
      s = (a + b) / 2;
    }
    const lo4 = (3 * a + b) / 4;
    const notBetween = !(Math.min(lo4, b) < s && s < Math.max(lo4, b));
    const c2 = mflag  && Math.abs(s - b) >= Math.abs(b - c) / 2;
    const c3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;
    const c4 = mflag  && Math.abs(b - c) < tol;
    const c5 = !mflag && Math.abs(c - d) < tol;
    if (notBetween || c2 || c3 || c4 || c5) { s = (a + b) / 2; mflag = true; }
    else mflag = false;
    const fs = f(s);
    d = c; c = b; fc = fb;
    if (fa * fs < 0) { b = s; fb = fs; } else { a = s; fa = fs; }
    if (Math.abs(fa) < Math.abs(fb)) { [a, b] = [b, a]; [fa, fb] = [fb, fa]; }
  }
  return { root: b, converged: false };
}
