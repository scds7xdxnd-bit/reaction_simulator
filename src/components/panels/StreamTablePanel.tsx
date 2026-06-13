import { useState, useCallback, useMemo } from 'react';
import { useSimulatorStore } from '../../store/simulatorStore';
import { buildHMBTable, hmbTableToCSV, hmbTableToMarkdown } from '../../math/streamTableMapper';

type SortKey = 'flow' | 'T' | 'Xa' | 'Ca';
type SortDir = 'asc' | 'desc' | null;

interface RowData {
  edgeId: string;
  label: string;
  route: string;
  flow: number;
  T: number;
  Xa: number;
  Ca: number;
  Cr: number | null;
  Cs: number | null;
  isRecycle: boolean;
}

function computeRow(
  fA: number,
  fR: number,
  fS: number,
  T: number,
  Ca0: number,
): { flow: number; T: number; Xa: number; Ca: number; Cr: number | null; Cs: number | null } {
  const totalF = fA + fR + fS;
  const vRel = totalF / Math.max(Ca0, 1e-12);
  const Ca = vRel > 1e-12 ? fA / vRel : 0;
  const FA0 = Ca0 > 1e-12 ? Ca0 : 1;
  const Xa = Math.max(0, Math.min(0.9999, 1 - (fA / FA0)));
  const Cr = vRel > 1e-12 ? fR / vRel : 0;
  const Cs = vRel > 1e-12 ? fS / vRel : 0;
  return { flow: totalF, T, Xa, Ca, Cr, Cs };
}

const SORT_LABEL_MAP: Record<string, SortKey> = {
  Flow: 'flow',
  'T (K)': 'T',
  'Xₐ': 'Xa',
  'Cₐ': 'Ca',
};

