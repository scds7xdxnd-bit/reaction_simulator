import type { SimulationParams } from '../types/reactor';
import type { ReactionMode, KineticsType, CustomReaction } from '../types/simulation';
import type { Species, Reaction, ReactionSet, RateLawFn } from '../types/chemistry';

function arrhenius(k: number, Ea: number, T_ref: number, T: number): number {
  if (Ea <= 0) return k;
  const R_kJ = 8.314e-3;
  return k * Math.exp(Math.max(-30, Math.min(30, (Ea / R_kJ) * (1 / T_ref - 1 / Math.max(T, 50)))));
}

export interface ReactionPreset {
  id: string;
  label: string;
  mode: ReactionMode;
  isSingle: boolean;
  uiLabel: string;
  kinetics?: KineticsType;
  kUnit?: string;

  buildSpecies(params: SimulationParams): Species[];
  buildReactions(params: SimulationParams): ReactionSet;

  computeDa(k: number, tau: number, Ca0: number): number;
}

// ---------------------------------------------------------------------------
// Private presets
// ---------------------------------------------------------------------------

const firstOrderPreset: ReactionPreset = {
  id: 'single-first-order',
  label: 'A → R  (1st order)',
  mode: 'single',
  isSingle: true,
  uiLabel: '1st Order',
  kinetics: 'first-order',
  kUnit: 's⁻¹',

  buildSpecies: () => [
    { id: 'A', label: 'Reactant A' },
    { id: 'R', label: 'Product R' },
  ],

  buildReactions: (params: SimulationParams): ReactionSet => [{
    id: 'rxn-1',
    label: 'A → R',
    stoichiometry: { A: -1, R: +1, S: 0 },
    rateLaw: (C, T, kP) => arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) * (C['A'] ?? 0),
    kineticParams: { k: params.k, Ea: params.Ea, T_ref: params.T_ref },
  }],

  computeDa: (k, tau) => k * tau,
};

const secondOrderPreset: ReactionPreset = {
  id: 'single-second-order',
  label: 'A → R  (2nd order)',
  mode: 'single',
  isSingle: true,
  uiLabel: '2nd Order',
  kinetics: 'second-order',
  kUnit: 'L·mol⁻¹·s⁻¹',

  buildSpecies: () => [
    { id: 'A', label: 'Reactant A' },
    { id: 'R', label: 'Product R' },
  ],

  buildReactions: (params: SimulationParams): ReactionSet => [{
    id: 'rxn-1',
    label: 'A → R',
    stoichiometry: { A: -1, R: +1, S: 0 },
    rateLaw: (C, T, kP) => arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) * (C['A'] ?? 0) ** 2,
    kineticParams: { k: params.k, Ea: params.Ea, T_ref: params.T_ref },
  }],

  computeDa: (k, tau, Ca0) => k * Ca0 * tau,
};

const autocatalyticPreset: ReactionPreset = {
  id: 'single-autocatalytic',
  label: 'A → R  (autocatalytic)',
  mode: 'single',
  isSingle: true,
  uiLabel: 'Autocatalytic',
  kinetics: 'autocatalytic',
  kUnit: 'L·mol⁻¹·s⁻¹',

  buildSpecies: () => [
    { id: 'A', label: 'Reactant A' },
    { id: 'R', label: 'Product R' },
  ],

  buildReactions: (params: SimulationParams): ReactionSet => [{
    id: 'rxn-1',
    label: 'A → R',
    stoichiometry: { A: -1, R: +1, S: 0 },
    rateLaw: (C, T, kP) =>
      arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) *
      (C['A'] ?? 0) *
      ((C['R'] ?? 0) + (kP['Cr0_frac'] ?? 0.01) * (kP['Ca0'] ?? 1)),
    kineticParams: { k: params.k, Ea: params.Ea, T_ref: params.T_ref, Ca0: params.Ca0, Cr0_frac: params.Cr0_fraction },
  }],

  computeDa: (k, tau, Ca0) => k * Ca0 * tau,
};

