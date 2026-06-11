// Pure unit-conversion layer — no React or Zustand imports.
// Canonical (SI) base: mol, m³, s, K, Pa, J, kg, W.
// Temperature uses affine closures; all others are linear.

export type Dimension =
  | 'amount'
  | 'volume'
  | 'concentration'
  | 'molar_energy'
  | 'time'
  | 'temperature'
  | 'pressure'
  | 'mass'
  | 'molar_flow'
  | 'power';

export type UnitProfile = 'Teaching' | 'SI' | 'Metric-Engineering';

interface LinearUnit { type: 'linear'; toSI: number }
interface AffineUnit  { type: 'affine'; toSI: (v: number) => number; fromSI: (v: number) => number }
type UnitDef = LinearUnit | AffineUnit;

// All registered units with their SI conversion
const UNITS: Record<string, UnitDef> = {
  // amount → mol
  'mol':    { type: 'linear', toSI: 1 },
  'kmol':   { type: 'linear', toSI: 1e3 },
  'mmol':   { type: 'linear', toSI: 1e-3 },
  // volume → m³
  'm³':     { type: 'linear', toSI: 1 },
  'm3':     { type: 'linear', toSI: 1 },
  'L':      { type: 'linear', toSI: 1e-3 },
  'mL':     { type: 'linear', toSI: 1e-6 },
  // concentration → mol/m³
  'mol/m³': { type: 'linear', toSI: 1 },
  'mol/m3': { type: 'linear', toSI: 1 },
  'mol/L':  { type: 'linear', toSI: 1e3 },  // 1 mol/L = 1000 mol/m³
  'kmol/m³':{ type: 'linear', toSI: 1e3 },
  'kmol/m3':{ type: 'linear', toSI: 1e3 },
  // molar energy → J/mol
  'J/mol':  { type: 'linear', toSI: 1 },
  'kJ/mol': { type: 'linear', toSI: 1e3 },
  // time → s
  's':      { type: 'linear', toSI: 1 },
  'min':    { type: 'linear', toSI: 60 },
  'h':      { type: 'linear', toSI: 3600 },
  // temperature → K (affine for °C and °F)
  'K':      { type: 'linear', toSI: 1 },
  '°C':     { type: 'affine', toSI: (v) => v + 273.15, fromSI: (v) => v - 273.15 },
  '°F':     { type: 'affine', toSI: (v) => (v - 32) * 5/9 + 273.15, fromSI: (v) => (v - 273.15) * 9/5 + 32 },
  // pressure → Pa
  'Pa':     { type: 'linear', toSI: 1 },
  'kPa':    { type: 'linear', toSI: 1e3 },
  'bar':    { type: 'linear', toSI: 1e5 },
  'atm':    { type: 'linear', toSI: 101325 },
  // mass → kg
  'kg':     { type: 'linear', toSI: 1 },
  'g':      { type: 'linear', toSI: 1e-3 },
  // molar flow → mol/s
  'mol/s':  { type: 'linear', toSI: 1 },
  'mol/h':  { type: 'linear', toSI: 1/3600 },
  'kmol/h': { type: 'linear', toSI: 1e3/3600 },
  // power → W
  'W':      { type: 'linear', toSI: 1 },
  'kW':     { type: 'linear', toSI: 1e3 },
};

export function convert(value: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return value;
  const from = UNITS[fromUnit];
  const to   = UNITS[toUnit];
  if (!from) throw new Error(`Unknown unit: "${fromUnit}"`);
  if (!to)   throw new Error(`Unknown unit: "${toUnit}"`);

  const si = from.type === 'linear' ? value * from.toSI : from.toSI(value);
  return to.type === 'linear' ? si / to.toSI : to.fromSI(si);
}

// Canonical SI unit per dimension (the unit convert() treats as × 1 through)
export const SI_UNIT: Record<Dimension, string> = {
  amount:        'mol',
  volume:        'm3',
  concentration: 'mol/m3',
  molar_energy:  'J/mol',
  time:          's',
  temperature:   'K',
  pressure:      'Pa',
  mass:          'kg',
  molar_flow:    'mol/s',
  power:         'W',
};

// Display units per profile — Teaching matches the current UI (tests stay green)
const PROFILE_DISPLAY: Record<UnitProfile, Record<Dimension, string>> = {
  Teaching: {
    amount:        'mol',
    volume:        'L',
    concentration: 'mol/L',
    molar_energy:  'kJ/mol',
    time:          's',
    temperature:   'K',
    pressure:      'Pa',
    mass:          'kg',
    molar_flow:    'mol/s',
    power:         'W',
  },
  SI: {
    amount:        'mol',
    volume:        'm3',
    concentration: 'mol/m3',
    molar_energy:  'kJ/mol',
    time:          's',
    temperature:   'K',
    pressure:      'Pa',
    mass:          'kg',
    molar_flow:    'mol/s',
    power:         'W',
  },
  'Metric-Engineering': {
    amount:        'kmol',
    volume:        'm3',
    concentration: 'kmol/m3',
    molar_energy:  'kJ/mol',
    time:          'h',
    temperature:   '°C',
    pressure:      'bar',
    mass:          'kg',
    molar_flow:    'kmol/h',
    power:         'kW',
  },
};

export function displayUnit(dim: Dimension, profile: UnitProfile): string {
  return PROFILE_DISPLAY[profile][dim];
}

// Format a value given in SI canonical units for the target profile
export function formatQty(
  valueSI: number,
  dim: Dimension,
  profile: UnitProfile,
  fractionDigits = 3,
): string {
  const siUnit   = SI_UNIT[dim];
  const dispUnit = displayUnit(dim, profile);
  const converted = convert(valueSI, siUnit, dispUnit);
  return `${converted.toFixed(fractionDigits)} ${dispUnit}`;
}
