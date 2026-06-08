import type { SimulationParams } from '../types/reactor';
import type {
  ChemistryModel, Species, Reaction, ReactionSet,
  ThermoModel, RateLawFn,
} from '../types/chemistry';

export function buildChemistry(params: SimulationParams): ChemistryModel {
  return {
    species:        buildSpecies(params),
    reactions:      buildReactions(params),
    thermo:         buildThermoModel(params),
    keyReactantId:  'A',
  };
}

function buildSpecies(params: SimulationParams): Species[] {
  const isMulti = params.reactionMode !== 'single';
  return [
    { id: 'A', label: 'Reactant A' },
    { id: 'R', label: isMulti ? 'Intermediate R' : 'Product R' },
    ...(isMulti ? [{ id: 'S', label: 'Product S' }] : []),
  ];
}

function buildReactions(params: SimulationParams): ReactionSet {
  switch (params.reactionMode) {
    case 'single':   return [buildSingleReaction(params)];
    case 'series':   return [buildSeriesR1(params), buildSeriesR2(params)];
    case 'parallel': return [buildParallelR1(params), buildParallelR2(params)];
  }
}

function buildSingleReaction(params: SimulationParams): Reaction {
  const kineticsType = params.kinetics;

  const rateLaw: RateLawFn = (C, _T, kP) => {
    const Ca  = C['A']  ?? 0;
    const Cr  = C['R']  ?? 0;
    const k   = kP['k'] ?? 0;
    const Ca0 = kP['Ca0']     ?? 1;
    const cr0 = kP['Cr0_frac'] ?? 0.01;

    switch (kineticsType) {
      case 'first-order':
        return k * Ca;
      case 'second-order':
        return k * Ca * Ca;
      case 'autocatalytic':
        return k * Ca * (Cr + cr0 * Ca0);
    }
  };

  return {
    id: 'rxn-1',
    label: 'A → R',
    stoichiometry: { A: -1, R: +1, S: 0 },
    rateLaw,
    kineticParams: { k: params.k, Ca0: params.Ca0, Cr0_frac: params.Cr0_fraction },
  };
}

function buildSeriesR1(params: SimulationParams): Reaction {
  return {
    id: 'rxn-1',
    label: 'A → R',
    stoichiometry: { A: -1, R: +1, S: 0 },
    rateLaw: (C, _T, kP) => (kP['k'] ?? 0) * (C['A'] ?? 0),
    kineticParams: { k: params.k },
  };
}

function buildSeriesR2(params: SimulationParams): Reaction {
  return {
    id: 'rxn-2',
    label: 'R → S',
    stoichiometry: { A: 0, R: -1, S: +1 },
    rateLaw: (C, _T, kP) => (kP['k'] ?? 0) * (C['R'] ?? 0),
    kineticParams: { k: params.k2 },
  };
}

function buildParallelR1(params: SimulationParams): Reaction {
  return {
    id: 'rxn-1',
    label: 'A → R',
    stoichiometry: { A: -1, R: +1, S: 0 },
    rateLaw: (C, _T, kP) => (kP['k'] ?? 0) * (C['A'] ?? 0),
    kineticParams: { k: params.k },
  };
}

function buildParallelR2(params: SimulationParams): Reaction {
  return {
    id: 'rxn-2',
    label: 'A → S',
    stoichiometry: { A: -1, R: 0, S: +1 },
    rateLaw: (C, _T, kP) => (kP['k'] ?? 0) * (C['A'] ?? 0),
    kineticParams: { k: params.k2 },
  };
}

function buildThermoModel(params: SimulationParams): ThermoModel {
  return {
    deltaH: (_rxnId, _T) => params.delta_H,
    rhoCp:  (_C, _T)     => params.rho_Cp,
  };
}
