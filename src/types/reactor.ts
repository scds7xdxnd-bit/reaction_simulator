export type KineticsType = 'first-order' | 'second-order' | 'autocatalytic';
export type ReactorType = 'CSTR' | 'PFR';
export type ReactionMode = 'single' | 'series' | 'parallel';
export type UnitType = 'CSTR' | 'PFR' | 'Mixer' | 'Splitter';
export type ThermalMode = 'isothermal' | 'adiabatic' | 'cooled';

export interface ReactorNodeData {
  reactorType: ReactorType;
  label: string;
  tau: number;
  thermalMode: ThermalMode;
  Tc: number;
  kappa_v: number;
  ic_Ca: number;
  ic_T: number;
}

export interface SimulationParams {
  reactionMode: ReactionMode;
  kinetics: KineticsType;
  k: number;
  k2: number;
  Ca0: number;
  Cr0_fraction: number;
  T_ref: number;
  Ea: number;
  delta_H: number;
  rho_Cp: number;
  T_feed: number;
}

export interface ReactorSegmentResult {
  reactorId: string;
  reactorType: ReactorType;
  label: string;
  Xa_in: number;
  Xa_out: number;
  T_in: number;
  T_out: number;
  tau: number;
  Da: number;
  Ca_out: number;
  Cr_out: number;
  Cs_out: number;
  yield_R: number;
  selectivity_R: number;
  profile: { cumTau: number; Xa: number; Ca: number; Cr: number; Cs: number; T: number }[];
}

export interface StreamState {
  Xa: number;
  Ca: number;
  Cr: number;
  Cs: number;
  flow: number;
  T: number;
  streamLabel?: string;
  streamDesc?: string;
}

export interface MixerNodeData {
  label: string;
}

export interface SplitterNodeData {
  label: string;
  alpha: number;
}

export interface NetworkResult {
  streams: Record<string, StreamState>;
  nodeOutputs: Record<string, StreamState>;
  converged: boolean;
  iterations: number;
  recycleEdgeIds: string[];
  segments: ReactorSegmentResult[];
  finalConversion: number;
  finalYield: number;
  finalSelectivity: number;
  levenspielCurve: { Xa: number; inv_rA_norm: number }[];
}

export interface SimulationResult extends NetworkResult {}
