export type KineticsType = 'first-order' | 'second-order' | 'autocatalytic' | 'reversible' | 'gas-phase-1st-order';
export type ReactorType  = 'CSTR' | 'PFR' | 'Batch' | 'Semibatch' | 'FixedBed';
export type ReactionMode = 'single' | 'series' | 'series3' | 'parallel' | 'series-parallel' | 'denbigh' | 'custom';
export type UnitType     = 'CSTR' | 'PFR' | 'Mixer' | 'Splitter' | 'Batch' | 'Semibatch' | 'HX';
export type ThermalMode  = 'isothermal' | 'adiabatic' | 'cooled';
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
