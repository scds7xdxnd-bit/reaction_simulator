/**
 * F22 — Equipment Costing (pure math, zero React/Zustand imports)
 *
 * AACE Class-5 (±40 %) screening-level cost estimation using Turton module method.
 * Reference: Turton et al. "Analysis, Synthesis, and Design of Chemical Processes",
 *            4th ed., Table A.1 (purchase cost) and Table A.5 (bare-module factors).
 *
 * All purchase costs in 2001 USD (Turton reference year, CEPCI = 397).
 * Scale to current year via user-supplied CEPCI.
 */

import type { SizingResult } from './sizing';

// ─── Turton K-coefficients & bare-module factors ──────────────────────────────

interface TurtonEntry {
  K1: number; K2: number; K3: number;
  Fbm: number;    // bare-module factor (carbon steel)
  Smin: number;   // valid range lower bound
  Smax: number;   // valid range upper bound
}

const TURTON: Record<string, TurtonEntry> = {
  //                     K1       K2       K3      Fbm    Smin   Smax   S unit
  vessel:   { K1: 3.4974, K2:  0.4485, K3:  0.1074, Fbm: 4.16, Smin: 0.3,  Smax: 520  },  // m³
  hx:       { K1: 4.1884, K2: -0.2503, K3:  0.1974, Fbm: 3.17, Smin: 10,   Smax: 1000 },  // m²
  pump:     { K1: 3.3892, K2:  0.0536, K3:  0.1538, Fbm: 3.30, Smin: 1,    Smax: 300  },  // kW
  comp:     { K1: 2.2897, K2:  1.3604, K3: -0.1027, Fbm: 2.50, Smin: 450,  Smax: 3000 },  // kW
  valve:    { K1: 3.8696, K2:  0.3865, K3:  0.0000, Fbm: 1.00, Smin: 0.01, Smax: 10   },  // kW
};

const CEPCI_REF     = 397;  // Turton 4th ed reference (year 2001)
export const CEPCI_DEFAULT = 800;  // approximate 2024 value

