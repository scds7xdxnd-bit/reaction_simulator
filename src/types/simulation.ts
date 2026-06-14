export type KineticsType = 'first-order' | 'second-order' | 'autocatalytic' | 'reversible' | 'gas-phase-1st-order';
export type ReactorType  = 'CSTR' | 'PFR' | 'Batch' | 'Semibatch' | 'FixedBed';
export type ReactionMode = 'single' | 'series' | 'series3' | 'parallel' | 'series-parallel' | 'denbigh' | 'custom';
export type UnitType     = 'CSTR' | 'PFR' | 'Mixer' | 'Splitter' | 'Batch' | 'Semibatch' | 'HX' | 'CSplit' | 'Flash' | 'Purge' | 'Pump' | 'Comp' | 'Valve';
export type ThermalMode  = 'isothermal' | 'adiabatic' | 'cooled' | 'cooled-detailed';
export type RateType     = 'power-law' | 'michaelis-menten' | 'langmuir-hinshelwood';

export interface CustomSpecies {
  id: string;
  label: string;
  role: 'reactant' | 'product';
  stoich: number;
}

export interface CustomReaction {
  species: CustomSpecies[];
  rateType: RateType;
  rateParams: Record<string, number>;
  reversible?: boolean;
  Keq_custom?: number;
  label?: string;
}

export interface CustomNetworkReaction {
  id: string;
  reactants: { species: string; coeff: number }[];
  products: { species: string; coeff: number }[];
  reversible: boolean;
  rateType: RateType;
  rateParams: Record<string, number>;
  deltaH?: number;
}

export interface CustomSpeciesMeta {
  boundLibraryId?: string;
  phase?: 'g' | 'l' | 's';
  feedConc?: number;
}

export interface CustomReactionNetwork {
  reactions: CustomNetworkReaction[];
  speciesMeta: Record<string, CustomSpeciesMeta>;
  keyReactantId?: string;
}

/** @deprecated — used only by the serializer migration. Replaced by CustomReactionNetwork. */
export interface LegacyCustomReaction {
  species: { id: string; label: string; role: 'reactant' | 'product'; stoich: number }[];
  rateType: RateType;
  rateParams: Record<string, number>;
  reversible?: boolean;
  Keq_custom?: number;
  label?: string;
}

export type DesignMetric = 'Xa' | 'Ca_out' | 'T_out' | 'yield_R' | 'selectivity_R';

export interface DesignSpec {
  id: string;
  vary: {
    nodeId?: string;
    param: string;
    lo: number;
    hi: number;
  };
  target: {
    metric: DesignMetric;
    nodeId?: string;
    speciesId?: string;
    value: number;
  };
  active: boolean;
}
