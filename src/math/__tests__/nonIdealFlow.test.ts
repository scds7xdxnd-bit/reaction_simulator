import { describe, it, expect } from 'vitest';
import {
  axialDispersionConversion,
  segregationConversion,
  thieleModulus,
  effectivenessFactor,
  mearsCriterion,
  catalystActivity,
} from '../nonIdealFlowModels';

// ─── F19.1: Axial dispersion ─────────────────────────────────────────────────

describe('F19.1 — axialDispersionConversion', () => {
  // Limits check: Pe→∞ recovers PFR, Pe→0 recovers CSTR
  it('Pe→∞ limit recovers plug-flow PFR conversion', () => {
    // Da=1, Pe=1e6 → X ≈ 1-exp(-1) ≈ 0.6321
    const X_pfr = axialDispersionConversion(1.0, 1e6);
    expect(X_pfr).toBeCloseTo(1 - Math.exp(-1), 4);
  });

  it('Pe→0 limit recovers CSTR conversion', () => {
    // Da=1, Pe=0.001 → X ≈ 1/(1+1) = 0.5
    const X_cstr = axialDispersionConversion(1.0, 0.001);
    expect(X_cstr).toBeCloseTo(0.5, 2);
  });

  // Hand-calculated value: Da=1, Pe=10
  // α = √(1 + 4×1/10) = √1.4 ≈ 1.18322
  // X = 1 − 4α·exp(Pe/2) / [(1+α)²·exp(αPe/2) − (1−α)²·exp(−αPe/2)]
  //   = 1 − 4×1.18322×exp(5) / [(2.18322)²×exp(5.9161) − (−0.18322)²×exp(−5.9161)]
  //   exp(5)=148.413, exp(5.9161)=369.76, exp(-5.9161)=0.002706
  //   num = 4×1.18322×148.413 = 702.16
  //   denom = 4.7664×369.76 − 0.03357×0.002706 = 1762.2 − 9.09e-5 ≈ 1762.2
  //   X ≈ 1 - 702.16/1762.2 ≈ 1 - 0.3984 ≈ 0.6016
  it('hand-calculated value: Da=1, Pe=10 → X≈0.602', () => {
    const X = axialDispersionConversion(1.0, 10);
    // Between PFR (0.632) and CSTR (0.5), closer to PFR
    expect(X).toBeGreaterThan(0.50);
    expect(X).toBeLessThan(0.633);
    expect(X).toBeCloseTo(0.602, 1);
  });

  // Monotonicity: increasing Pe (less dispersion) → higher X (closer to PFR)
  it('higher Pe gives higher conversion (less back-mixing)', () => {
    const X_low = axialDispersionConversion(1.0, 5);
    const X_mid = axialDispersionConversion(1.0, 50);
    const X_pfr = axialDispersionConversion(1.0, 1e5);
    expect(X_low).toBeLessThan(X_mid);
    expect(X_mid).toBeLessThan(X_pfr);
  });
});

// ─── F19.2: Segregation model ─────────────────────────────────────────────────

describe('F19.2 — segregationConversion', () => {
  // For 1st-order kinetics, X_seg = X_CSTR = Da/(1+Da) — segregation invariance
  // X_batch(t) = 1 - exp(-k*t), tau=1, k=1 → Da=1 → X_CSTR=0.5
  it('1st-order kinetics: segregation = CSTR conversion (invariance)', () => {
    const k = 1.0;
    const tau = 1.0;
    const X_batch = (t: number) => 1 - Math.exp(-k * t);
    const X_seg = segregationConversion(X_batch, tau, 2000);
    // Should be close to 0.5 (CSTR: Da/(1+Da) = 1/2)
    expect(X_seg).toBeCloseTo(0.5, 2);
  });

  // For 2nd-order kinetics, segregated X > CSTR X (higher local Ca → faster reaction):
  // X_batch(t) = k·Ca0·t/(1+k·Ca0·t) = t/(1+t)  for k=Ca0=1
  // CSTR: X/τ = k·(1-X)² → X/2 = (1-X)² → 2X²-5X+2=0 → X=(5-3)/4=0.5  (discriminant=9, not 17)
  // Segregated gives X_seg ≈ 0.549 > 0.5 = X_CSTR (n>1 → segregation gives higher conversion)
  it('2nd-order kinetics: segregated conversion > CSTR (maximum-segregation result)', () => {
    const k = 1.0;
    const Ca0 = 1.0;
    const tau = 2.0;
    const X_batch = (t: number) => (k * Ca0 * t) / (1 + k * Ca0 * t);
    const X_seg = segregationConversion(X_batch, tau, 2000);
    // CSTR for 2nd order: 2X²-5X+2=0 → X=(5-√9)/4 = 0.5
    const X_cstr = 0.5;
    expect(X_seg).toBeGreaterThan(X_cstr);
    expect(X_seg).toBeLessThan(0.65); // bounded above: can't exceed PFR
  });

  it('zero rate → zero conversion', () => {
    const X_seg = segregationConversion(() => 0, 1.0);
    expect(X_seg).toBeCloseTo(0, 6);
  });
});

// ─── F19.3: Thiele modulus & effectiveness factor ─────────────────────────────

