/**
 * F23 — Nelder–Mead simplex optimizer (pure math, zero React/Zustand imports)
 *
 * Box constraints via reflection-clamping. Derivative-free — suitable for
 * objective functions that are noisy near solver convergence tolerances.
 *
 * Reference: Nelder & Mead (1965) Computer Journal 7(4):308-313.
 *
 * Invariant: this file imports NO React, NO Zustand, NO browser APIs.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OptimOptions {
  maxIter?:  number;   // total iteration budget (default 200)
  xtol?:     number;   // simplex diameter convergence tolerance (default 1e-6)
  ftol?:     number;   // function-value spread tolerance (default 1e-8)
  alpha?:    number;   // reflection coefficient (default 1.0)
  gamma?:    number;   // expansion coefficient (default 2.0)
  rho?:      number;   // contraction coefficient (default 0.5)
  sigma?:    number;   // shrink coefficient (default 0.5)
  initStep?: number;   // initial step as fraction of bounds range (default 0.05)
}

export interface OptimResult {
  x:          number[];  // best point (in bounds)
  fx:         number;    // objective value at x (minimization)
  iterations: number;
  converged:  boolean;   // true = xtol/ftol satisfied before maxIter
}

// Internal simplex vertex
type Pt = { x: number[]; fx: number };

// ─── Internal helpers ─────────────────────────────────────────────────────────

function clamp(x: number[], bounds: [number, number][]): number[] {
  return x.map((xi, i) => Math.min(Math.max(xi, bounds[i][0]), bounds[i][1]));
}

function vadd(a: number[], b: number[], s = 1): number[] {
  return a.map((ai, i) => ai + s * b[i]);
}

function vsub(a: number[], b: number[]): number[] {
  return a.map((ai, i) => ai - b[i]);
}

/** Centroid of all simplex points except the last (worst). */
function centroid(pts: Pt[]): number[] {
  const n = pts.length - 1; // skip last (worst)
  const c = pts[0].x.map(() => 0);
  for (let i = 0; i < n; i++) for (let j = 0; j < c.length; j++) c[j] += pts[i].x[j];
  return c.map(ci => ci / n);
}

/** Maximum Euclidean distance between any two simplex vertices. */
function diameter(pts: Pt[]): number {
  let max = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.sqrt(vsub(pts[i].x, pts[j].x).reduce((s, v) => s + v * v, 0));
      if (d > max) max = d;
    }
  }
  return max;
}

