import { useState, useCallback } from 'react';
import { useSimulatorStore } from '../../store/simulatorStore';

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
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [copied, setCopied] = useState(false);

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
            fontSize: 9,
            fontWeight: 600,
            color: converged ? 'var(--success)' : 'var(--warn)',
            background: converged ? 'var(--success-soft)' : 'var(--warn-soft)',
            borderRadius: 8,
            padding: '1px 6px',
          }}>
            {converged
              ? `✓ converged (${result.iterations} iter)`
              : `⚠ not converged (${result.iterations} iter)`}
          </span>
        </div>
        <button
          onClick={handleCopyCSV}
          style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4,
            border: '1px solid var(--border)', background: 'var(--bg-inset)',
            color: 'var(--text-primary)', cursor: 'pointer',
          }}
        >
          {copied ? '✓ Copied' : '⬇ CSV'}
        </button>
      </div>

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