describe('F19.3 — thieleModulus', () => {
  // φ = R_p × √(k_mass × ρ_cat / D_e)
  // R_p=1e-3 m, k_mass=1e-6 m³/(kg·s), ρ_cat=1500 kg/m³, D_e=1e-9 m²/s
  // k_vol = k_mass × ρ_cat = 1e-6 × 1500 = 1.5e-3 [1/s]
  // φ = 1e-3 × √(1.5e-3 / 1e-9) = 1e-3 × √(1.5e6) ≈ 1e-3 × 1224.7 ≈ 1.2247
  it('computes Thiele modulus correctly', () => {
    const phi = thieleModulus(1e-3, 1e-6, 1500, 1e-9);
    expect(phi).toBeCloseTo(1.2247, 3);
  });

  it('zero diffusivity clamps to large modulus (not NaN)', () => {
    const phi = thieleModulus(1e-3, 1.0, 1500, 0);
    expect(isFinite(phi)).toBe(true);
    expect(phi).toBeGreaterThan(1e10);
  });
});

describe('F19.3 — effectivenessFactor', () => {
  // φ→0: η→1 (kinetics-limited, no diffusion resistance)
  it('φ≈0 → η≈1', () => {
    expect(effectivenessFactor(1e-7)).toBeCloseTo(1, 5);
  });

  // φ→∞: η→3/φ (diffusion-limited asymptote)
  it('large φ → η≈3/φ', () => {
    // At φ=1000 the formula gives (3/φ²)(φ·coth(φ)-1) ≈ (3/φ)(1-1/φ) ≈ 3/φ to <0.01%
    const phi = 1000;
    expect(effectivenessFactor(phi)).toBeCloseTo(3 / phi, 4);
  });

  // φ=1: η = (3/1)×(1×coth(1)−1) = 3×(1.3130−1) = 3×0.3130 ≈ 0.9390
  // coth(1) = cosh(1)/sinh(1) = 1.5431/1.1752 ≈ 1.3130
  it('φ=1 → η≈0.939 (hand-calculated)', () => {
    const eta = effectivenessFactor(1.0);
    expect(eta).toBeCloseTo(0.9390, 3);
  });

  // η is strictly decreasing with φ
  it('η decreases as φ increases', () => {
    expect(effectivenessFactor(0.1)).toBeGreaterThan(effectivenessFactor(1.0));
    expect(effectivenessFactor(1.0)).toBeGreaterThan(effectivenessFactor(10.0));
  });

  // η is always in (0, 1]
  it('η is always in (0, 1]', () => {
    for (const phi of [0.01, 0.5, 1.0, 5.0, 50]) {
      const eta = effectivenessFactor(phi);
      expect(eta).toBeGreaterThan(0);
      expect(eta).toBeLessThanOrEqual(1);
    }
  });
});

// ─── F19.3: Mears criterion ───────────────────────────────────────────────────

describe('F19.3 — mearsCriterion', () => {
  // M = r·ρ_b·R_p·n / (k_c·C_Ab)
  // r=0.01 mol/(kg·s), ρ_b=500, R_p=3e-3, n=1, k_c=0.05, C_Ab=1.0
  // M = 0.01×500×3e-3×1 / (0.05×1) = 0.015/0.05 = 0.3 → FAIL (>0.15)
  it('criterion > 0.15 → fails', () => {
    const result = mearsCriterion(0.01, 500, 3e-3, 1, 0.05, 1.0);
    expect(result.value).toBeCloseTo(0.3, 6);
    expect(result.pass).toBe(false);
  });

  // r=0.001 mol/(kg·s), ρ_b=500, R_p=3e-3, n=1, k_c=0.05, C_Ab=1.0
  // M = 0.001×500×3e-3×1 / (0.05×1) = 0.0015/0.05 = 0.03 → PASS (<0.15)
  it('criterion < 0.15 → passes', () => {
    const result = mearsCriterion(0.001, 500, 3e-3, 1, 0.05, 1.0);
    expect(result.value).toBeCloseTo(0.03, 6);
    expect(result.pass).toBe(true);
  });
});

// ─── F19.3: Catalyst deactivation ────────────────────────────────────────────

describe('F19.3 — catalystActivity', () => {
  // 1st-order deactivation: a = exp(-k_d × t)
  it('1st-order: a(0)=1', () => {
    expect(catalystActivity(0, 0.1, 1)).toBeCloseTo(1, 10);
  });

  it('1st-order: a(t) = exp(-k_d·t)', () => {
    // k_d=0.1, t=10 → a = exp(-1) ≈ 0.3679
    expect(catalystActivity(10, 0.1, 1)).toBeCloseTo(Math.exp(-1), 6);
  });

  // 2nd-order: a = [1 - k_d·t]^(-1/(1)) = [1-k_d·t]^(-1) for d=2
  // d=2: a = [1-(d-1)·k_d·t]^(1/(1-d)) = [1-k_d·t]^(-1)
  // k_d=0.1, t=5 → a = [1-0.5]^(-1) = 2? No: [1-(2-1)×0.1×5]^(1/(1-2)) = [1-0.5]^(-1) = 2.0
  it('2nd-order: a(t) matches formula', () => {
    const a = catalystActivity(5, 0.1, 2);
    expect(a).toBeCloseTo(2.0, 6);
  });

  it('activity clamps to 0 after full deactivation', () => {
    // 2nd-order, t so large that base goes negative
    expect(catalystActivity(1000, 0.1, 2)).toBeCloseTo(0, 6);
  });

  it('zero k_d → no deactivation', () => {
    expect(catalystActivity(1000, 0, 1)).toBeCloseTo(1, 10);
  });
});
