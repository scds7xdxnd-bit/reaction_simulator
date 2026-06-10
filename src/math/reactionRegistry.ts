import type { SimulationParams } from '../types/reactor';
import type { ReactionMode, KineticsType } from '../types/simulation';
import type { Species, Reaction, ReactionSet } from '../types/chemistry';

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
    rateLaw: (C, _T, kP) => (kP['k'] ?? 0) * (C['A'] ?? 0),
    kineticParams: { k: params.k },
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
    rateLaw: (C, _T, kP) => (kP['k'] ?? 0) * (C['A'] ?? 0) ** 2,
    kineticParams: { k: params.k },
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
    rateLaw: (C, _T, kP) =>
      (kP['k'] ?? 0) *
      (C['A'] ?? 0) *
      ((C['R'] ?? 0) + (kP['Cr0_frac'] ?? 0.01) * (kP['Ca0'] ?? 1)),
    kineticParams: { k: params.k, Ca0: params.Ca0, Cr0_frac: params.Cr0_fraction },
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
      rateLaw: (C, _T, kP) => (kP['k'] ?? 0) * (C['A'] ?? 0),
      kineticParams: { k: params.k },
    },
    {
      id: 'rxn-2',
      label: 'R → S',
      stoichiometry: { A: 0, R: -1, S: +1 },
      rateLaw: (C, _T, kP) => (kP['k'] ?? 0) * (C['R'] ?? 0),
      kineticParams: { k: params.k2 },
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
      rateLaw: (C, _T, kP) => (kP['k'] ?? 0) * (C['A'] ?? 0),
      kineticParams: { k: params.k },
    },
    {
      id: 'rxn-2',
      label: 'A → S',
      stoichiometry: { A: -1, R: 0, S: +1 },
      rateLaw: (C, _T, kP) => (kP['k'] ?? 0) * (C['A'] ?? 0),
      kineticParams: { k: params.k2 },
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
  seriesPreset,
  parallelPreset,
];

export function getPreset(
  params: Pick<SimulationParams, 'reactionMode' | 'kinetics'>,
): ReactionPreset {
  if (params.reactionMode === 'series')   return seriesPreset;
  if (params.reactionMode === 'parallel') return parallelPreset;
  switch (params.kinetics) {
    case 'first-order':   return firstOrderPreset;
    case 'second-order':  return secondOrderPreset;
    case 'autocatalytic': return autocatalyticPreset;
    case 'reversible':    return reversiblePreset;
  }
}
