/**
 * F20 — Engineering Stream Table / HMB Report (pure math, zero React/Zustand imports)
 *
 * Converts solver result.streams into an industry-standard Heat & Material Balance (HMB)
 * table: T[°C], P[bar], molar flows [mol/s], mass flows [g/s], composition, enthalpy [kJ/mol].
 * Also computes per-element and overall mass balance closure.
 */

import type { AnnotatedStream } from '../types/stream';
import { getSpecies, cpIntegral } from './thermoLibrary';

// ─── Constants ────────────────────────────────────────────────────────────────

const FALLBACK_MW = 100;          // g/mol for species not in library (A, R, S, T, U)
const GENERIC_IDS = new Set(['A', 'R', 'S', 'T', 'U']);
const T_REF = 298.15;             // K (enthalpy reference)

// ─── Species helpers ─────────────────────────────────────────────────────────

function molarMass(id: string): number {
  if (GENERIC_IDS.has(id)) return FALLBACK_MW;
  return getSpecies(id)?.mw ?? FALLBACK_MW;
}

function speciesMolarEnthalpy_kJ(id: string, T: number): number {
  const s = GENERIC_IDS.has(id) ? undefined : getSpecies(id);
  const dHf_J = s ? s.dHf298 * 1000 : 0;            // J/mol
  const hSens_J = cpIntegral(id, T_REF, T);          // J/mol
  return (dHf_J + hSens_J) / 1000;                    // kJ/mol
}

function parseFormula(formula: string): Record<string, number> {
  const elems: Record<string, number> = {};
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula)) !== null) {
    if (!m[1]) continue;
    elems[m[1]] = (elems[m[1]] ?? 0) + (m[2] ? parseInt(m[2], 10) : 1);
  }
  return elems;
}

