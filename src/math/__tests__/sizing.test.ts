import { describe, it, expect } from 'vitest';
import { computeSizing, F_SAFETY, RHO_LIQ, K_SB, R_GAS } from '../sizing';
import type { Stream } from '../../types/stream';

// Helper stream factory
const stream = (F: Record<string, number>, T = 350, P = 101325): Stream => ({ F, T, P });

// ─── CSTR volume ──────────────────────────────────────────────────────────────

describe('CSTR sizing', () => {
  it('computes V_design and D for generic species A', () => {
    // hand-calc:
    //   F = 1 mol/s, MW_avg = 100 g/mol (fallback), ρ_liq = 1000 kg/m³
    //   Q_vol = 1 × 100e-3 / 1000 = 1e-4 m³/s
    //   V = 1e-4 × 100 = 0.01 m³
    //   V_design = 1.2 × 0.01 = 0.012 m³
    //   D = cbrt(4 × 0.012 / (3π)) = cbrt(0.016/π) = cbrt(0.005093) = 0.17198 m
    const nodes = [{ id: 'r1', type: 'cstr', data: { tau: 100 } }];
    const edges = [
      { id: 'e0', source: 'feed', target: 'r1' },
    ];
    const streams: Record<string, Stream> = {
      e0: stream({ A: 1 }, 350, 101325),
    };

    const res = computeSizing(nodes, edges, streams);
    const r = res['r1'];
    expect(r).toBeDefined();

    // V_design = 0.012 m³
    expect(r.V_design_m3).toBeCloseTo(0.012, 5);

    // D = cbrt(4 × 0.012 / (3π)) ≈ 0.17198 m
    expect(r.D_m).toBeCloseTo(0.17198, 3);

    // L = 3 × D
    expect(r.L_m).toBeCloseTo(3 * r.D_m!, 5);

    // wall thickness at atmospheric P is dominated by corrosion allowance (0.003 m)
    expect(r.t_wall_m).toBeGreaterThan(0.003);
    expect(r.t_wall_m).toBeLessThan(0.004);

    expect(r.thickWallFlag).toBe(false); // 0.003 ≪ D/10 ≈ 0.017
  });

  it('F_SAFETY of 1.2 applies to working volume', () => {
    const nodes = [{ id: 'r1', type: 'cstr', data: { tau: 60 } }];
    const edges = [{ id: 'e0', source: 'f', target: 'r1' }];
    const streams = { e0: stream({ A: 1 }) };
    const res = computeSizing(nodes, edges, streams);
    // V = Q × τ; V_design = 1.2 × V
    const Q = 1 * 100e-3 / RHO_LIQ; // 1e-4 m³/s
    const V = Q * 60;
    expect(res['r1'].V_design_m3).toBeCloseTo(F_SAFETY * V, 8);
  });

  it('flags thick wall when vessel P is very high', () => {
    // At P = 50 MPa, thin-wall formula gives t ≈ P×D/(2S) ≫ D/10
    const nodes = [{ id: 'r1', type: 'cstr', data: { tau: 1000 } }];
    const edges = [{ id: 'e0', source: 'f', target: 'r1' }];
    const streams = { e0: stream({ A: 1 }, 350, 50e6) }; // 500 bar
    const res = computeSizing(nodes, edges, streams);
    expect(res['r1'].thickWallFlag).toBe(true);
  });
});

// ─── PFR sizing ───────────────────────────────────────────────────────────────

describe('PFR sizing', () => {
  it('uses L/D = 10 (tubular) geometry', () => {
    const nodes = [{ id: 'p1', type: 'pfr', data: { tau: 100 } }];
    const edges = [{ id: 'e0', source: 'f', target: 'p1' }];
    const streams = { e0: stream({ A: 1 }) };
    const res = computeSizing(nodes, edges, streams);
    const r = res['p1'];
    // L/D = 10 → L ≈ 10 × D
    expect(r.L_m! / r.D_m!).toBeCloseTo(10, 5);
  });
});

// ─── Fixed bed sizing ─────────────────────────────────────────────────────────

describe('FixedBed sizing', () => {
  it('sizes from W_cat and rho_bulk', () => {
    // hand-calc: W_cat = 10 kg, rho_bulk = 500 kg/m³
    // V_bed = 10 / 500 = 0.02 m³
    // V_design = 1.2 × 0.02 = 0.024 m³
    // D = cbrt(4 × 0.024 / (3π)) = cbrt(0.032/π) ≈ cbrt(0.010186) ≈ 0.2172 m
    const nodes = [{ id: 'fb', type: 'fixedbed', data: { W_cat: 10, rho_bulk: 500 } }];
    const edges = [{ id: 'e0', source: 'f', target: 'fb' }];
    const streams = { e0: stream({ A: 1 }) };
    const res = computeSizing(nodes, edges, streams);
    const r = res['fb'];
    expect(r.V_design_m3).toBeCloseTo(0.024, 5);
    expect(r.D_m).toBeCloseTo(Math.cbrt(4 * 0.024 / (3 * Math.PI)), 4);
    expect(r.sizeUnit).toBe('m³');
  });
});

// ─── Flash drum (Souders-Brown) ───────────────────────────────────────────────

