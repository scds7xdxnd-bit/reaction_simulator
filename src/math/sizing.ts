/**
 * F22 — Equipment Sizing (pure math, zero React/Zustand imports)
 *
 * Screening-level sizing from converged solver results. Runs downstream of
 * the solver and never feeds back upstream (invariant 10: sizing downstream-only).
 *
 * References: Turton et al. "Analysis, Synthesis, and Design of Chemical Processes",
 *             4th ed., Appendix A; ASME thin-wall vessel formula.
 */

import type { Stream } from '../types/stream';
import { getSpecies, cpIntegral } from './thermoLibrary';

// ─── Physical constants & design defaults ────────────────────────────────────

export const F_SAFETY       = 1.2;        // vessel design safety factor
export const RHO_LIQ        = 1000.0;     // kg/m³  liquid density (water assumption)
export const R_GAS          = 8.314;      // J/(mol·K)
export const K_SB           = 0.107;      // m/s    Souders-Brown constant
export const STRESS_ALLOW   = 90e6;       // Pa     allowable stress, CS at 250 °C
export const JOINT_EFF      = 1.0;        // joint efficiency (full radiography)
export const CORR_ALLOW     = 0.003;      // m      corrosion allowance
export const ETA_PUMP       = 0.75;       // pump efficiency
export const ETA_COMP       = 0.72;       // compressor isentropic efficiency
export const GAMMA          = 1.4;        // Cp/Cv  (diatomic gas approximation)
export const U_HX_DEFAULT   = 500;        // W/(m²·K) generic liquid-liquid HX
export const DT_LM_DEFAULT  = 30;         // K  default LMTD when utility T unknown
const FALLBACK_MW            = 100;       // g/mol  generic species A, R, S, T, U
const GENERIC_IDS            = new Set(['A', 'R', 'S', 'T', 'U']);

// ─── Stream helpers ───────────────────────────────────────────────────────────

function mwG(id: string): number {
  if (GENERIC_IDS.has(id)) return FALLBACK_MW;
  return getSpecies(id)?.mw ?? FALLBACK_MW;
}

function totalF(s: Stream): number {
  return Object.values(s.F).reduce((a, b) => a + b, 0);
}

function avgMW(s: Stream): number {
  let ft = 0, mt = 0;
  for (const [id, f] of Object.entries(s.F)) { ft += f; mt += f * mwG(id); }
  return ft > 1e-15 ? mt / ft : FALLBACK_MW;
}

/** Liquid volumetric flow [m³/s] assuming RHO_LIQ. */
function liqVolFlow(s: Stream): number {
  const F = totalF(s); // mol/s
  const MW = avgMW(s); // g/mol
  return F * MW * 1e-3 / RHO_LIQ; // kg/s ÷ kg/m³ = m³/s
}

/** Gas volumetric flow [m³/s] via ideal gas law. */
function gasVolFlow(s: Stream): number {
  const F = totalF(s);
  return F * R_GAS * s.T / s.P; // (mol/s × J/(mol·K) × K) / Pa = m³/s
}

// ─── Thin-wall vessel geometry ────────────────────────────────────────────────

interface VesselGeom {
  D_m: number;
  L_m: number;
  t_wall_m: number;
  thickWallFlag: boolean;
}

