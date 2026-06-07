export type KineticsType = 'first-order' | 'second-order' | 'autocatalytic';
export type ReactorType = 'CSTR' | 'PFR';
export type ReactionMode = 'single' | 'series' | 'parallel';

export interface ReactorNodeData {
  reactorType: ReactorType;
  label: string;
  tau: number;
}

export interface SimulationParams {
  reactionMode: ReactionMode;
  kinetics: KineticsType;
  k: number;
  k2: number;
  Ca0: number;
  Cr0_fraction: number;
}

export interface ReactorSegmentResult {
  reactorId: string;
  reactorType: ReactorType;
  label: string;
  Xa_in: number;
  Xa_out: number;
  tau: number;
  Da: number;
  Ca_out: number;
  Cr_out: number;
  Cs_out: number;
  yield_R: number;
  selectivity_R: number;
  profile: { cumTau: number; Xa: number; Ca: number; Cr: number; Cs: number }[];
}

export interface SimulationResult {
  segments: ReactorSegmentResult[];
  finalConversion: number;
  finalYield: number;
  finalSelectivity: number;
  levenspielCurve: { Xa: number; inv_rA_norm: number }[];
}
