import type { KineticsType, ReactorType, ReactionMode, ThermalMode } from './simulation';
import type { AnnotatedStream } from './stream';
import type { ChemistryModel } from './chemistry';
import type { OperatingDiagramData } from '../math/operatingDiagramModel';

export interface ReactorNodeData {
  reactorType: ReactorType;
  label: string;
  tau: number;
  thermalMode: ThermalMode;
  Tc: number;
  kappa_v: number;
  ic_Ca: number;
  ic_T: number;
  pressureDrop?: boolean;
  Dp?: number;
  phi?: number;
  P0?: number;
  u0?: number;
}

/**
 * SimulationParams is a stable interface — treat it as versioned.
 * Before adding any field: grep spreads/destructures, update serializer.ts
 * migration map, check sweepEngine/targetSolver/comparisonEngine, run purity tests.
 */
export interface SimulationParams {
  reactionMode: ReactionMode;
  kinetics: KineticsType;
  k: number;
  k2: number;
  Keq_ref: number;
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
  P_out?: number;
}

export interface RecycleIterationRecord {
  iteration: number;
  maxError: number;
}

export interface RecycleConvergenceEntry {
  assumedXa: number;
  computedXa: number;
  assumedCa: number;
  computedCa: number;
  error: number;
}

/**
 * @internal — re-exported from streamBridge.ts, the single source of truth.
 * Imported here only for backward compatibility with existing solver imports.
 * Do not add fields here. All display metadata belongs on AnnotatedStream.
 */
export type { StreamState } from '../math/streamBridge';

export interface MixerNodeData {
  label: string;
}

export interface SplitterNodeData {
  label: string;
  alpha: number;
}

export interface NetworkResult {
  streams: Record<string, AnnotatedStream>;
  nodeOutputs: Record<string, AnnotatedStream>;
  converged: boolean;
  iterations: number;
  recycleEdgeIds: string[];
  segments: ReactorSegmentResult[];
  finalConversion: number;
  finalYield: number;
  finalSelectivity: number;
  finalConversions: Record<string, number>;
  levenspielCurve: { Xa: number; inv_rA_norm: number }[];
  chemistry: ChemistryModel;
  operatingDiagrams: Record<string, OperatingDiagramData>;
  recycleHistory: RecycleIterationRecord[];
  recycleConvergenceData: Record<string, RecycleConvergenceEntry>;
}

export interface SimulationResult extends NetworkResult {}
