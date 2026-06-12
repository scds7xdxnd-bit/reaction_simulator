import { describe, it, expect } from 'vitest';
import { flashModel, purgeModel } from '../flashModel';
import type { ProcessStream } from '../../types/stream';

describe('F14.2 — flashModel golden tests', () => {
  // Hand-calculated for C6H6/C7H8 feed at T=365 K (T_C=91.85°C):
  //   pSat_C6H6 = 10^(6.90565 - 1211.033/312.64) × 133.322 Pa ≈ 143 531 Pa
  //   pSat_C7H8 = 10^(6.90254 - 1343.943/311.227) × 133.322 Pa ≈  51 184 Pa
  //   At P=101325 Pa: K_C6H6=1.417, K_C7H8=0.505 → f(0)=-0.038<0 → subcooled, ψ=0
  //   At P=80000 Pa:  K_C6H6=1.794, K_C7H8=0.640 → two-phase, ψ≈0.759

  it('subcooled: P=101325 Pa at T=365 K → ψ=0, all liquid', () => {
    const feed: ProcessStream = { F: { C6H6: 0.5, C7H8: 0.5 }, T: 365, P: 101325 };
    const r = flashModel(feed);
    // bubble-point pressure ≈ 0.5×143531 + 0.5×51184 = 97 358 Pa < 101 325 Pa → subcooled
    expect(r.psi).toBe(0);
    expect(r.vapor.F['C6H6']).toBeCloseTo(0, 8);
    expect(r.vapor.F['C7H8']).toBeCloseTo(0, 8);
    expect(r.liquid.F['C6H6']).toBeCloseTo(0.5, 8);
    expect(r.liquid.F['C7H8']).toBeCloseTo(0.5, 8);
  });

  it('two-phase: P=80000 Pa → ψ≈0.759, benzene enriched in vapor', () => {
    const feed: ProcessStream = { F: { C6H6: 0.5, C7H8: 0.5 }, T: 365, P: 80000 };
    const r = flashModel(feed);
    // R-R exact (2-comp equal z): ψ = 0.5(2-K1-K2)/((K1-1)(K2-1)) ≈ 0.759
    expect(r.psi).toBeGreaterThan(0.70);
    expect(r.psi).toBeLessThan(0.85);
    expect(r.vapor.F['C6H6']!).toBeGreaterThan(r.vapor.F['C7H8']!);
    expect(r.liquid.F['C7H8']!).toBeGreaterThan(r.liquid.F['C6H6']!);
  });

  it('mass balance: vapor + liquid = feed for each species', () => {
    const feed: ProcessStream = { F: { C6H6: 0.5, C7H8: 0.5 }, T: 365, P: 80000 };
    const { vapor, liquid } = flashModel(feed);
    expect((vapor.F['C6H6'] ?? 0) + (liquid.F['C6H6'] ?? 0)).toBeCloseTo(0.5, 8);
    expect((vapor.F['C7H8'] ?? 0) + (liquid.F['C7H8'] ?? 0)).toBeCloseTo(0.5, 8);
  });

  it('non-volatile species (no Antoine data) stay entirely in liquid', () => {
    const feed: ProcessStream = { F: { C6H6: 0.5, NV: 0.3 }, T: 365, P: 80000 };
    const r = flashModel(feed);
    expect(r.nonVolatile).toContain('NV');
    expect(r.liquid.F['NV']).toBeCloseTo(0.3, 8);
    expect(r.vapor.F['NV'] ?? 0).toBeCloseTo(0, 8);
  });

  it('T and P are preserved in both outlet streams', () => {
    const feed: ProcessStream = { F: { C6H6: 0.5, C7H8: 0.5 }, T: 365, P: 80000 };
    const { vapor, liquid } = flashModel(feed);
    expect(vapor.T).toBe(365);
    expect(vapor.P).toBe(80000);
    expect(liquid.T).toBe(365);
    expect(liquid.P).toBe(80000);
  });
});

describe('F14.5 — purgeModel golden tests', () => {
  // Hand-calculated: β=0.1 → vent=10% of each species, process=90%
  const inlet: ProcessStream = { F: { A: 1.0, I: 0.2 }, T: 300, P: 101325 };

  it('β=0.1: 10% to vent, 90% to process', () => {
    const { vent, process } = purgeModel(inlet, 0.1);
    expect(vent.F['A']).toBeCloseTo(0.1, 8);
    expect(vent.F['I']).toBeCloseTo(0.02, 8);
    expect(process.F['A']).toBeCloseTo(0.9, 8);
    expect(process.F['I']).toBeCloseTo(0.18, 8);
  });

  it('mass balance: vent + process = inlet for each species', () => {
    const { vent, process } = purgeModel(inlet, 0.15);
    for (const sp of ['A', 'I'] as const) {
      expect((vent.F[sp] ?? 0) + (process.F[sp] ?? 0)).toBeCloseTo(inlet.F[sp]!, 8);
    }
  });

  it('β=0: all to process (no purge)', () => {
    const { vent, process } = purgeModel(inlet, 0.0);
    expect(vent.F['A']).toBeCloseTo(0, 8);
    expect(process.F['A']).toBeCloseTo(1.0, 8);
  });

  it('T and P preserved in both outlets', () => {
    const { vent, process } = purgeModel(inlet, 0.1);
    expect(vent.T).toBe(300);
    expect(vent.P).toBe(101325);
    expect(process.T).toBe(300);
    expect(process.P).toBe(101325);
  });
});