function turtonKey(nodeType: string): string {
  if (['cstr', 'pfr', 'fixedbed', 'batch', 'semibatch', 'flash'].includes(nodeType))
    return 'vessel';
  if (nodeType === 'hx')    return 'hx';
  if (nodeType === 'pump')  return 'pump';
  if (nodeType === 'comp')  return 'comp';
  if (nodeType === 'valve') return 'valve';
  return 'vessel'; // fallback
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CostResult {
  nodeId:    string;
  nodeType:  string;
  key:       string;    // Turton entry key
  S:         number;    // size parameter used (clamped to valid range)
  Cp0_USD:   number;    // bare equipment cost [2001 USD]
  Cp_USD:    number;    // bare equipment cost [current-year USD]
  Cbm_USD:   number;    // bare-module cost [current-year USD]
  clamped:   boolean;   // true if S was outside Turton valid range
}

export interface UtilityCosts {
  heat_kW:      number;  // total heat duty (absolute) [kW]
  cool_kW:      number;  // total cooling duty (absolute) [kW]
  power_kW:     number;  // total shaft power [kW]
  // prices
  steam_USD_GJ:   number;   // default 6
  cooling_USD_GJ: number;   // default 0.1
  elec_USD_kWh:   number;   // default 0.08
  op_hr_yr:       number;   // operating hours per year (default 8000)
}

export interface EconomicInputs {
  costs:          CostResult[];
  utilities:      UtilityCosts;
  product_mol_s:  number;   // total product molar flow [mol/s]
  product_USD_mol: number;  // product price [$/mol]
  feed_mol_s:     number;   // total feed molar flow [mol/s]
  feed_USD_mol:   number;   // feed price [$/mol]
  plant_life_yr:  number;   // default 10
}

export interface EconomicSummary {
  totalModule_USD:    number;  // 1.18 × Σ Cbm (Turton Eq. 16.16)
  annualCapital_USD:  number;  // totalModule / plant_life
  annualUtility_USD:  number;
  annualProduct_USD:  number;
  annualFeed_USD:     number;
  EP_USD_yr:          number;  // Economic Potential [$/yr]
}

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Compute Turton bare-module cost for one equipment node.
 *
 * @param sizing  output of computeSizing for this node
 * @param cepci   current CEPCI index (default 800 ≈ 2024)
 */
export function costNode(sizing: SizingResult, cepci = CEPCI_DEFAULT): CostResult {
  const key    = turtonKey(sizing.nodeType);
  const tp     = TURTON[key];
  const S_raw  = sizing.sizeParam;
  const clamped = S_raw < tp.Smin || S_raw > tp.Smax;
  const S      = Math.min(Math.max(S_raw, tp.Smin), tp.Smax);

  const logS   = Math.log10(S);
  const logCp  = tp.K1 + tp.K2 * logS + tp.K3 * logS * logS;
  const Cp0    = Math.pow(10, logCp);              // USD (2001)
  const Cp     = Cp0 * cepci / CEPCI_REF;          // USD (current)
  const Cbm    = Cp * tp.Fbm;

  return {
    nodeId: sizing.nodeId, nodeType: sizing.nodeType, key, S,
    Cp0_USD: Cp0, Cp_USD: Cp, Cbm_USD: Cbm, clamped,
  };
}

/**
 * Compute annual utility costs from sizing results.
 *
 * @param sizings all equipment sizing results
 * @param params  utility prices + operating schedule
 */
export function calcUtilityCosts(
  sizings: SizingResult[],
  params: Omit<UtilityCosts, 'heat_kW' | 'cool_kW' | 'power_kW'> & Partial<Pick<UtilityCosts, 'heat_kW' | 'cool_kW' | 'power_kW'>>,
): UtilityCosts & { annual_USD: number } {
  const heat_kW  = params.heat_kW  ?? sizings.reduce((s, r) => s + (r.Q_kW ?? 0), 0);
  const cool_kW  = params.cool_kW  ?? heat_kW; // assume heat in = heat out in steady state
  const power_kW = params.power_kW ?? sizings.reduce((s, r) => s + (r.power_kW ?? 0), 0);

  const { steam_USD_GJ, cooling_USD_GJ, elec_USD_kWh, op_hr_yr } = params;

  // 1 kW × 1 hr = 3.6e-3 GJ
  const annual_USD =
    heat_kW  * op_hr_yr * 3.6e-3 * steam_USD_GJ    +
    cool_kW  * op_hr_yr * 3.6e-3 * cooling_USD_GJ  +
    power_kW * op_hr_yr * elec_USD_kWh;

  return { heat_kW, cool_kW, power_kW, steam_USD_GJ, cooling_USD_GJ, elec_USD_kWh, op_hr_yr, annual_USD };
}

/**
 * Compute Economic Potential:
 *   EP = product revenue − feed cost − utility cost − annualised capital
 *
 * @param inputs  see EconomicInputs
 */
export function calcEP(inputs: EconomicInputs): EconomicSummary {
  const totalModule_USD = 1.18 * inputs.costs.reduce((s, c) => s + c.Cbm_USD, 0);
  const annualCapital_USD = totalModule_USD / Math.max(inputs.plant_life_yr, 1);

  const { op_hr_yr, steam_USD_GJ, cooling_USD_GJ, elec_USD_kWh } = inputs.utilities;
  const secs = op_hr_yr * 3600; // s/yr

  const annualProduct_USD = inputs.product_mol_s * secs * inputs.product_USD_mol;
  const annualFeed_USD    = inputs.feed_mol_s    * secs * inputs.feed_USD_mol;

  const annualUtility_USD =
    inputs.utilities.heat_kW  * op_hr_yr * 3.6e-3 * steam_USD_GJ    +
    inputs.utilities.cool_kW  * op_hr_yr * 3.6e-3 * cooling_USD_GJ  +
    inputs.utilities.power_kW * op_hr_yr * elec_USD_kWh;

  const EP_USD_yr = annualProduct_USD - annualFeed_USD - annualUtility_USD - annualCapital_USD;

  return { totalModule_USD, annualCapital_USD, annualUtility_USD, annualProduct_USD, annualFeed_USD, EP_USD_yr };
}
