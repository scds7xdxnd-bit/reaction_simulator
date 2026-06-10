import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useSimulatorStore } from '../../store/simulatorStore';

const TOL = 1e-6;

export default function RecyclePanel() {
  const result = useSimulatorStore((s) => s.result);
  const [expanded, setExpanded] = useState(true);

  if (!result || result.recycleEdgeIds.length === 0) return null;

  const {
    recycleEdgeIds, recycleHistory, recycleConvergenceData,
    converged, iterations, streams,
  } = result;

  return (
    <div className="border-b border-[#dde3f0] bg-white shrink-0">

      {/* ── Header ── */}
      <button
        className="w-full flex items-center justify-between px-3 py-2
                   text-[11px] font-semibold text-[#1e293b] hover:bg-[#f8faff]
                   transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex items-center gap-1.5">
          <span style={{ color: '#7c3aed' }}>↺</span>
          Recycle Convergence
          <span className="text-[10px] font-mono text-[#94a3b8]">
            ({recycleEdgeIds.length} tear edge{recycleEdgeIds.length > 1 ? 's' : ''})
          </span>
        </span>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded"
          style={converged
            ? { background: '#dcfce7', color: '#166534' }
            : { background: '#fee2e2', color: '#7f1d1d' }}
        >
          {converged
            ? `✓ Converged — ${iterations} iter`
            : `⚠ Max iter (${iterations})`}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">

          {/* ── Convergence chart ── */}
          <div style={{ height: 110 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={recycleHistory}
                margin={{ top: 4, right: 10, bottom: 0, left: -10 }}
              >
                <XAxis
                  dataKey="iteration"
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  label={{ value: 'iteration', position: 'insideBottomRight', offset: -4, fontSize: 9, fill: '#94a3b8' }}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  tickFormatter={(v: number) =>
                    v === 0 ? '0' : v.toExponential(0)
                  }
                  width={44}
                />
                <ReferenceLine
                  y={TOL}
                  stroke="#16a34a"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{ value: 'tol', position: 'right', fontSize: 8, fill: '#16a34a' }}
                />
                <Tooltip
                  contentStyle={{ fontSize: 10, padding: '3px 8px' }}
                  formatter={(v: number) => [v.toExponential(3), 'max |ΔXa|']}
                  labelFormatter={(l: number) => `Iteration ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="maxError"
                  stroke="#7c3aed"
                  strokeWidth={1.5}
                  dot={recycleHistory.length <= 20}
                  activeDot={{ r: 3 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ── Tear-edge table ── */}
          <table className="w-full" style={{ fontSize: 10, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>
                <th className="text-left py-1 font-medium">Stream</th>
                <th className="text-right font-medium">Xa assumed</th>
                <th className="text-right font-medium">Xa computed</th>
                <th className="text-right font-medium">|ΔXa|</th>
              </tr>
            </thead>
            <tbody>
              {recycleEdgeIds.map((edgeId) => {
                const cd    = recycleConvergenceData[edgeId];
                const label = streams[edgeId]?.streamLabel ?? edgeId;
                if (!cd) return null;
                const tight = cd.error < 1e-4;
                return (
                  <tr key={edgeId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td className="py-0.5 font-mono" style={{ color: '#7c3aed' }}>
                      {label}
                    </td>
                    <td className="text-right font-mono" style={{ color: '#374151' }}>
                      {cd.assumedXa.toFixed(4)}
                    </td>
                    <td className="text-right font-mono" style={{ color: '#374151' }}>
                      {cd.computedXa.toFixed(4)}
                    </td>
                    <td
                      className="text-right font-mono"
                      style={{ color: tight ? '#16a34a' : '#d97706' }}
                    >
                      {cd.error.toExponential(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

        </div>
      )}
    </div>
  );
}
