import { useState } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useSimulatorStore } from '../../store/simulatorStore';

export default function SelectivityPanel() {
  const result = useSimulatorStore((s) => s.result);
  const reactionMode = useSimulatorStore((s) => s.params.reactionMode);
  const [expanded, setExpanded] = useState(true);

  if (reactionMode === 'single' || !result?.selectivityAnalysis) return null;

  const { SR, YR_curve, Da_opt, Da_current } = result.selectivityAnalysis;
  const isParallel = reactionMode === 'parallel';

  return (
    <div className="shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold transition-colors rsi-hover-surface"
        style={{ color: 'var(--text-primary)' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span>⚗ Selectivity Analysis</span>
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      {expanded && (
        <div style={{ padding: '6px 12px 10px' }}>
          {/* Selectivity badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
              background: isParallel ? '#7c3aed18' : '#0d948818',
              border: `1px solid ${isParallel ? '#7c3aed44' : '#0d948844'}`,
              borderRadius: 6, padding: '4px 12px',
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>S_R</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: isParallel ? '#7c3aed' : '#0d9488', fontFamily: 'monospace' }}>
                {(SR * 100).toFixed(1)}%
              </span>
            </div>
            {isParallel ? (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4, maxWidth: 200 }}>
                Selectivity S_R = k₁/(k₁+k₂) — constant for equal-order kinetics; CSTR and PFR give the same S_R.
              </div>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4, maxWidth: 200 }}>
                Instantaneous S_R at current Da.
                {Da_opt && <> Optimal Da = <strong style={{ color: '#ca8a04' }}>{Da_opt.toFixed(2)}</strong>.</>}
              </div>
            )}
          </div>

          {/* Yield curve */}
          <div style={{ height: 120, background: 'var(--plot-bg)', borderRadius: 4 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={YR_curve} margin={{ top: 6, right: 8, left: -10, bottom: 14 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="Da"
                  type="number"
                  tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                  label={{ value: 'Damköhler Da', position: 'insideBottom', offset: -4, fontSize: 9, fill: 'var(--text-muted)' }}
                />
                <YAxis
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', fontSize: 10, color: 'var(--text-primary)' }}
                  labelFormatter={(v) => `Da = ${Number(v).toFixed(2)}`}
                  formatter={(v: unknown) => [`${((v as number) * 100).toFixed(2)}%`, 'Y_R']}
                />
                <Line
                  dataKey="YR"
                  stroke={isParallel ? '#7c3aed' : '#0d9488'}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                {Da_current !== undefined && (
                  <ReferenceLine
                    x={Da_current}
                    stroke="#2563eb"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    label={{ value: 'Da_now', position: 'top', fontSize: 8, fill: '#2563eb' }}
                  />
                )}
                {Da_opt !== undefined && (
                  <ReferenceLine
                    x={Da_opt}
                    stroke="#ca8a04"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    label={{ value: '◆ Da_opt', position: 'top', fontSize: 8, fill: '#ca8a04' }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