const reversiblePreset: ReactionPreset = {
  id: 'single-reversible',
  label: 'A ⇌ R  (reversible)',
  mode: 'single',
  isSingle: true,
  uiLabel: 'Reversible A⇌R',
  kinetics: 'reversible',
  kUnit: 's⁻¹',

  buildSpecies: () => [
    { id: 'A', label: 'Reactant A' },
    { id: 'R', label: 'Product R' },
  ],

  buildReactions: (params: SimulationParams): ReactionSet => [{
    id: 'rxn-1',
    label: 'A ⇌ R',
    stoichiometry: { A: -1, R: +1, S: 0 },
    rateLaw: (C, T, kP) => {
      const R_kJ = 8.314e-3;
      const Ea = kP['Ea'] ?? 0;
      const T_ref = kP['T_ref'] ?? 300;
      const k_eff = Ea > 0
        ? (kP['k'] ?? 0) * Math.exp(
            Math.max(-30, Math.min(30, (Ea / R_kJ) * (1 / T_ref - 1 / Math.max(T, 50))))
          )
        : (kP['k'] ?? 0);
      const Keq_ref = kP['Keq_ref'] ?? 4;
      const delta_H = kP['delta_H'] ?? 0;
      const Keq = Keq_ref * Math.exp(
        Math.max(-30, Math.min(30, (-delta_H / R_kJ) * (1 / Math.max(T, 50) - 1 / T_ref)))
      );
      return Math.max(0, k_eff * ((C['A'] ?? 0) - (C['R'] ?? 0) / Math.max(Keq, 1e-9)));
    },
    kineticParams: {
      k: params.k,
      Ea: params.Ea,
      T_ref: params.T_ref,
      Keq_ref: params.Keq_ref,
      delta_H: params.delta_H,
    },
  }],

  computeDa: (k, tau) => k * tau,
};

const gasPhaseFirstOrderPreset: ReactionPreset = {
  id: 'single-gas-phase-1st-order',
  label: 'A → R  (gas-phase, 1st order)',
  mode: 'single',
  isSingle: true,
  uiLabel: 'Gas-Phase 1st Order',
  kinetics: 'gas-phase-1st-order',
  kUnit: 's⁻¹',

  buildSpecies: () => [
    { id: 'A', label: 'Reactant A' },
    { id: 'R', label: 'Product R' },
  ],

  // Rate law is unused for gas-phase — unit models use dedicated gas-phase ODE path.
  // Returned value is rA = k·Ca0·(1-Xa)/(1+ε·Xa) expressed via kineticParams.
  buildReactions: (params: SimulationParams): ReactionSet => [{
    id: 'rxn-1',
    label: 'A → R (gas)',
    stoichiometry: { A: -1, R: +1, S: 0 },
    rateLaw: (C, _T, kP) => (kP['k'] ?? 0) * (C['A'] ?? 0),
    kineticParams: { k: params.k, Ca0: params.Ca0, epsilon: params.epsilon ?? 0 },
  }],

  computeDa: (k, tau) => k * tau,
};

const seriesPreset: ReactionPreset = {
  id: 'series',
  label: 'A → R → S  (series)',
  mode: 'series',
  isSingle: false,
  uiLabel: 'Series A→R→S',

  buildSpecies: () => [
    { id: 'A', label: 'Reactant A' },
    { id: 'R', label: 'Intermediate R' },
    { id: 'S', label: 'Product S' },
  ],

  buildReactions: (params: SimulationParams): ReactionSet => [
    {
      id: 'rxn-1',
      label: 'A → R',
      stoichiometry: { A: -1, R: +1, S: 0 },
      rateLaw: (C, T, kP) => arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) * (C['A'] ?? 0),
      kineticParams: { k: params.k, Ea: params.Ea, T_ref: params.T_ref },
    },
    {
      id: 'rxn-2',
      label: 'R → S',
      stoichiometry: { A: 0, R: -1, S: +1 },
      rateLaw: (C, T, kP) => arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) * (C['R'] ?? 0),
      kineticParams: { k: params.k2, Ea: params.Ea, T_ref: params.T_ref },
    },
  ],

  computeDa: (k, tau) => k * tau,
};