export default function StreamTablePanel() {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);
  const nodes  = useSimulatorStore((s) => s.nodes);
  const edges  = useSimulatorStore((s) => s.edges);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<'solver' | 'hmb'>('solver');

  // ── HMB table (F20) ──────────────────────────────────────────────────────
  const hmbTable = useMemo(() => {
    if (!result) return null;
    const feedEdgeIds    = edges.filter(e => nodes.find(n => n.id === e.source)?.type === 'feed').map(e => e.id);
    // product edges: target node has no outgoing edges
    const outDegree      = new Map<string, number>();
    edges.forEach(e => outDegree.set(e.source, (outDegree.get(e.source) ?? 0) + 1));
    const productEdgeIds = edges.filter(e => !outDegree.has(e.target)).map(e => e.id);
    return buildHMBTable(
      result.streams,
      result.recycleEdgeIds ?? [],
      feedEdgeIds,
      productEdgeIds,
    );
  }, [result, nodes, edges]);

  const handleCopyHMB = useCallback((fmt: 'csv' | 'md') => {
    if (!hmbTable) return;
    const text = fmt === 'csv' ? hmbTableToCSV(hmbTable) : hmbTableToMarkdown(hmbTable);
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [hmbTable]);

  const handleSortKey = (label: string) => {
    const key = SORT_LABEL_MAP[label];
    if (!key) return;
    setSortKey((prev) => {
      if (prev !== key) { setSortDir('asc'); return key; }
      const next: SortDir = sortDir === 'asc' ? 'desc' : null;
      setSortDir(next);
      return next ? key : null;
    });
  };

  const handleCopyCSV = useCallback(() => {
    if (!result) return;
    const rows: string[] = [];
    for (const [edgeId, stream] of Object.entries(result.streams)) {
      const vals = computeRow(
        stream.F['A'] ?? 0, stream.F['R'] ?? 0, stream.F['S'] ?? 0,
        stream.T, params.Ca0,
      );
      const label = stream.streamLabel ?? edgeId;
      const route = stream.streamDesc ?? '';
      rows.push(
        `${label},"${route.replace(' → ', '","')}",${vals.flow.toFixed(2)},${vals.T.toFixed(0)},${(vals.Xa * 100).toFixed(1)},${vals.Ca.toFixed(3)},${vals.Cr?.toFixed(3) ?? ''},${vals.Cs?.toFixed(3) ?? ''}`,
      );
    }
    const header = 'Stream,From,To,Flow,T,Xa,Ca,Cr,Cs';
    navigator.clipboard.writeText([header, ...rows].join('\n')).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [result, params.Ca0]);

  if (!result || Object.keys(result.streams).length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Run the simulation to see stream data
        </span>
      </div>
    );
  }

  const recycleIds = new Set(result.recycleEdgeIds);

  const rows: RowData[] = Object.entries(result.streams).map(([edgeId, stream]) => {
    const vals = computeRow(
      stream.F['A'] ?? 0, stream.F['R'] ?? 0, stream.F['S'] ?? 0,
      stream.T, params.Ca0,
    );
    return {
      edgeId,
      label: stream.streamLabel ?? edgeId,
      route: stream.streamDesc ?? '',
      flow: vals.flow,
      T: vals.T,
      Xa: vals.Xa,
      Ca: vals.Ca,
      Cr: vals.Cr,
      Cs: vals.Cs,
      isRecycle: recycleIds.has(edgeId),
    };
  });

  if (sortKey && sortDir) {
    rows.sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      return sortDir === 'asc'
        ? (va > vb ? 1 : va < vb ? -1 : 0)
        : (vb > va ? 1 : vb < va ? -1 : 0);
    });
  }

  const converged = result.converged;

  return (
    <div className="flex flex-col" style={{ maxHeight: 220, borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
            Stream Table
          </span>
          <span style={{
            fontSize: 9, fontWeight: 600,
            color: converged ? 'var(--success)' : 'var(--warn)',
            background: converged ? 'var(--success-soft)' : 'var(--warn-soft)',
            borderRadius: 8, padding: '1px 6px',
          }}>
            {converged ? `✓ converged (${result.iterations} iter)` : `⚠ not converged (${result.iterations} iter)`}
          </span>
          {/* F20: HMB tab toggle */}
          {(['solver', 'hmb'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              fontSize: 9, padding: '1px 6px', borderRadius: 4, cursor: 'pointer',
              border: '1px solid var(--border)',
              background: view === v ? 'var(--accent)' : 'var(--bg-inset)',
              color: view === v ? '#fff' : 'var(--text-primary)',
              fontWeight: view === v ? 700 : 400,
            }}>
              {v === 'solver' ? 'Solver' : 'HMB'}
            </button>
          ))}
        </div>
        {view === 'solver' ? (
          <button onClick={handleCopyCSV} style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4,
            border: '1px solid var(--border)', background: 'var(--bg-inset)',
            color: 'var(--text-primary)', cursor: 'pointer',
          }}>
            {copied ? '✓ Copied' : '⬇ CSV'}
          </button>
        ) : (
          <div className="flex gap-1">
            <button onClick={() => handleCopyHMB('csv')} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              border: '1px solid var(--border)', background: 'var(--bg-inset)',
              color: 'var(--text-primary)', cursor: 'pointer',
            }}>
              {copied ? '✓' : '⬇ CSV'}
            </button>
            <button onClick={() => handleCopyHMB('md')} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              border: '1px solid var(--border)', background: 'var(--bg-inset)',
              color: 'var(--text-primary)', cursor: 'pointer',
            }}>
              MD
            </button>
          </div>
        )}
      </div>

      {view === 'hmb' && hmbTable ? (
        <HMBView table={hmbTable} />
      ) : (
      <div className="overflow-y-auto flex-1 min-h-0">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0" style={{ background: 'var(--bg-inset)' }}>
            <tr>
              <th className="text-left px-2 py-0.5 font-medium" style={{ color: 'var(--text-primary)' }}>Stream</th>
              <th className="text-left px-2 py-0.5 font-medium" style={{ color: 'var(--text-primary)' }}>Route</th>
              <SortableHeader label="Flow"       sortKey={sortKey} sortDir={sortDir} onToggle={handleSortKey} />
              <SortableHeader label="T (K)"      sortKey={sortKey} sortDir={sortDir} onToggle={handleSortKey} />
              <SortableHeader label="Xₐ"         sortKey={sortKey} sortDir={sortDir} onToggle={handleSortKey} />
              <SortableHeader label="Cₐ"         sortKey={sortKey} sortDir={sortDir} onToggle={handleSortKey} />
              <th className="text-right px-2 py-0.5 font-medium" style={{ color: 'var(--text-primary)' }}>Cᵣ</th>
              <th className="text-right px-2 py-0.5 font-medium" style={{ color: 'var(--text-primary)' }}>Cₛ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.edgeId}
                style={{ background: row.isRecycle ? 'var(--accent-soft)' : undefined }}
              >
                <td className="px-2 py-0.5">
                  <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {row.label}
                  </span>
                </td>
                <td className="px-2 py-0.5">
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {row.route}
                  </span>
                </td>
                <td className="text-right px-2 py-0.5">
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                    {row.flow.toFixed(2)}
                  </span>
                </td>
                <td className="text-right px-2 py-0.5">
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                    {row.T.toFixed(0)}
                  </span>
                </td>
                <td className="text-right px-2 py-0.5">
                  <span style={{
                    display: 'inline-block',
                    borderRadius: 10,
                    padding: '1px 6px',
                    fontSize: 10,
                    fontWeight: 600,
                    background: row.Xa >= 0.8 ? 'var(--success-soft)' : row.Xa >= 0.5 ? 'var(--warn-soft)' : 'var(--danger-soft)',
                    color: row.Xa >= 0.8 ? 'var(--success)' : row.Xa >= 0.5 ? 'var(--warn)' : 'var(--danger)',
                  }}>
                    {(row.Xa * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="text-right px-2 py-0.5">
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                    {row.Ca.toFixed(3)}
                  </span>
                </td>
                <td className="text-right px-2 py-0.5">
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                    {row.Cr !== null ? row.Cr.toFixed(3) : '—'}
                  </span>
                </td>
                <td className="text-right px-2 py-0.5">
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                    {row.Cs !== null ? row.Cs.toFixed(3) : '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

// ─── F20: HMB View ────────────────────────────────────────────────────────────

import type { HMBTable } from '../../math/streamTableMapper';

function HMBView({ table }: { table: HMBTable }) {
  const { streams, speciesIds, massBalance, closed } = table;

  const cell = (v: string) => (
    <td className="text-right px-2 py-0.5">
      <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{v}</span>
    </td>
  );
  const labelCell = (v: string, muted = false) => (
    <td className="px-2 py-0.5 sticky left-0" style={{ background: 'var(--bg-inset)', minWidth: 110 }}>
      <span style={{ fontSize: 10, color: muted ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: muted ? 400 : 600 }}>{v}</span>
    </td>
  );

  const closedBadge = (
    <span style={{
      fontSize: 9, fontWeight: 700, borderRadius: 8, padding: '1px 6px',
      background: closed ? 'var(--success-soft)' : 'var(--warn-soft)',
      color: closed ? 'var(--success)' : 'var(--warn)',
    }}>
      {closed ? '✓ balanced' : '⚠ imbalanced'}
    </span>
  );

  return (
    <div className="overflow-auto flex-1 min-h-0">
      {/* balance badge */}
      <div className="px-3 py-1 flex items-center gap-2">
        {closedBadge}
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
          mass: in {massBalance.inlet_g_s.toFixed(2)} g/s · out {massBalance.outlet_g_s.toFixed(2)} g/s · err {massBalance.errorPct.toFixed(3)} %
        </span>
      </div>
      {/* HMB table: rows = properties, columns = streams */}
      <table style={{ borderCollapse: 'collapse', fontSize: 10 }}>
        <thead style={{ background: 'var(--bg-inset)' }}>
          <tr>
            <th className="text-left px-2 py-0.5 sticky left-0" style={{ background: 'var(--bg-inset)', minWidth: 110, color: 'var(--text-primary)', fontWeight: 600 }}>Property</th>
            {streams.map(s => (
              <th key={s.edgeId} className="text-right px-2 py-0.5" style={{ minWidth: 72, color: s.isRecycle ? 'var(--accent)' : 'var(--text-primary)', fontWeight: 700 }}>
                {s.label}{s.isRecycle ? ' ♻' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr><td colSpan={streams.length + 1} style={{ borderTop: '1px solid var(--border)', padding: 0 }} /></tr>
          <tr>
            {labelCell('Description', true)}
            {streams.map(s => <td key={s.edgeId} className="text-right px-2 py-0.5"><span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{s.description}</span></td>)}
          </tr>
          <tr>
            {labelCell('T [°C]')}
            {streams.map(s => cell(s.T_C.toFixed(1)))}
          </tr>
          <tr>
            {labelCell('P [bar]')}
            {streams.map(s => cell(s.P_bar.toFixed(3)))}
          </tr>
          <tr>
            {labelCell('Vapor frac [—]')}
            {streams.map(s => cell(s.vaporFraction.toFixed(3)))}
          </tr>
          <tr><td colSpan={streams.length + 1} style={{ borderTop: '1px solid var(--border)', padding: 0 }} /></tr>
          <tr>
            {labelCell('F_total [mol/s]')}
            {streams.map(s => cell(s.F_total_mol_s.toFixed(4)))}
          </tr>
          <tr>
            {labelCell('Mass [g/s]')}
            {streams.map(s => cell(s.mass_total_g_s.toFixed(3)))}
          </tr>
          <tr>
            {labelCell('H [kJ/mol]')}
            {streams.map(s => cell(s.H_kJ_mol.toFixed(3)))}
          </tr>
          <tr><td colSpan={streams.length + 1} style={{ borderTop: '1px solid var(--border)', padding: 0 }} /></tr>
          {speciesIds.map(id => (
            <tr key={id}>
              {labelCell(`  F_${id} [mol/s]`, true)}
              {streams.map(s => cell((s.F_mol_s[id] ?? 0).toFixed(4)))}
            </tr>
          ))}
          <tr><td colSpan={streams.length + 1} style={{ borderTop: '1px solid var(--border)', padding: 0 }} /></tr>
          {speciesIds.map(id => (
            <tr key={`y_${id}`}>
              {labelCell(`  y_${id} [mol/mol]`, true)}
              {streams.map(s => cell((s.x_mol[id] ?? 0).toFixed(4)))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onToggle: (label: string) => void;
}) {
  const key = SORT_LABEL_MAP[label];
  const active = key !== undefined && sortKey === key;
  const arrow = !active ? '' : sortDir === 'asc' ? ' ▲' : ' ▼';
  return (
    <th
      className="text-right px-2 py-0.5 font-medium cursor-pointer select-none stream-th-sort"
      style={{ color: 'var(--text-primary)' }}
      onClick={() => onToggle(label)}
    >
      <span style={{ fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 9 }}>{arrow}</span>
    </th>
  );
}
