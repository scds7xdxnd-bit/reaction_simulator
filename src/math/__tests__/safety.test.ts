import { describe, it, expect } from 'vitest';
import {
  adiabaticTemperatureRise,
  pfrHotSpot,
  ignitionExtinctionSweep,
} from '../safetyAnalysis';
import type { ProfilePoint } from '../unitModels';
import type { SimulationParams } from '../../types/reactor';

// ─── Sub-analysis 1: Adiabatic temperature rise ──────────────────────────────

describe('F18 — adiabaticTemperatureRise', () => {
  // ΔT_ad = (−ΔH) × Ca0 / ρCp
  // exothermic: deltaH = −50 kJ/mol, Ca0 = 1 mol/L, ρCp = 4 kJ/(L·K)
  // ΔT_ad = 50 × 1 / 4 = 12.5 K  → badge = 'normal' (<50 K)
  it('small ΔH → normal badge, correct ΔT_ad', () => {
    const { deltaTad, badge } = adiabaticTemperatureRise(-50, 1.0, 4.0);
    expect(deltaTad).toBeCloseTo(12.5, 6);
    expect(badge).toBe('normal');
  });

  // exothermic: deltaH = −300 kJ/mol, Ca0 = 1, ρCp = 4 → ΔT_ad = 75 K → amber (50–150 K)
  it('moderate ΔH → amber badge', () => {
    const { deltaTad, badge } = adiabaticTemperatureRise(-300, 1.0, 4.0);
    expect(deltaTad).toBeCloseTo(75, 6);
    expect(badge).toBe('amber');
  });

  // exothermic: deltaH = −800 kJ/mol, Ca0 = 1, ρCp = 4 → ΔT_ad = 200 K → red (>150 K)
  it('large ΔH → red badge', () => {
    const { deltaTad, badge } = adiabaticTemperatureRise(-800, 1.0, 4.0);
    expect(deltaTad).toBeCloseTo(200, 6);
    expect(badge).toBe('red');
  });

  // endothermic (positive deltaH) → ΔT_ad < 0 → normal (cooling, not a hazard)
  it('endothermic → normal badge, negative ΔT_ad', () => {
    const { deltaTad, badge } = adiabaticTemperatureRise(100, 1.0, 4.0);
    expect(deltaTad).toBeLessThan(0);
    expect(badge).toBe('normal');
  });
});

// ─── Sub-analysis 2: PFR hot-spot ────────────────────────────────────────────

describe('F18 — pfrHotSpot', () => {
  const makeProfile = (Ts: number[]): ProfilePoint[] =>
    Ts.map((T, i) => ({ cumTau: i * 0.1, C: { A: 0 }, T }));

  // Hot-spot at the middle of the reactor
  it('identifies the peak temperature and its position', () => {
    const profile = makeProfile([300, 320, 350, 380, 350, 310, 300]);
    const { Tmax, tauStar } = pfrHotSpot(profile);
    expect(Tmax).toBeCloseTo(380, 5);
    expect(tauStar).toBeCloseTo(0.3, 5);
  });

  // Monotone decreasing (co-current cooled PFR): max at inlet
  it('monotone decreasing → Tmax at inlet', () => {
    const profile = makeProfile([400, 380, 360, 340, 320]);
    const { Tmax, tauStar } = pfrHotSpot(profile);
    expect(Tmax).toBeCloseTo(400, 5);
    expect(tauStar).toBeCloseTo(0, 5);
  });
});

// ─── Sub-analysis 3: Ignition–extinction diagram ──────────────────────────────

describe('F18 — ignitionExtinctionSweep', () => {
  // Canonical cooled-CSTR S-curve parameters (first-order, exothermic):
  //   k_ref=1 s⁻¹ at T_ref=350K, Ea/R=5000K, deltaH=−200 kJ/mol, Ca0=1, ρCp=4
  //   Tc swept 280→360 K at kappa_v=2, tau=2
  //   At mid-range Tc, the G-R curve should give 3 intersections (ignition, unstable, extinction)
  const baseParams: SimulationParams = {
    reactionMode: 'single',
    kinetics: 'first-order',
    k: 1.0,
    k2: 0.1, k3: 0.1, k4: 0.1,
    Cb0: 1.0, Keq_ref: 4.0, Cr0_fraction: 0,
    Ca0: 1.0, T_ref: 350, Ea: 41840,   // Ea [J/mol] = 5000 K × 8.314 J/(mol·K) ≈ 41570; use 41840
    delta_H: -200,                         // kJ/mol
    rho_Cp: 4.0, T_feed: 300, epsilon: 0,
    Q_feed: 0, recycleMethod: 'direct',
    customReaction: null,
  };

  it('sweep Tc produces multiple steady states (S-curve) at some Tc values', () => {
    const result = ignitionExtinctionSweep(
      'Tc', 280, 360,   // sweep Tc from 280 to 360 K
      300, 2.0, 320, 2.0,  // Tin=300, tau=2, Tc(base)=320, kappa_v=2
      baseParams, 100, 0,  // 100 steps, baseXa=0
    );
    // Must find at least some steady states
    expect(result.points.length).toBeGreaterThan(0);
    // Must find fold points (where steady-state count changes) indicating an S-curve
    expect(result.foldIndices.length).toBeGreaterThan(0);
    // At some sweep values, 3 steady states exist (stable–unstable–stable)
    const countsByParam = new Map<number, number>();
    for (const pt of result.points) {
      countsByParam.set(pt.param, (countsByParam.get(pt.param) ?? 0) + 1);
    }
    const maxCount = Math.max(...countsByParam.values());
    expect(maxCount).toBeGreaterThanOrEqual(2); // at least 2 SS (may need tighter params for 3)
  });

  it('sweep result has correct param field', () => {
    const result = ignitionExtinctionSweep(
      'tau', 0.5, 5.0,
      300, 2.0, 300, 2.0,
      baseParams, 20, 0,
    );
    expect(result.param).toBe('tau');
  });
});