const parallelPreset: ReactionPreset = {
  id: 'parallel',
  label: 'A → R, A → S  (parallel)',
  mode: 'parallel',
  isSingle: false,
  uiLabel: 'Parallel A→R/A→S',

  buildSpecies: () => [
    { id: 'A', label: 'Reactant A' },
    { id: 'R', label: 'Product R' },
    { id: 'S', label: 'Product S' },
  ],

  buildReactions: (params: SimulationParams): ReactionSet => [
    {
      id: 'rxn-1',
      label: 'A → R',
      stoichiometry: { A: -1, R: +1, S: 0 },
      rateLaw: (C, T, kP) => arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) * (C['A'] ?? 0),
      kineticParams: { k: params.k, Ea: params.Ea, T_ref: params.T_ref },
    },
    {
      id: 'rxn-2',
      label: 'A → S',
      stoichiometry: { A: -1, R: 0, S: +1 },
      rateLaw: (C, T, kP) => arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) * (C['A'] ?? 0),
      kineticParams: { k: params.k2, Ea: params.Ea, T_ref: params.T_ref },
    },
  ],

  computeDa: (k, tau) => k * tau,
};

const seriesParallelPreset: ReactionPreset = {
  id: 'series-parallel',
  label: 'A+B→R, R+B→S, S+B→T  (series-parallel)',
  mode: 'series-parallel',
  isSingle: false,
  uiLabel: 'Series-Parallel A+B→R',

  buildSpecies: () => [
    { id: 'A', label: 'Reactant A' },
    { id: 'B', label: 'Reactant B' },
    { id: 'R', label: 'Product R' },
    { id: 'S', label: 'Product S' },
    { id: 'T', label: 'Product T' },
  ],

  buildReactions: (params: SimulationParams): ReactionSet => [
    {
      id: 'rxn-1',
      label: 'A + B → R',
      stoichiometry: { A: -1, B: -1, R: +1, S: 0, T: 0 },
      rateLaw: (C, T, kP) => arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) * (C['A'] ?? 0) * (C['B'] ?? 0),
      kineticParams: { k: params.k, Ea: params.Ea, T_ref: params.T_ref },
    },
    {
      id: 'rxn-2',
      label: 'R + B → S',
      stoichiometry: { A: 0, B: -1, R: -1, S: +1, T: 0 },
      rateLaw: (C, T, kP) => arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) * (C['R'] ?? 0) * (C['B'] ?? 0),
      kineticParams: { k: params.k2, Ea: params.Ea, T_ref: params.T_ref },
    },
    {
      id: 'rxn-3',
      label: 'S + B → T',
      stoichiometry: { A: 0, B: -1, R: 0, S: -1, T: +1 },
      rateLaw: (C, T, kP) => arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) * (C['S'] ?? 0) * (C['B'] ?? 0),
      kineticParams: { k: params.k3, Ea: params.Ea, T_ref: params.T_ref },
    },
  ],

  computeDa: (k, tau, Ca0) => k * Ca0 * tau,
};

