import { describe, it, expect } from 'vitest';
import { cstrModel, pfrModel } from '../unitModels';
import type { UnitParams } from '../unitModels';
import type { Stream } from '../../types/stream';

// Minimal chemistry: isothermal first-order A→R with k=0 (no reaction) for pure heat-transfer tests
const makeChemistry = (k = 0) => ({
  reactions: [{
    id: 'r1',
    label: 'A → R',
    stoichiometry: { A: -1, R: 1 },
    rateLaw: (_C: Record<string, number>, _T: number, _p: Record<string, number>) => k * (_C['A'] ?? 0),
    kineticParams: { k },
  }],
  species: [{ id: 'A', label: 'A' }, { id: 'R', label: 'R' }],
  keyReactantId: 'A',
  thermo: {
    deltaH: (_rxnId: string, _T: number) => -50,   // kJ/mol
    rhoCp: (_C: unknown, _T: number) => 4.0,        // kJ/(L·K)
  },
  initialConcentrations: undefined,
});

// Feed: 1 mol/s A, Ca0=1 mol/L → Q_vol = 1 L/s
const inlet: Stream = { F: { A: 1.0, R: 0.0 }, T: 400, P: 101325 };

const baseParams: UnitParams = {
  tau: 1.0,          // s — so V = 1 L (τ × Q_vol)
  thermalMode: 'cooled-detailed',
  Tc: 300,           // Tc fallback (should not be used in detailed mode)
  kappa_v: 0,        // not used in detailed mode
  Ca0: 1.0,
};

describe('F17 — Detailed Heat Exchange (NTU/ε model)', () => {
  /**
   * CSTR jacketed cooling, no reaction (k=0), pure heat-transfer:
   *   T_in = 400 K, Tc_in = 300 K
   *   UA = 2 kJ/(s·K), ṁ_c·Cp_c = 4 kJ/(s·K), τ = 1 s, Q_vol = 1 L/s, V = 1 L
   *   NTU = UA / (ṁ_c·Cp_c) = 2/4 = 0.5
   *   ε   = 1 − exp(−0.5) ≈ 0.39347
   *   Q̇  = ṁ_c·Cp_c·ε·(T−Tc_in)  →  κ_v_eff = ṁ_c·Cp_c·ε / V = 4×0.39347 / 1 = 1.5739
   *   T_out = (ρCp·T_in + κ_v_eff·τ·Tc_in) / (ρCp + κ_v_eff·τ)
   *         = (4×400 + 1.5739×300) / (4 + 1.5739)
   *         = 2072.17 / 5.5739 ≈ 371.75 K
   */
  it('CSTR jacketed — T_out matches NTU/ε hand calculation', () => {
    const params: UnitParams = {
      ...baseParams,
      UA: 2.0,
      mdot_c_Cp_c: 4.0,
      Tc_in: 300,
    };
    const { outlet } = cstrModel(inlet, params, makeChemistry(0) as ReturnType<typeof makeChemistry>);
    expect(outlet.T).toBeCloseTo(371.75, 0);
  });

  /**
   * CSTR large ṁ_c·Cp_c (≈ constant-Tc limit):
   *   NTU = UA/C_c = 2/1000 ≈ 0.002 → ε ≈ 0.002 → Q̇ ≈ UA·(T−Tc_in)
   *   κ_v_eff ≈ UA/V = 2/1 = 2 kJ/(L·s·K)
   *   T_out = (4×400 + 2×300) / (4 + 2) = 2200/6 ≈ 366.67 K
   */
  it('CSTR large coolant flow recovers constant-Tc behaviour', () => {
    const params: UnitParams = {
      ...baseParams,
      UA: 2.0,
      mdot_c_Cp_c: 1000.0,   // ṁ_c → ∞
      Tc_in: 300,
    };
    const { outlet } = cstrModel(inlet, params, makeChemistry(0) as ReturnType<typeof makeChemistry>);
    // κ_v_eff → UA/V = 2 → T_out → (4×400 + 2×300) / 6 ≈ 366.67
    expect(outlet.T).toBeCloseTo(366.67, 0);
  });

  /**
   * PFR co-current, no reaction:
   *   T_in = 400 K, Tc_in = 300 K
   *   Ua = 1 kJ/(L·s·K), ṁ_c·Cp_c = 2 kJ/(s·K), Q_vol = 1 L/s, τ = 2 s, ρCp = 4 kJ/(L·K)
   *
   *   System: dT/dτ = -(T-Tc)/4,  dTc/dτ = +(T-Tc)/2
   *   θ = T − Tc:  dθ/dτ = −3θ/4  →  θ(τ) = 100·exp(−3τ/4)
   *   Conservation: 4T + 2Tc = 4×400 + 2×300 = 2200
   *   At τ=2: θ = 100·exp(−1.5) ≈ 22.31 K
   *           6T − 2θ = 2200  →  T = (2200 + 2×22.31)/6 ≈ 374.10 K
   */
  it('PFR co-current — T_out matches analytic solution', () => {
    const params: UnitParams = {
      ...baseParams,
      tau: 2.0,
      Ua: 1.0,
      mdot_c_Cp_c: 2.0,
      Tc_in: 300,
      hx_flow: 'co-current',
    };
    const { outlet, profile } = pfrModel(inlet, params, makeChemistry(0) as ReturnType<typeof makeChemistry>);
    expect(outlet.T).toBeCloseTo(374.1, 0);
    // Profile should carry Tc values
    const hasTc = profile.some((pt) => pt.Tc !== undefined);
    expect(hasTc).toBe(true);
  });

  /**
   * PFR counter-current, no reaction:
   *   Same parameters as co-current above.
   *   System: dT/dτ = -(T-Tc)/4,  dTc/dτ = -(T-Tc)/2  [−sign for counter-current]
   *   θ = T − Tc:  dθ/dτ = +θ/4  →  θ(τ) = θ_0·exp(τ/4)
   *   Conservation: 4T − 2Tc = const = 4×400 − 2×Tc(0)
   *   BC: Tc(2) = 300 K, θ(2) = θ_0·exp(0.5) = T_out − 300
   *   Solving: Tc(0) ≈ 356.5 K, T_out ≈ 371.75 K
   *   Counter-current achieves slightly better cooling than co-current.
   */
  it('PFR counter-current — T_out lower than co-current', () => {
    const params: UnitParams = {
      ...baseParams,
      tau: 2.0,
      Ua: 1.0,
      mdot_c_Cp_c: 2.0,
      Tc_in: 300,
      hx_flow: 'counter-current',
    };
    const { outlet } = pfrModel(inlet, params, makeChemistry(0) as ReturnType<typeof makeChemistry>);
    // Counter-current T_out ≈ 371.75 K — must be below co-current 374.1 K
    expect(outlet.T).toBeCloseTo(371.75, 0);
    expect(outlet.T).toBeLessThan(374.1);
  });
});