/** Vertical vessel geometry (L/D = ratio). */
function vesselGeom(V_design_m3: number, P_Pa: number, ratio = 3): VesselGeom {
  const D = Math.cbrt(4 * V_design_m3 / (ratio * Math.PI));
  const L = ratio * D;
  const denom = 2 * STRESS_ALLOW * JOINT_EFF - 1.2 * P_Pa;
  const t = denom > 0 ? P_Pa * D / denom + CORR_ALLOW : CORR_ALLOW;
  return { D_m: D, L_m: L, t_wall_m: t, thickWallFlag: t > D / 10 };
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SizingResult {
  nodeId:   string;
  nodeType: string;
  // Vessel
  V_m3?:        number;  // net working volume [m³]
  V_design_m3?: number;  // with safety factor [m³]
  D_m?:         number;  // diameter [m]
  L_m?:         number;  // height or length [m]
  t_wall_m?:    number;  // wall thickness [m]
  thickWallFlag?: boolean;
  // HX
  Q_kW?:  number;  // process-side duty [kW]
  A_m2?:  number;  // heat-transfer area [m²]
  // Rotating
  power_kW?: number;  // shaft power [kW]
  // Turton size parameter S
  sizeParam: number;
  sizeUnit:  string;   // 'm³' | 'm²' | 'kW'
  notes: string[];
}

// ─── Per-equipment sizing ─────────────────────────────────────────────────────

function sizeCSTR(
  data: Record<string, unknown>,
  inlet: Stream,
): Omit<SizingResult, 'nodeId' | 'nodeType'> {
  const tau = (data.tau as number) ?? 60;   // s
  const Q   = liqVolFlow(inlet);            // m³/s
  const V   = Q * tau;
  const Vd  = F_SAFETY * V;
  const g   = vesselGeom(Vd, inlet.P, 3);
  return {
    V_m3: V, V_design_m3: Vd, ...g,
    sizeParam: Math.max(Vd, 0.3),
    sizeUnit: 'm³',
    notes: [`τ = ${tau} s, Q_vol = ${(Q * 1e3).toFixed(4)} L/s`],
  };
}

function sizePFR(
  data: Record<string, unknown>,
  inlet: Stream,
): Omit<SizingResult, 'nodeId' | 'nodeType'> {
  const tau = (data.tau as number) ?? 60;
  const Q   = liqVolFlow(inlet);
  const V   = Q * tau;
  const Vd  = F_SAFETY * V;
  const g   = vesselGeom(Vd, inlet.P, 10); // L/D = 10 for tubular reactor
  return {
    V_m3: V, V_design_m3: Vd, ...g,
    sizeParam: Math.max(Vd, 0.3),
    sizeUnit: 'm³',
    notes: [`τ = ${tau} s, L/D = 10 (tubular)`],
  };
}

function sizeFixedBed(
  data: Record<string, unknown>,
  inlet: Stream,
): Omit<SizingResult, 'nodeId' | 'nodeType'> {
  const W_cat    = (data.W_cat    as number) ?? 5.0;    // kg
  const rho_bulk = (data.rho_bulk as number) ?? 600.0;  // kg/m³
  const V_bed    = W_cat / rho_bulk;                    // m³
  const Vd       = F_SAFETY * V_bed;
  const g        = vesselGeom(Vd, inlet.P, 3);
  return {
    V_m3: V_bed, V_design_m3: Vd, ...g,
    sizeParam: Math.max(Vd, 0.3),
    sizeUnit: 'm³',
    notes: [`W_cat = ${W_cat} kg, ρ_bulk = ${rho_bulk} kg/m³`],
  };
}

function sizeBatch(
  data: Record<string, unknown>,
  inlet: Stream,
): Omit<SizingResult, 'nodeId' | 'nodeType'> {
  // Treat tau as batch cycle time; size vessel for one batch
  const tau   = (data.tau as number) ?? 3600;     // s
  const Q     = liqVolFlow(inlet) * tau;           // m³ per batch
  const Vd    = F_SAFETY * Q;
  const g     = vesselGeom(Vd, inlet.P, 2);        // L/D = 2 for batch
  return {
    V_m3: Q, V_design_m3: Vd, ...g,
    sizeParam: Math.max(Vd, 0.3),
    sizeUnit: 'm³',
    notes: ['L/D = 2 (batch vessel)'],
  };
}

function sizeHX(
  data: Record<string, unknown>,
  inlet: Stream,
  outlet: Stream | undefined,
): Omit<SizingResult, 'nodeId' | 'nodeType'> {
  const notes: string[] = [];

  let Q_W = 0;
  if (outlet) {
    for (const [id, fi] of Object.entries(inlet.F)) {
      const fo = outlet.F[id] ?? fi;
      const favg = (fi + fo) / 2;
      const T1 = Math.min(inlet.T, outlet.T);
      const T2 = Math.max(inlet.T, outlet.T);
      Q_W += favg * Math.abs(cpIntegral(id, T1, T2));
    }
  }
  if (Q_W < 1) {
    const Tc = (data.Tc as number) ?? 300;
    Q_W = Math.abs(totalF(inlet) * 30 * Math.abs(inlet.T - Tc));
    notes.push('Duty estimated from ΔT (outlet stream unavailable)');
  }

  const Q_kW = Q_W / 1000;
  const U    = (data.U_W_m2K as number) ?? U_HX_DEFAULT;
  const dTlm = DT_LM_DEFAULT;
  const A    = Q_W / (U * dTlm);

  notes.push(`U = ${U} W/(m²K), ΔT_lm = ${dTlm} K (default)`);
  return {
    Q_kW, A_m2: A,
    sizeParam: Math.max(A, 10),
    sizeUnit: 'm²',
    notes,
  };
}

function sizeFlash(
  _data: Record<string, unknown>,
  inlet: Stream,
  vaporOutlet: Stream | undefined,
): Omit<SizingResult, 'nodeId' | 'nodeType'> {
  const notes: string[] = [];
  const vaporStream = vaporOutlet ?? inlet; // fallback: treat inlet as all-vapor (conservative)
  if (!vaporOutlet) notes.push('Vapor stream not resolved; sized conservatively using inlet flow');

  const MWv    = avgMW(vaporStream);              // g/mol
  const rho_V  = inlet.P * MWv * 1e-3 / (R_GAS * inlet.T); // kg/m³
  const rho_L  = RHO_LIQ;
  const u_max  = K_SB * Math.sqrt((rho_L - rho_V) / Math.max(rho_V, 1e-6));
  const F_vap  = totalF(vaporStream);
  const Q_vap  = F_vap * MWv * 1e-3 / rho_V;    // m³/s
  const D      = 2 * Math.sqrt(Q_vap / (Math.PI * Math.max(u_max, 0.01)));
  const L      = 3 * D;

  notes.push(`K_SB = 0.107 m/s, ρ_V = ${rho_V.toFixed(3)} kg/m³, u_max = ${u_max.toFixed(2)} m/s`);
  const Vd = Math.PI / 4 * D * D * L;
  return {
    V_design_m3: Vd, D_m: D, L_m: L,
    sizeParam: Math.max(Vd, 0.3),
    sizeUnit: 'm³',
    notes,
  };
}

function sizePump(
  data: Record<string, unknown>,
  inlet: Stream,
): Omit<SizingResult, 'nodeId' | 'nodeType'> {
  const P_out  = (data.P_out as number) ?? (inlet.P + 2e5);
  const dP     = Math.max(P_out - inlet.P, 0);
  const Q_vol  = liqVolFlow(inlet);           // m³/s
  const power  = Q_vol * dP / ETA_PUMP;      // W
  const power_kW = power / 1000;
  return {
    power_kW,
    sizeParam: Math.max(power_kW, 1),
    sizeUnit: 'kW',
    notes: [`ΔP = ${(dP / 1e5).toFixed(2)} bar, η = ${ETA_PUMP}`],
  };
}

function sizeComp(
  data: Record<string, unknown>,
  inlet: Stream,
): Omit<SizingResult, 'nodeId' | 'nodeType'> {
  const P_out   = (data.P_out as number) ?? (inlet.P * 3);
  const ratio   = Math.max(P_out / Math.max(inlet.P, 1), 1.01);
  const n_total = totalF(inlet);
  // Adiabatic shaft work per mole: W = R·T·γ/(γ-1)·((r)^((γ-1)/γ)−1)
  const exp     = (GAMMA - 1) / GAMMA;
  const W_mol   = R_GAS * inlet.T * GAMMA / (GAMMA - 1) * (Math.pow(ratio, exp) - 1); // J/mol
  const power   = n_total * W_mol / ETA_COMP;  // W
  const power_kW = power / 1000;
  return {
    power_kW,
    sizeParam: Math.max(power_kW, 450),  // Turton Smin for centrifugal compressor
    sizeUnit: 'kW',
    notes: [`r = ${ratio.toFixed(2)}, T_in = ${inlet.T.toFixed(0)} K, η = ${ETA_COMP}`],
  };
}

// ─── Main public function ─────────────────────────────────────────────────────

export interface NodeInfo {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface EdgeInfo {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

/**
 * Compute AACE Class-5 equipment sizing for every equipment node.
 *
 * @param nodes   all flowsheet nodes
 * @param edges   all flowsheet edges (with optional sourceHandle)
 * @param streams converged solver result.streams (edgeId → Stream)
 * @returns       map of nodeId → SizingResult (equipment nodes only)
 */
export function computeSizing(
  nodes: NodeInfo[],
  edges: EdgeInfo[],
  streams: Record<string, Stream>,
): Record<string, SizingResult> {
  // Build adjacency: nodeId → inlet edges + outlet edges
  const inEdges  = new Map<string, EdgeInfo[]>();
  const outEdges = new Map<string, EdgeInfo[]>();
  for (const e of edges) {
    if (!inEdges.has(e.target))  inEdges.set(e.target,  []);
    if (!outEdges.has(e.source)) outEdges.set(e.source, []);
    inEdges.get(e.target)!.push(e);
    outEdges.get(e.source)!.push(e);
  }

  const EQUIPMENT = new Set([
    'cstr', 'pfr', 'fixedbed', 'batch', 'semibatch',
    'hx', 'flash', 'pump', 'comp', 'valve',
  ]);

  const result: Record<string, SizingResult> = {};

  for (const node of nodes) {
    if (!EQUIPMENT.has(node.type)) continue;

    // Inlet stream: first inlet edge that has a stream
    const inletEdge = (inEdges.get(node.id) ?? []).find(e => streams[e.id]);
    const inlet = inletEdge ? streams[inletEdge.id] : null;
    if (!inlet) continue; // no stream data → skip

    // Outlet streams
    const out = (outEdges.get(node.id) ?? []);
    const outletEdge = out.find(e => streams[e.id] && !e.sourceHandle?.includes('vent'));
    const outlet = outletEdge ? streams[outletEdge.id] : undefined;

    let partial: Omit<SizingResult, 'nodeId' | 'nodeType'>;

    switch (node.type) {
      case 'cstr':
      case 'semibatch':
        partial = sizeCSTR(node.data, inlet);
        break;
      case 'pfr':
        partial = sizePFR(node.data, inlet);
        break;
      case 'fixedbed':
        partial = sizeFixedBed(node.data, inlet);
        break;
      case 'batch':
        partial = sizeBatch(node.data, inlet);
        break;
      case 'hx':
        partial = sizeHX(node.data, inlet, outlet);
        break;
      case 'flash': {
        const vaporEdge = out.find(e => e.sourceHandle === 'out-vapor' && streams[e.id]);
        const vaporOutlet = vaporEdge ? streams[vaporEdge.id] : undefined;
        partial = sizeFlash(node.data, inlet, vaporOutlet);
        break;
      }
      case 'pump':
        partial = sizePump(node.data, inlet);
        break;
      case 'comp':
        partial = sizeComp(node.data, inlet);
        break;
      case 'valve':
        partial = {
          sizeParam: 1.0,
          sizeUnit: 'm³',
          notes: ['Control valve — sized by Cv, not volume'],
        };
        break;
      default:
        continue;
    }

    result[node.id] = { nodeId: node.id, nodeType: node.type, ...partial };
  }

  return result;
}