describe('Flash drum sizing', () => {
  it('computes drum diameter via Souders-Brown with H₂ vapor', () => {
    // hand-calc:
    //   F_vap = 1 mol/s, MW_H₂ = 2.016 g/mol, P = 101325 Pa, T = 350 K
    //   ρ_V = 101325 × 2.016e-3 / (8.314 × 350) = 204.27 / 2909.9 = 0.07018 kg/m³
    //   ρ_L = 1000 kg/m³
    //   u_max = 0.107 × √((1000 − 0.07018)/0.07018) = 0.107 × √14248 = 0.107 × 119.37 = 12.77 m/s
    //   Q_vap = 1 × 2.016e-3 / 0.07018 = 0.02872 m³/s
    //   D = 2 × √(0.02872 / (π × 12.77)) = 2 × √(0.000716) = 2 × 0.02677 = 0.05354 m
    const nodeFlash = { id: 'fl', type: 'flash', data: {} };
    const edges = [
      { id: 'ein',    source: 'f',  target: 'fl'                          },
      { id: 'evap',   source: 'fl', target: 'sink1', sourceHandle: 'out-vapor'  },
      { id: 'eliq',   source: 'fl', target: 'sink2', sourceHandle: 'out-liquid' },
    ];
    const T = 350, P = 101325;
    const MWh2 = 2.016; // g/mol
    const rho_V = P * MWh2 * 1e-3 / (R_GAS * T);
    const u_max = K_SB * Math.sqrt((RHO_LIQ - rho_V) / rho_V);
    const Q_vap = 1 * MWh2 * 1e-3 / rho_V;
    const D_expected = 2 * Math.sqrt(Q_vap / (Math.PI * u_max));

    const streams: Record<string, Stream> = {
      ein:  stream({ H2: 1 }, T, P),
      evap: stream({ H2: 1 }, T, P),
      eliq: stream({ H2: 0.001 }, T, P),
    };
    const res = computeSizing([nodeFlash], edges, streams);
    expect(res['fl'].D_m).toBeCloseTo(D_expected, 3);
    expect(res['fl'].L_m).toBeCloseTo(3 * D_expected, 3);
  });
});

// ─── Pump & Compressor ────────────────────────────────────────────────────────

describe('Pump sizing', () => {
  it('computes shaft power from ΔP and volumetric flow', () => {
    // hand-calc: A @ 1 mol/s, MW=100, ρ=1000 → Q_vol = 1e-4 m³/s
    //   ΔP = 2e5 Pa → power = 1e-4 × 2e5 / 0.75 = 26.67 W = 0.02667 kW
    const nodes = [{ id: 'pu', type: 'pump', data: { P_out: 201325 } }];
    const edges = [{ id: 'e0', source: 'f', target: 'pu' }];
    const streams = { e0: stream({ A: 1 }, 350, 101325) };
    const res = computeSizing(nodes, edges, streams);
    // Q_vol = 1e-4 m³/s; ΔP = 201325-101325 = 1e5 Pa
    const Q_vol = 1e-4;
    const expected_kW = Q_vol * 1e5 / 0.75 / 1000;
    expect(res['pu'].power_kW).toBeCloseTo(expected_kW, 4);
  });
});

describe('Compressor sizing', () => {
  it('computes adiabatic shaft power for 3:1 compression ratio', () => {
    // A @ 1 mol/s, T_in = 300 K, P_in = 1e5, P_out = 3e5, γ = 1.4, η = 0.72
    // exp = (γ-1)/γ = 0.4/1.4 = 0.2857
    // W_mol = R×T×γ/(γ-1) × (3^exp - 1) = 8.314×300×3.5 × (3^0.2857 - 1)
    //       = 8730 × (1.3691 - 1) = 8730 × 0.3691 = 3222 J/mol
    // power = 1 mol/s × 3222 / 0.72 = 4475 W = 4.475 kW
    const nodes = [{ id: 'co', type: 'comp', data: { P_out: 3e5 } }];
    const edges = [{ id: 'e0', source: 'f', target: 'co' }];
    const streams = { e0: stream({ A: 1 }, 300, 1e5) };
    const res = computeSizing(nodes, edges, streams);
    const gamma = 1.4;
    const eta   = 0.72;
    const exp   = (gamma - 1) / gamma;
    const W_mol = R_GAS * 300 * gamma / (gamma - 1) * (Math.pow(3, exp) - 1);
    const kW    = W_mol / (eta * 1000);
    expect(res['co'].power_kW).toBeCloseTo(kW, 2);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('computeSizing edge cases', () => {
  it('skips utility nodes (mixer, splitter, feed, product)', () => {
    const nodes = [
      { id: 'm', type: 'mixer',    data: {} },
      { id: 's', type: 'splitter', data: {} },
      { id: 'f', type: 'feed',     data: {} },
      { id: 'p', type: 'product',  data: {} },
    ];
    const res = computeSizing(nodes, [], {});
    expect(Object.keys(res)).toHaveLength(0);
  });

  it('skips equipment nodes with no stream data', () => {
    const nodes = [{ id: 'r', type: 'cstr', data: { tau: 60 } }];
    const res = computeSizing(nodes, [{ id: 'e0', source: 'f', target: 'r' }], {});
    // edge e0 not in streams → skip
    expect(res['r']).toBeUndefined();
  });
});
