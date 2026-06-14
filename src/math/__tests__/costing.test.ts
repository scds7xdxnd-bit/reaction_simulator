import { describe, it, expect } from 'vitest';
import { costNode, calcEP, CEPCI_DEFAULT } from '../costing';
import type { SizingResult } from '../sizing';

function makeSizing(nodeType: string, sizeParam: number, sizeUnit: string): SizingResult {
  return { nodeId: 'n1', nodeType, sizeParam, sizeUnit, notes: [] };
}

describe('costNode — Turton formula', () => {
  it('vertical vessel S=1 m³: verifies log₁₀ formula end-to-end', () => {
    // hand-calc (vessel entry, CEPCI_DEFAULT = 800):
    //   K1=3.4974, K2=0.4485, K3=0.1074, Fbm=4.16, CEPCI_ref=397
    //   log₁₀(S) = log₁₀(1.0) = 0
    //   log₁₀(Cp°) = 3.4974 + 0 + 0 = 3.4974
    //   Cp° = 10^3.4974 = 3143 USD (2001)
    //   Cp  = 3143 × (800/397) = 3143 × 2.01511 = 6332 USD
    //   Cbm = 6332 × 4.16 = 26,341 USD
    const r = costNode(makeSizing('cstr', 1.0, 'm³'), CEPCI_DEFAULT);
    const logS = 0;
    const logCp = 3.4974 + 0.4485 * logS + 0.1074 * logS * logS;
    const Cp0_expected = Math.pow(10, logCp);
    const Cp_expected  = Cp0_expected * CEPCI_DEFAULT / 397;
    const Cbm_expected = Cp_expected * 4.16;
    expect(r.Cp0_USD).toBeCloseTo(Cp0_expected, 0);
    expect(r.Cp_USD).toBeCloseTo(Cp_expected, 0);
    expect(r.Cbm_USD).toBeCloseTo(Cbm_expected, 0);
    expect(r.clamped).toBe(false); // S=1 within [0.3, 520]
  });

  it('HX S=100 m²: verifies negative K2 coefficient', () => {
    // hand-calc (hx entry):
    //   K1=4.1884, K2=-0.2503, K3=0.1974, Fbm=3.17
    //   log₁₀(100) = 2
    //   log₁₀(Cp°) = 4.1884 + (-0.2503)×2 + 0.1974×4 = 4.1884 - 0.5006 + 0.7896 = 4.4774
    //   Cp° = 10^4.4774 = 30001 USD (2001)
    const r = costNode(makeSizing('hx', 100, 'm²'), CEPCI_DEFAULT);
    const logS = Math.log10(100); // = 2
    const logCp = 4.1884 + (-0.2503) * logS + 0.1974 * logS * logS;
    expect(r.Cp0_USD).toBeCloseTo(Math.pow(10, logCp), 0);
    expect(r.clamped).toBe(false); // 100 in [10, 1000]
  });

  it('clamps S below Smin and sets clamped flag', () => {
    // HX Smin = 10; pass S=3 → clamped to 10
    const r = costNode(makeSizing('hx', 3, 'm²'), CEPCI_DEFAULT);
    expect(r.S).toBeCloseTo(10, 5); // clamped to Smin
    expect(r.clamped).toBe(true);
  });

  it('pump: computes power-based cost', () => {
    // pump: K1=3.3892, K2=0.0536, K3=0.1538, Fbm=3.30, range [1,300] kW
    const r = costNode(makeSizing('pump', 10, 'kW'), CEPCI_DEFAULT);
    const logS = Math.log10(10); // = 1
    const logCp = 3.3892 + 0.0536 * logS + 0.1538 * logS * logS;
    expect(r.Cp0_USD).toBeCloseTo(Math.pow(10, logCp), 0);
    expect(r.key).toBe('pump');
  });
});

describe('calcEP', () => {
  it('EP = product − feed − utility − capital (all-zero baseline)', () => {
    const ep = calcEP({
      costs: [],
      utilities: { heat_kW: 0, cool_kW: 0, power_kW: 0, steam_USD_GJ: 6, cooling_USD_GJ: 0.1, elec_USD_kWh: 0.08, op_hr_yr: 8000 },
      product_mol_s: 0, product_USD_mol: 0,
      feed_mol_s: 0, feed_USD_mol: 0,
      plant_life_yr: 10,
    });
    // hand-calc: all zero → EP = 0
    expect(ep.EP_USD_yr).toBeCloseTo(0, 5);
    expect(ep.totalModule_USD).toBeCloseTo(0, 5);
  });

  it('EP with capital cost and product revenue', () => {
    // 1 vessel, Cbm = 50000 USD
    // totalModule = 1.18 × 50000 = 59000 USD
    // annualCapital = 59000 / 10 = 5900 USD/yr
    // product: 1 mol/s × 8000 hr × 3600 s/hr × 0.01 $/mol = 288000 $/yr
    // feed: 0, utility: 0
    // EP = 288000 - 5900 = 282100 $/yr
    const mockCost = { nodeId: 'r', nodeType: 'cstr', key: 'vessel', S: 1, Cp0_USD: 1000, Cp_USD: 2000, Cbm_USD: 50000, clamped: false };
    const ep = calcEP({
      costs: [mockCost],
      utilities: { heat_kW: 0, cool_kW: 0, power_kW: 0, steam_USD_GJ: 6, cooling_USD_GJ: 0.1, elec_USD_kWh: 0.08, op_hr_yr: 8000 },
      product_mol_s: 1, product_USD_mol: 0.01,
      feed_mol_s: 0, feed_USD_mol: 0,
      plant_life_yr: 10,
    });
    // hand-calc:
    //   totalModule = 1.18 × 50000 = 59000
    //   annualCapital = 59000 / 10 = 5900
    //   annualProduct = 1 × 8000 × 3600 × 0.01 = 288000
    //   EP = 288000 - 5900 = 282100
    expect(ep.totalModule_USD).toBeCloseTo(59000, 0);
    expect(ep.annualCapital_USD).toBeCloseTo(5900, 0);
    expect(ep.annualProduct_USD).toBeCloseTo(288000, 0);
    expect(ep.EP_USD_yr).toBeCloseTo(282100, 0);
  });

  it('utility costs: steam + cooling + electricity', () => {
    // 10 kW heat duty, 8000 hr/yr, steam $6/GJ → 10 × 8000 × 3.6e-3 × 6 = 1728 $/yr
    const ep = calcEP({
      costs: [],
      utilities: { heat_kW: 10, cool_kW: 0, power_kW: 0, steam_USD_GJ: 6, cooling_USD_GJ: 0.1, elec_USD_kWh: 0.08, op_hr_yr: 8000 },
      product_mol_s: 0, product_USD_mol: 0,
      feed_mol_s: 0, feed_USD_mol: 0,
      plant_life_yr: 10,
    });
    // annualUtility = 10 × 8000 × 3.6e-3 × 6 = 1728
    expect(ep.annualUtility_USD).toBeCloseTo(1728, 1);
    expect(ep.EP_USD_yr).toBeCloseTo(-1728, 1); // no revenue
  });
});
