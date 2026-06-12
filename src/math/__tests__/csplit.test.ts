import { describe, it, expect } from 'vitest';
import { csplitModel } from '../unitModels';
import type { ProcessStream } from '../../types/stream';

describe('F14.3 — csplitModel golden tests', () => {
  // Hand-calculated:
  //   inlet: F_A = 1.0 mol/s, F_R = 0.5 mol/s, T = 300 K, P = 101325 Pa
  //   ξ_A = 0.8, ξ_R = 0.3
  //   top:    F_A = 1.0×0.8 = 0.8,  F_R = 0.5×0.3 = 0.15
  //   bottom: F_A = 1.0×0.2 = 0.2,  F_R = 0.5×0.7 = 0.35
  //   mass balance: top+bot = inlet for each species ✓

  const inlet: ProcessStream = { F: { A: 1.0, R: 0.5 }, T: 300, P: 101325 };

  it('splits species by specified fractions', () => {
    const { topOutlet, bottomOutlet } = csplitModel(inlet, {
      splitFractions: { A: 0.8, R: 0.3 },
    });

    expect(topOutlet.F['A']).toBeCloseTo(0.8, 8);
    expect(topOutlet.F['R']).toBeCloseTo(0.15, 8);
    expect(bottomOutlet.F['A']).toBeCloseTo(0.2, 8);
    expect(bottomOutlet.F['R']).toBeCloseTo(0.35, 8);
  });

  it('mass balance: top + bottom = inlet for each species', () => {
    const { topOutlet, bottomOutlet } = csplitModel(inlet, {
      splitFractions: { A: 0.8, R: 0.3 },
    });
    for (const sp of ['A', 'R']) {
      expect((topOutlet.F[sp] ?? 0) + (bottomOutlet.F[sp] ?? 0)).toBeCloseTo(inlet.F[sp]!, 8);
    }
  });

  it('defaults missing species fraction to 0.5 (equal split)', () => {
    const { topOutlet, bottomOutlet } = csplitModel(inlet, { splitFractions: {} });
    expect(topOutlet.F['A']).toBeCloseTo(0.5, 8);
    expect(bottomOutlet.F['A']).toBeCloseTo(0.5, 8);
    expect(topOutlet.F['R']).toBeCloseTo(0.25, 8);
    expect(bottomOutlet.F['R']).toBeCloseTo(0.25, 8);
  });

  it('ξ=1 sends all to top (pass-through)', () => {
    const { topOutlet, bottomOutlet } = csplitModel(inlet, { splitFractions: { A: 1.0, R: 1.0 } });
    expect(topOutlet.F['A']).toBeCloseTo(1.0, 8);
    expect(bottomOutlet.F['A']).toBeCloseTo(0.0, 8);
  });

  it('temperature and pressure pass through unchanged', () => {
    const { topOutlet, bottomOutlet } = csplitModel(inlet, { splitFractions: { A: 0.7 } });
    expect(topOutlet.T).toBe(300);
    expect(topOutlet.P).toBe(101325);
    expect(bottomOutlet.T).toBe(300);
    expect(bottomOutlet.P).toBe(101325);
  });

  it('clamps out-of-range ξ values', () => {
    const { topOutlet, bottomOutlet } = csplitModel(inlet, { splitFractions: { A: 1.5, R: -0.2 } });
    // A: clamped to 1.0 → all to top
    expect(topOutlet.F['A']).toBeCloseTo(1.0, 8);
    expect(bottomOutlet.F['A']).toBeCloseTo(0.0, 8);
    // R: clamped to 0.0 → all to bottom
    expect(topOutlet.F['R']).toBeCloseTo(0.0, 8);
    expect(bottomOutlet.F['R']).toBeCloseTo(0.5, 8);
  });
});