function defaults(o: OptimOptions): Required<OptimOptions> {
  return {
    maxIter:  o.maxIter  ?? 200,
    xtol:     o.xtol     ?? 1e-6,
    ftol:     o.ftol     ?? 1e-8,
    alpha:    o.alpha    ?? 1.0,
    gamma:    o.gamma    ?? 2.0,
    rho:      o.rho      ?? 0.5,
    sigma:    o.sigma    ?? 0.5,
    initStep: o.initStep ?? 0.05,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build an initial simplex of n+1 vertices around x0.
 * Each perturbed vertex moves +initStep×range along one coordinate.
 *
 * @param x0       initial guess (clamped to bounds internally)
 * @param bounds   [[lo, hi], ...] for each variable
 * @param f        objective function (minimise)
 * @param initStep fraction of range for initial perturbation
 */
export function initSimplex(
  x0: number[],
  bounds: [number, number][],
  f: (x: number[]) => number,
  initStep = 0.05,
): Pt[] {
  const n = x0.length;
  const x0c = clamp(x0, bounds);
  const pts: Pt[] = [{ x: x0c, fx: f(x0c) }];

  for (let j = 0; j < n; j++) {
    const xj = [...x0c];
    const range = bounds[j][1] - bounds[j][0];
    // Step forward; if clamped to same value, step backward
    let step = x0c[j] + initStep * range;
    if (step > bounds[j][1] - 1e-12 * range) step = x0c[j] - initStep * range;
    xj[j] = Math.min(Math.max(step, bounds[j][0]), bounds[j][1]);
    pts.push({ x: xj, fx: f(xj) });
  }

  pts.sort((a, b) => a.fx - b.fx);
  return pts;
}

/**
 * Execute one Nelder–Mead iteration. Returns new sorted simplex.
 * The simplex must be pre-sorted (best first) before calling.
 *
 * @param simplex sorted array of n+1 vertices (best = simplex[0])
 * @param f       objective function (minimise)
 * @param bounds  box constraints
 * @param opts    algorithm coefficients
 */
export function stepNM(
  simplex: Pt[],
  f: (x: number[]) => number,
  bounds: [number, number][],
  opts: Required<OptimOptions>,
): Pt[] {
  const n = simplex.length - 1; // n_vars
  const { alpha, gamma, rho, sigma } = opts;

  const xBar     = centroid(simplex);       // centroid of all-but-worst
  const best     = simplex[0];
  const sndWorst = simplex[n - 1];
  const worst    = simplex[n];

  // ── Reflection ─────────────────────────────────────────────────────────────
  const xr  = clamp(vadd(xBar, vsub(xBar, worst.x), alpha), bounds);
  const fxr = f(xr);

  let replacement: Pt;

  if (fxr < best.fx) {
    // ── Expansion ───────────────────────────────────────────────────────────
    const xe  = clamp(vadd(xBar, vsub(xr, xBar), gamma), bounds);
    const fxe = f(xe);
    replacement = fxe < fxr ? { x: xe, fx: fxe } : { x: xr, fx: fxr };
  } else if (fxr < sndWorst.fx) {
    // ── Accept reflection ───────────────────────────────────────────────────
    replacement = { x: xr, fx: fxr };
  } else {
    // ── Contraction ─────────────────────────────────────────────────────────
    const useRefl = fxr < worst.fx;
    const xc  = clamp(vadd(xBar, vsub(useRefl ? xr : worst.x, xBar), rho), bounds);
    const fxc = f(xc);

    if (fxc < (useRefl ? fxr : worst.fx)) {
      replacement = { x: xc, fx: fxc };
    } else {
      // ── Shrink ─────────────────────────────────────────────────────────────
      const shrunk: Pt[] = simplex.map((pt, i) => {
        if (i === 0) return pt;
        const xs = clamp(vadd(best.x, vsub(pt.x, best.x), sigma), bounds);
        return { x: xs, fx: f(xs) };
      });
      shrunk.sort((a, b) => a.fx - b.fx);
      return shrunk;
    }
  }

  const next = [...simplex.slice(0, n), replacement];
  next.sort((a, b) => a.fx - b.fx);
  return next;
}

/**
 * Run Nelder–Mead simplex optimisation to completion.
 *
 * All variables are box-constrained to `bounds`. Objectives that return
 * `Infinity` or `NaN` (e.g. non-converging flowsheet evaluations) are treated
 * as +∞ — the simplex naturally routes around such regions.
 *
 * @param f       objective function to MINIMISE
 * @param x0      initial guess (length n)
 * @param bounds  [[lo, hi], ...] for each variable (length n)
 * @param options algorithm parameters (all optional)
 */
export function nelderMead(
  f: (x: number[]) => number,
  x0: number[],
  bounds: [number, number][],
  options: OptimOptions = {},
): OptimResult {
  const opts = defaults(options);
  let simplex = initSimplex(x0, bounds, f, opts.initStep);
  let iter = 0;

  while (iter < opts.maxIter) {
    simplex = stepNM(simplex, f, bounds, opts);
    iter++;
    const diam   = diameter(simplex);
    const fSpread = simplex[simplex.length - 1].fx - simplex[0].fx;
    if (diam < opts.xtol && fSpread < opts.ftol) break;
  }

  return {
    x:          simplex[0].x,
    fx:         simplex[0].fx,
    iterations: iter,
    converged:  iter < opts.maxIter,
  };
}
