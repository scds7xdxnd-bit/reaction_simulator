import { describe, it, expect } from 'vitest';
import { nelderMead, initSimplex, stepNM } from '../optimizer';

// ─── 1D quadratic ─────────────────────────────────────────────────────────────

describe('nelderMead — 1D', () => {
  it('minimises f(x) = x² to x=0', () => {
    // hand-calc: global minimum is at x = 0, f = 0
    // bounds [-10, 10], x0 = [5]
    // NM in 1D degenerates to bisection-like behaviour: should converge
    const res = nelderMead((x) => x[0] * x[0], [5], [[-10, 10]]);
    expect(res.x[0]).toBeCloseTo(0, 3);
    expect(res.fx).toBeCloseTo(0, 6);
    expect(res.converged).toBe(true);
    expect(res.iterations).toBeLessThan(200);
  });

  it('box-constrained: f(x) = x² with bounds [1, 10] → minimum at x = 1 (boundary)', () => {
    // unconstrained min at x=0 is outside [1,10] → constrained min at x=1, f=1
    const res = nelderMead((x) => x[0] * x[0], [5], [[1, 10]]);
    expect(res.x[0]).toBeCloseTo(1, 3);
    expect(res.fx).toBeCloseTo(1, 4);
  });
});

// ─── 2D bowl ──────────────────────────────────────────────────────────────────

describe('nelderMead — 2D', () => {
  it('minimises (x-3)² + (y-2)² to (3, 2)', () => {
    // hand-calc: global minimum at (3, 2), f = 0
    // bounds: x in [0, 10], y in [0, 10], x0 = [0, 0]
    const res = nelderMead(
      ([x, y]) => (x - 3) ** 2 + (y - 2) ** 2,
      [0, 0],
      [[0, 10], [0, 10]],
      { xtol: 1e-7, ftol: 1e-12 },
    );
    expect(res.x[0]).toBeCloseTo(3, 3);
    expect(res.x[1]).toBeCloseTo(2, 3);
    expect(res.fx).toBeCloseTo(0, 6);
    expect(res.converged).toBe(true);
  });

  it('maximise Xa = 1 − exp(−τ) by minimising its negation', () => {
    // Model: Xa = 1 - exp(-τ), τ in [0, 10]
    // Maximum Xa at τ→∞ is 1; within [0,10] the maximum is 1-exp(-10) ≈ 0.99995
    // minimise f(τ) = exp(-τ) → τ_opt ≈ 10 (boundary)
    const res = nelderMead(
      ([tau]) => Math.exp(-tau),  // negated Xa objective
      [1],
      [[0, 10]],
    );
    // At boundary τ = 10: exp(-10) = 4.54e-5
    expect(res.x[0]).toBeCloseTo(10, 2);
    expect(res.fx).toBeCloseTo(Math.exp(-10), 6);
  });
});

// ─── Infinity handling ────────────────────────────────────────────────────────

describe('nelderMead — Infinity objective', () => {
  it('routes around infeasible region (f = Infinity for x < 0)', () => {
    // f(x) = x² for x ≥ 0, Infinity for x < 0
    // bounds [-5, 5], x0 = [3]
    // Nelder-Mead should find the feasible minimum at x ≈ 0
    const res = nelderMead(
      ([x]) => x < 0 ? Infinity : x * x,
      [3],
      [[-5, 5]],
    );
    // Minimum in feasible region is at x = 0
    expect(res.x[0]).toBeGreaterThanOrEqual(-1e-4);   // not in infeasible region
    expect(res.fx).toBeCloseTo(0, 3);
  });
});

// ─── Rosenbrock (non-trivial 2D) ─────────────────────────────────────────────

describe('nelderMead — Rosenbrock', () => {
  it('finds minimum at (1, 1) for f = (1-x)² + 100(y-x²)²', () => {
    // Rosenbrock banana: minimum at (1, 1), f = 0. Difficult for NM but should
    // converge with 500 iterations budget.
    // hand-calc: f(1,1) = (1-1)² + 100×(1-1)² = 0
    const res = nelderMead(
      ([x, y]) => (1 - x) ** 2 + 100 * (y - x * x) ** 2,
      [0, 0],
      [[-5, 5], [-5, 5]],
      { maxIter: 500, xtol: 1e-6, ftol: 1e-10 },
    );
    expect(res.x[0]).toBeCloseTo(1, 2);
    expect(res.x[1]).toBeCloseTo(1, 2);
    expect(res.fx).toBeCloseTo(0, 4);
  });
});

// ─── initSimplex / stepNM unit tests ─────────────────────────────────────────

describe('initSimplex', () => {
  it('creates n+1 = 3 vertices for 2D problem, best-first sorted', () => {
    const pts = initSimplex([0, 0], [[-10, 10], [-10, 10]], ([x, y]) => x * x + y * y);
    expect(pts).toHaveLength(3);
    // best first
    expect(pts[0].fx).toBeLessThanOrEqual(pts[1].fx);
    expect(pts[1].fx).toBeLessThanOrEqual(pts[2].fx);
  });
});

describe('stepNM', () => {
  it('strictly decreases the worst vertex value on a bowl function', () => {
    const f = ([x, y]: number[]) => x * x + y * y;
    const opts = { maxIter: 200, xtol: 1e-6, ftol: 1e-8, alpha: 1, gamma: 2, rho: 0.5, sigma: 0.5, initStep: 0.05 };
    const bounds: [number, number][] = [[-10, 10], [-10, 10]];
    let simplex = initSimplex([5, 5], bounds, f);
    const worstBefore = simplex[simplex.length - 1].fx;
    simplex = stepNM(simplex, f, bounds, opts);
    expect(simplex[simplex.length - 1].fx).toBeLessThanOrEqual(worstBefore);
  });
});