const series3Preset: ReactionPreset = {
  id: 'series3',
  label: 'A → R → S → T  (3-step series)',
  mode: 'series3',
  isSingle: false,
  uiLabel: 'Series A→R→S→T',

  buildSpecies: () => [
    { id: 'A', label: 'Reactant A' },
    { id: 'R', label: 'Intermediate R' },
    { id: 'S', label: 'Intermediate S' },
    { id: 'T', label: 'Product T' },
  ],

  buildReactions: (params: SimulationParams): ReactionSet => [
    {
      id: 'rxn-1',
      label: 'A → R',
      stoichiometry: { A: -1, R: +1, S: 0, T: 0 },
      rateLaw: (C, T, kP) => arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) * (C['A'] ?? 0),
      kineticParams: { k: params.k, Ea: params.Ea, T_ref: params.T_ref },
    },
    {
      id: 'rxn-2',
      label: 'R → S',
      stoichiometry: { A: 0, R: -1, S: +1, T: 0 },
      rateLaw: (C, T, kP) => arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) * (C['R'] ?? 0),
      kineticParams: { k: params.k2, Ea: params.Ea, T_ref: params.T_ref },
    },
    {
      id: 'rxn-3',
      label: 'S → T',
      stoichiometry: { A: 0, R: 0, S: -1, T: +1 },
      rateLaw: (C, T, kP) => arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) * (C['S'] ?? 0),
      kineticParams: { k: params.k3, Ea: params.Ea, T_ref: params.T_ref },
    },
  ],

  computeDa: (k, tau) => k * tau,
};

const denbighPreset: ReactionPreset = {
  id: 'denbigh',
  label: 'A→R (k₁), A→T (k₂), R→S (k₃), R→U (k₄)  (Denbigh)',
  mode: 'denbigh',
  isSingle: false,
  uiLabel: 'Denbigh',

  buildSpecies: () => [
    { id: 'A', label: 'Reactant A' },
    { id: 'R', label: 'Desired R' },
    { id: 'S', label: 'Side S' },
    { id: 'T', label: 'Side T' },
    { id: 'U', label: 'Side U' },
  ],

  buildReactions: (params: SimulationParams): ReactionSet => [
    {
      id: 'rxn-1',
      label: 'A → R',
      stoichiometry: { A: -1, R: +1, S: 0, T: 0, U: 0 },
      rateLaw: (C, T, kP) => arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) * (C['A'] ?? 0),
      kineticParams: { k: params.k, Ea: params.Ea, T_ref: params.T_ref },
    },
    {
      id: 'rxn-2',
      label: 'A → T',
      stoichiometry: { A: -1, R: 0, S: 0, T: +1, U: 0 },
      rateLaw: (C, T, kP) => arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) * (C['A'] ?? 0),
      kineticParams: { k: params.k2, Ea: params.Ea, T_ref: params.T_ref },
    },
    {
      id: 'rxn-3',
      label: 'R → S',
      stoichiometry: { A: 0, R: -1, S: +1, T: 0, U: 0 },
      rateLaw: (C, T, kP) => arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) * (C['R'] ?? 0),
      kineticParams: { k: params.k3, Ea: params.Ea, T_ref: params.T_ref },
    },
    {
      id: 'rxn-4',
      label: 'R → U',
      stoichiometry: { A: 0, R: -1, S: 0, T: 0, U: +1 },
      rateLaw: (C, T, kP) => arrhenius(kP['k'] ?? 0, kP['Ea'] ?? 0, kP['T_ref'] ?? 300, T) * (C['R'] ?? 0),
      kineticParams: { k: params.k4, Ea: params.Ea, T_ref: params.T_ref },
    },
  ],

  computeDa: (k, tau) => k * tau,
};

// ---------------------------------------------------------------------------
// Public lookup
// ---------------------------------------------------------------------------

export const PRESETS: ReactionPreset[] = [
  firstOrderPreset,
  secondOrderPreset,
  autocatalyticPreset,
  reversiblePreset,
  gasPhaseFirstOrderPreset,
  seriesPreset,
  parallelPreset,
];

function formatCustomEquation(cr: CustomReaction, reversible?: boolean): string {
  const fmt = (label: string, stoich: number) => stoich === 1 ? label : `${stoich}${label}`;
  const reactants = cr.species.filter((s) => s.role === 'reactant').map((s) => fmt(s.label, s.stoich)).join(' + ');
  const products  = cr.species.filter((s) => s.role === 'product').map((s) => fmt(s.label, s.stoich)).join(' + ');
  const arrow = reversible ? '⇌' : '→';
  return reactants && products ? `${reactants} ${arrow} ${products}` : '?';
}