function speciesElements(id: string): Record<string, number> {
  if (GENERIC_IDS.has(id)) return {}; // no molecular formula → excluded from atom balance
  const s = getSpecies(id);
  return s ? parseFormula(s.formula) : {};
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface HMBStreamRow {
  streamNo: number;
  edgeId: string;
  label: string;              // e.g. 'S01'
  description: string;        // e.g. 'Feed → Mixer'
  T_C: number;                // temperature [°C]
  P_bar: number;              // pressure [bar]
  vaporFraction: number;      // 0=liquid, 1=gas
  F_mol_s: Record<string, number>;   // component molar flows [mol/s]
  F_total_mol_s: number;             // total molar flow [mol/s]
  mass_g_s: Record<string, number>;  // component mass flows [g/s]
  mass_total_g_s: number;            // total mass flow [g/s]
  x_mol: Record<string, number>;     // mole fractions [-]
  H_kJ_mol: number;                  // stream molar enthalpy [kJ/mol] rel. to 298.15 K
  isRecycle: boolean;
}

export interface ElementBalance {
  inlet_mol_s: number;   // moles of element entering as feed [mol-atom/s]
  outlet_mol_s: number;  // moles of element leaving as product [mol-atom/s]
  errorPct: number;      // |in − out| / max(in,out) × 100
}

export interface HMBTable {
  streams: HMBStreamRow[];
  speciesIds: string[];                       // sorted union of all species present
  elements: Record<string, ElementBalance>;   // per-element atom balance
  massBalance: { inlet_g_s: number; outlet_g_s: number; errorPct: number };
  closed: boolean;                            // true if all errors < 0.1 %
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Build an HMB table from solver result streams.
 *
 * @param annotatedStreams  result.streams from networkSolver
 * @param recycleEdgeIds   edge IDs that are tear/recycle streams
 * @param feedEdgeIds      edge IDs originating from feed nodes (system inlet)
 * @param productEdgeIds   edge IDs terminating at product/sink nodes (system outlet)
 */
export function buildHMBTable(
  annotatedStreams: Record<string, AnnotatedStream>,
  recycleEdgeIds: string[],
  feedEdgeIds: string[],
  productEdgeIds: string[],
): HMBTable {
  const recycleSet = new Set(recycleEdgeIds);
  const feedSet    = new Set(feedEdgeIds);
  const productSet = new Set(productEdgeIds);

  // Collect all species across all streams
  const speciesIdSet = new Set<string>();
  for (const s of Object.values(annotatedStreams)) {
    for (const id of Object.keys(s.F)) speciesIdSet.add(id);
  }
  const speciesIds = [...speciesIdSet].sort();

  // Sort streams by stream label (S01, S02 …) for consistent numbering
  const sortedEntries = Object.entries(annotatedStreams).sort(([, a], [, b]) =>
    (a.streamLabel ?? '').localeCompare(b.streamLabel ?? ''),
  );

  // ── Build per-stream rows ──────────────────────────────────────────────────
  const rows: HMBStreamRow[] = sortedEntries.map(([edgeId, stream], idx) => {
    const F_mol_s: Record<string, number> = {};
    const mass_g_s: Record<string, number> = {};
    let F_total = 0;
    let mass_total = 0;

    for (const id of speciesIds) {
      const f  = stream.F[id] ?? 0;
      const mw = molarMass(id);
      F_mol_s[id]  = f;
      mass_g_s[id] = f * mw;
      F_total  += f;
      mass_total += f * mw;
    }

    const x_mol: Record<string, number> = {};
    for (const id of speciesIds) {
      x_mol[id] = F_total > 1e-12 ? F_mol_s[id] / F_total : 0;
    }

    // Stream molar enthalpy = Σ(y_i × h_i(T))
    let H_kJ_mol = 0;
    for (const id of speciesIds) {
      H_kJ_mol += x_mol[id] * speciesMolarEnthalpy_kJ(id, stream.T);
    }

    return {
      streamNo:        idx + 1,
      edgeId,
      label:           stream.streamLabel ?? `S${String(idx + 1).padStart(2, '0')}`,
      description:     stream.streamDesc  ?? '',
      T_C:             stream.T - 273.15,
      P_bar:           stream.P / 1e5,
      vaporFraction:   ((stream as unknown as Record<string, unknown>).vaporFraction as number) ?? 0,
      F_mol_s,
      F_total_mol_s:   F_total,
      mass_g_s,
      mass_total_g_s:  mass_total,
      x_mol,
      H_kJ_mol,
      isRecycle:       recycleSet.has(edgeId),
    };
  });

  // ── Atom balance (feed → product boundary) ────────────────────────────────
  const mbIn:  Record<string, number> = {};
  const mbOut: Record<string, number> = {};

  for (const [edgeId, stream] of Object.entries(annotatedStreams)) {
    const isFeed    = feedSet.has(edgeId);
    const isProduct = productSet.has(edgeId);
    if (!isFeed && !isProduct) continue;

    for (const [specId, f] of Object.entries(stream.F)) {
      for (const [el, n] of Object.entries(speciesElements(specId))) {
        if (isFeed)    mbIn[el]  = (mbIn[el]  ?? 0) + f * n;
        if (isProduct) mbOut[el] = (mbOut[el] ?? 0) + f * n;
      }
    }
  }

  const elements: Record<string, ElementBalance> = {};
  for (const el of new Set([...Object.keys(mbIn), ...Object.keys(mbOut)])) {
    const inlet  = mbIn[el]  ?? 0;
    const outlet = mbOut[el] ?? 0;
    const mx = Math.max(inlet, outlet);
    elements[el] = {
      inlet_mol_s:  inlet,
      outlet_mol_s: outlet,
      errorPct:     mx > 1e-15 ? 100 * Math.abs(inlet - outlet) / mx : 0,
    };
  }

  // ── Overall mass balance ───────────────────────────────────────────────────
  let massIn = 0, massOut = 0;
  for (const [edgeId, stream] of Object.entries(annotatedStreams)) {
    const m = Object.entries(stream.F)
      .reduce((sum, [id, f]) => sum + f * molarMass(id), 0);
    if (feedSet.has(edgeId))    massIn  += m;
    if (productSet.has(edgeId)) massOut += m;
  }
  const massMx = Math.max(massIn, massOut);
  const massErrorPct = massMx > 1e-15 ? 100 * Math.abs(massIn - massOut) / massMx : 0;

  const allErrors = [
    ...Object.values(elements).map(e => e.errorPct),
    massErrorPct,
  ];
  const closed =
    feedSet.size > 0 && productSet.size > 0 && allErrors.every(e => e < 0.1);

  return {
    streams:     rows,
    speciesIds,
    elements,
    massBalance: { inlet_g_s: massIn, outlet_g_s: massOut, errorPct: massErrorPct },
    closed,
  };
}

// ─── Export helpers ───────────────────────────────────────────────────────────

/** CSV export — one row per stream, one column per property. */
export function hmbTableToCSV(table: HMBTable): string {
  const { streams, speciesIds } = table;
  const header = [
    'Stream', 'Description', 'T (C)', 'P (bar)', 'Vapor frac',
    'F_total (mol/s)', 'Mass_total (g/s)',
    ...speciesIds.map(id => `F_${id} (mol/s)`),
    ...speciesIds.map(id => `y_${id}`),
    'H (kJ/mol)', 'Recycle',
  ].join(',');

  const dataRows = streams.map(r => [
    r.label,
    `"${r.description}"`,
    r.T_C.toFixed(2),
    r.P_bar.toFixed(4),
    r.vaporFraction.toFixed(3),
    r.F_total_mol_s.toFixed(4),
    r.mass_total_g_s.toFixed(4),
    ...speciesIds.map(id => (r.F_mol_s[id] ?? 0).toFixed(4)),
    ...speciesIds.map(id => (r.x_mol[id]   ?? 0).toFixed(4)),
    r.H_kJ_mol.toFixed(3),
    r.isRecycle ? 'Y' : 'N',
  ].join(','));

  return [header, ...dataRows].join('\n');
}

/** Markdown table export. */
export function hmbTableToMarkdown(table: HMBTable): string {
  const { streams, speciesIds } = table;
  const cols = [
    'Stream', 'Description', 'T (°C)', 'P (bar)', 'F_total (mol/s)', 'Mass (g/s)',
    ...speciesIds.map(id => `y_${id}`),
    'H (kJ/mol)',
  ];
  const sep  = cols.map(() => '---');
  const rows = streams.map(r => [
    r.label,
    r.description,
    r.T_C.toFixed(1),
    r.P_bar.toFixed(3),
    r.F_total_mol_s.toFixed(3),
    r.mass_total_g_s.toFixed(2),
    ...speciesIds.map(id => (r.x_mol[id] ?? 0).toFixed(3)),
    r.H_kJ_mol.toFixed(2),
  ]);

  const toRow = (cells: string[]) => '| ' + cells.join(' | ') + ' |';
  return [toRow(cols), toRow(sep), ...rows.map(toRow)].join('\n');
}
