import type { KineticsType, ReactorType, ReactionMode, ThermalMode, CustomReaction } from './simulation';
import type { AnnotatedStream } from './stream';
import type { ChemistryModel } from './chemistry';
import type { OperatingDiagramData } from '../math/operatingDiagramModel';
import type { AdiabaticRiseResult, HotSpotResult } from '../math/safetyAnalysis';

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
  // F17: detailed cooling (cooled-detailed mode)
  UA?: number;           // total UA [kJ/(s·K)] for CSTR
  Ua?: number;           // volumetric UA [kJ/(L·s·K)] for PFR
  mdot_c_Cp_c?: number;  // coolant capacity rate ṁ_c·Cp_c [kJ/(s·K)]
  Tc_in?: number;        // coolant inlet temperature [K]
  hx_flow?: 'co-current' | 'counter-current';
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
  k3: number;
  Cb0: number;
  k4: number;
  Keq_ref: number;
  Ca0: number;
  Cr0_fraction: number;
  T_ref: number;
  Ea: number;
  delta_H: number;
  rho_Cp: number;
  T_feed: number;
  epsilon: number;
  Q_feed: number;
  recycleMethod: 'direct' | 'wegstein' | 'newton';
  customReaction: CustomReaction | null;
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
  V?: number;
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

export interface HXNodeData {
  label: string;
  mode: 'utility';
  T_out?: number;
  Q_duty?: number;
}

export interface CSplitNodeData {
  label: string;
  splitFractions: Record<string, number>; // ξ_i ∈ [0,1] per species; default 0.5
}

export interface FlashNodeData {
  label: string;
  T_flash: number; // K, default 365
  P_flash: number; // Pa, default 101325
}

export interface PurgeNodeData {
  label: string;
  beta: number; // vent fraction ∈ [0,1], default 0.05
}

export interface PumpNodeData {
  label: string;
  P_out: number; // Pa, default 5e5
  eta: number;   // hydraulic efficiency 0-1, default 0.75
  Q_vol: number; // volumetric flow rate m³/s, default 1e-3
}

export interface CompNodeData {
  label: string;
  P_out: number; // Pa, default 3e5
  eta: number;   // isentropic efficiency 0-1, default 0.80
  gamma: number; // Cp/Cv ratio, default 1.4
}

export interface ValveNodeData {
  label: string;
  P_out: number; // Pa, default 1e5
}

// F18: per-reactor safety data
export interface ReactorSafetyData extends AdiabaticRiseResult {
  Tmax_ad: number;          // T_feed + deltaTad [K]  — worst-case adiabatic outlet
  hotSpot?: HotSpotResult;  // PFR only: T_max and its position τ*
}

export interface SelectivityAnalysis {
  SR: number;
  YR_curve: { Da: number; YR: number }[];
  Da_opt?: number;
  Da_current?: number;
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
  selectivityAnalysis?: SelectivityAnalysis;
  Xa_eq?: number;
  divergenceWarning?: string; // set when a tear-stream species grows without bound
  reactorSafety: Record<string, ReactorSafetyData>; // F18: keyed by node id
}

export interface SimulationResult extends NetworkResult {}