export function buildCustomPreset(cr: CustomReaction): ReactionPreset {
  const stoichiometry: Record<string, number> = {};
  for (const sp of cr.species) {
    stoichiometry[sp.label] = sp.role === 'reactant' ? -sp.stoich : sp.stoich;
  }

  const reactants = cr.species.filter((s) => s.role === 'reactant');
  const firstReactant = reactants[0]?.label ?? 'A';
  const secondReactant = reactants[1]?.label ?? firstReactant;
  const rp = cr.rateParams;

  const products = cr.species.filter((s) => s.role === 'product');
  const Keq = cr.reversible ? Math.max(cr.Keq_custom ?? 4, 1e-9) : Infinity;

  let rateLawFn: RateLawFn;
  if (cr.rateType === 'michaelis-menten') {
    rateLawFn = (C) => {
      const CA = C[firstReactant] ?? 0;
      const Vmax = rp['Vmax'] ?? 1;
      const Km   = rp['Km']   ?? 0.5;
      return Vmax * CA / Math.max(Km + CA, 1e-12);
    };
  } else if (cr.rateType === 'langmuir-hinshelwood') {
    rateLawFn = (C) => {
      const CA  = C[firstReactant]  ?? 0;
      const CB  = C[secondReactant] ?? 0;
      const k   = rp['k']   ?? 0.5;
      const K_A = rp['K_A'] ?? 0.2;
      const K_B = rp['K_B'] ?? 0.1;
      return k * CA / Math.max(1 + K_A * CA + K_B * CB, 1e-12);
    };
  } else {
    // Power law (with optional reversible term)
    rateLawFn = (C, T) => {
      const k_eff = arrhenius(rp['k'] ?? 0.5, rp['Ea'] ?? 0, rp['T_ref'] ?? 300, T);
      const r_fwd = k_eff * reactants.reduce((acc, sp) => acc * Math.max(C[sp.label] ?? 0, 0) ** (rp[`n_${sp.label}`] ?? sp.stoich), 1);
      if (!cr.reversible) return r_fwd;
      const r_rev = (k_eff / Keq) * products.reduce((acc, sp) => acc * Math.max(C[sp.label] ?? 0, 0) ** sp.stoich, 1);
      return r_fwd - r_rev;
    };
  }

  const eqLabel = formatCustomEquation(cr, cr.reversible);

  return {
    id: 'custom',
    label: eqLabel,
    mode: 'custom',
    isSingle: true,
    uiLabel: eqLabel,

    buildSpecies: () => cr.species.map((sp) => ({
      id: sp.label,
      label: `${sp.role === 'reactant' ? 'Reactant' : 'Product'} ${sp.label}`,
    })),

    buildReactions: (): ReactionSet => [{
      id: 'rxn-custom',
      label: eqLabel,
      stoichiometry,
      rateLaw: rateLawFn,
      kineticParams: { ...rp },
    }],

    computeDa: (_k, tau) => (rp['k'] ?? 0.5) * tau,
  };
}

export function getPreset(
  params: Pick<SimulationParams, 'reactionMode' | 'kinetics' | 'customReaction'>,
): ReactionPreset {
  if (params.reactionMode === 'custom' && params.customReaction) {
    return buildCustomPreset(params.customReaction);
  }
  if (params.reactionMode === 'series')          return seriesPreset;
  if (params.reactionMode === 'series3')         return series3Preset;
  if (params.reactionMode === 'series-parallel') return seriesParallelPreset;
  if (params.reactionMode === 'denbigh')         return denbighPreset;
  if (params.reactionMode === 'parallel')        return parallelPreset;
  switch (params.kinetics) {
    case 'first-order':          return firstOrderPreset;
    case 'second-order':         return secondOrderPreset;
    case 'autocatalytic':        return autocatalyticPreset;
    case 'reversible':           return reversiblePreset;
    case 'gas-phase-1st-order':  return gasPhaseFirstOrderPreset;
  }
}
