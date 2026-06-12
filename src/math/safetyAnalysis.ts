/**
 * F18 — Safety & Stability Analysis (pure math, zero React/Zustand imports)
 *
 * Exports:
 *   adiabaticTemperatureRise  — ΔT_ad badge for exothermic reactors
 *   pfrHotSpot                — T_max and τ* from an existing PFR profile
 *   ignitionExtinctionSweep   — S-curve sweep of cooled-CSTR steady states
 */

import type { SimulationParams } from '../types/reactor';
import type { ProfilePoint } from './unitModels';
import { buildOperatingDiagram } from './operatingDiagramModel';

// ─── Sub-analysis 1: Adiabatic temperature rise ──────────────────────────────

export type SafetyBadge = 'normal' | 'amber' | 'red';

export interface AdiabaticRiseResult {
  deltaTad: number;   // [K] full-conversion adiabatic temperature rise
  badge: SafetyBadge; // normal <50K, amber 50–150K, red >150K
}

/**
 * ΔT_ad = (−ΔH_rxn) × Ca0 / (ρCp)
 *   deltaH_kJ_mol — reaction enthalpy [kJ/mol], negative = exothermic
 *   Ca0            — feed concentration [mol/L]
 *   rhoCp          — heat-capacity density [kJ/(L·K)]
 */
export function adiabaticTemperatureRise(
  deltaH_kJ_mol: number,
  Ca0: number,
  rhoCp: number,
): AdiabaticRiseResult {
  const deltaTad = (-deltaH_kJ_mol) * Math.max(Ca0, 0) / Math.max(rhoCp, 1e-9);
  const badge: SafetyBadge = deltaTad > 150 ? 'red' : deltaTad > 50 ? 'amber' : 'normal';
  return { deltaTad, badge };
}

// ─── Sub-analysis 2: PFR hot-spot ────────────────────────────────────────────

export interface HotSpotResult {
  Tmax: number;     // maximum process temperature [K] along the reactor
  tauStar: number;  // position of the hot-spot (cumulative τ) [s]
}

/**
 * Scan a PFR temperature profile for the maximum temperature.
 * Returns {Tmax, tauStar}; if the profile is empty or monotone-decreasing
 * (co-current cooling), Tmax = profile.at(-1).T and tauStar = its cumTau.
 */
export function pfrHotSpot(profile: ProfilePoint[]): HotSpotResult {
  if (profile.length === 0) return { Tmax: 0, tauStar: 0 };
  let maxT = -Infinity;
  let tauStar = 0;
  for (const pt of profile) {
    if (pt.T > maxT) { maxT = pt.T; tauStar = pt.cumTau; }
  }
  return { Tmax: maxT, tauStar };
}

// ─── Sub-analysis 3: Ignition–extinction diagram ─────────────────────────────

export interface SteadyStatePoint {
  param: number;    // swept parameter value
  T: number;        // reactor temperature [K]
  stable: boolean;  // G-R slope criterion: stable when dR/dT > dG/dT
}

export type SweepParamName = 'Tc' | 'tau' | 'Ca0';

export interface IEDiagramResult {
  /** Flat list of all steady-state intersections across the sweep */
  points: SteadyStatePoint[];
  /** Parameter that was swept */
  param: SweepParamName;
  /**
   * Index of any fold points (ignition / extinction) — positions in `points`
   * where the branch count changes (1→3 or 3→1 stable/unstable transition).
   */
  foldIndices: number[];
}

/**
 * Sweep one parameter and collect all G-R steady-state intersections.
 * Reuses buildOperatingDiagram at each sweep step (no new physics).
 *
 * @param param    which parameter to sweep: 'Tc', 'tau', or 'Ca0'
 * @param lo       sweep lower bound (same units as the parameter)
 * @param hi       sweep upper bound
 * @param steps    number of equally-spaced samples (default 200)
 * @param baseXa   inlet conversion for the operating diagram (default 0)
 * @param Tin      feed temperature [K]
 * @param tau      base residence time [s] (used unless param='tau')
 * @param Tc       base coolant temperature [K] (used unless param='Tc')
 * @param kappa_v  heat removal coefficient [kJ/(L·s·K)]
 * @param params   SimulationParams (kinetics, Ca0, delta_H, rho_Cp …)
 */
export function ignitionExtinctionSweep(
  param: SweepParamName,
  lo: number,
  hi: number,
  Tin: number,
  tau: number,
  Tc: number,
  kappa_v: number,
  params: SimulationParams,
  steps = 200,
  baseXa = 0,
): IEDiagramResult {
  const points: SteadyStatePoint[] = [];
  let prevCount = 0;
  const foldIndices: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const pVal = lo + (i / steps) * (hi - lo);
    const tauEff   = param === 'tau'  ? pVal : tau;
    const TcEff    = param === 'Tc'   ? pVal : Tc;
    const paramsEff: SimulationParams = param === 'Ca0'
      ? { ...params, Ca0: pVal }
      : params;

    const diag = buildOperatingDiagram(baseXa, Tin, tauEff, TcEff, kappa_v, paramsEff);

    if (diag.steadyStates.length !== prevCount) {
      foldIndices.push(points.length);
      prevCount = diag.steadyStates.length;
    }

    for (const ss of diag.steadyStates) {
      points.push({ param: pVal, T: ss.T, stable: ss.stable });
    }
  }

  return { points, param, foldIndices };
}
