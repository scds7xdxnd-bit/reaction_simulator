import { describe, it, expect } from 'vitest';
import { pumpModel, compModel, valveModel } from '../pressureChangerModels';
import type { ProcessStream } from '../../types/stream';

const inlet: ProcessStream = { F: { A: 1.0 }, T: 300, P: 1e5 };

describe('F14.4 — pumpModel golden tests', () => {
  // Hand-calculated: Q_vol=1e-3 m³/s, P_in=1e5 Pa, P_out=5e5 Pa, η=0.75
  //   W = Q_vol × ΔP / η = 1e-3 × 4e5 / 0.75 = 533.33 W
  //   T unchanged (liquid), P_out = 5e5 Pa

  it('shaft work: 1 L/s liquid from 1 bar to 5 bar, η=0.75 → W≈533 W', () => {
    const r = pumpModel(inlet, { P_out: 5e5, eta: 0.75, Q_vol: 1e-3 });
    expect(r.W_shaft).toBeCloseTo(533.33, 1);
  });

  it('outlet pressure equals P_out', () => {
    const r = pumpModel(inlet, { P_out: 5e5, eta: 0.75, Q_vol: 1e-3 });
    expect(r.outlet.P).toBe(5e5);
  });

  it('temperature unchanged (liquid assumption)', () => {
    const r = pumpModel(inlet, { P_out: 5e5, eta: 0.75, Q_vol: 1e-3 });
    expect(r.outlet.T).toBe(300);
  });

  it('composition unchanged', () => {
    const r = pumpModel(inlet, { P_out: 5e5, eta: 0.75, Q_vol: 1e-3 });
    expect(r.outlet.F['A']).toBeCloseTo(1.0, 8);
  });
});

describe('F14.4 — compModel golden tests', () => {
  // Hand-calculated: N=1 mol/s, T₁=300K, P₁=1e5, P₂=3e5, γ=1.4, η=0.8
  //   ratio = 3, exp = (γ-1)/γ = 0.4/1.4 = 0.28571
  //   ratio^exp = 3^0.28571 = e^(0.28571×ln3) = e^0.3139 ≈ 1.3683
  //   T₂ = 300 × (1 + (1.3683-1)/0.8) = 300 × 1.4604 = 438.1 K
  //   W = (1.4×8.314×300/0.4) × 1 × (1.3683-1)/0.8 = 8729.7 × 0.4604 = 4019 W

  it('T_out: 300K → ~438 K (3:1 compression, γ=1.4, η=0.8)', () => {
    const r = compModel(inlet, { P_out: 3e5, eta: 0.8, gamma: 1.4 });
    expect(r.outlet.T).toBeCloseTo(438.1, 0);
  });

  it('shaft work ≈ 4019 W for 1 mol/s of ideal gas', () => {
    const r = compModel(inlet, { P_out: 3e5, eta: 0.8, gamma: 1.4 });
    expect(r.W_shaft).toBeCloseTo(4019, -1); // within 10 W tolerance
  });

  it('outlet pressure equals P_out', () => {
    const r = compModel(inlet, { P_out: 3e5, eta: 0.8, gamma: 1.4 });
    expect(r.outlet.P).toBe(3e5);
  });

  it('composition unchanged', () => {
    const r = compModel(inlet, { P_out: 3e5, eta: 0.8, gamma: 1.4 });
    expect(r.outlet.F['A']).toBeCloseTo(1.0, 8);
  });
});

describe('F14.4 — valveModel golden tests', () => {
  // Hand-calculated: isenthalpic, ideal gas → T unchanged; P drops to P_out
  const highP: ProcessStream = { F: { A: 1.0 }, T: 400, P: 5e5 };

  it('temperature unchanged (isenthalpic ideal gas)', () => {
    const r = valveModel(highP, { P_out: 1e5 });
    expect(r.outlet.T).toBe(400);
  });

  it('outlet pressure equals P_out', () => {
    const r = valveModel(highP, { P_out: 1e5 });
    expect(r.outlet.P).toBe(1e5);
  });

  it('W_shaft = 0 (no shaft work)', () => {
    const r = valveModel(highP, { P_out: 1e5 });
    expect(r.W_shaft).toBe(0);
  });

  it('composition unchanged', () => {
    const r = valveModel(highP, { P_out: 1e5 });
    expect(r.outlet.F['A']).toBeCloseTo(1.0, 8);
  });
});
