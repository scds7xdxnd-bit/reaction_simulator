import { useState, useMemo } from 'react';
import {
  ComposedChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useSimulatorStore } from '../../store/simulatorStore';
import { computeRTD } from '../../math/rtdModel';

export default function RTDPanel() {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);
  const [open, setOpen] = useState(false);
  const [N, setN] = useState(3);

  const rtd = useMemo(() => {
    if (!result) return null;
    const totalTau = result.segments.reduce((s, seg) => s + seg.tau, 0);
    if (totalTau <= 0) return null;
    const Da = params.k * totalTau;
    return computeRTD(totalTau, N, Da);
  }, [result, params.k, N]);

  if (!result) return null;

  return (
    <div style={{ borderTop: '1px solid #dde3f0', background: 'var(--surface)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', textAlign: 'left', padding: '6px 12px',
          fontSize: 11, fontWeight: 700, color: '#374151',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}
      >
        <span style={{ fontSize: 9 }}>{open ? '▼' : '▶'}</span>
        RTD Analysis — Tanks-in-Series
      </button>

      {open && rtd && (
        <div style={{ padding: '8px 12px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>
              N tanks:
            </label>
            <input
              type="range" min={1} max={20} value={N}
              onChange={(e) => setN(Number(e.target.value))}
              style={{ width: 120 }}
            />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0f1730', minWidth: 16 }}>{N}</span>
          </div>

          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rtd.curve} margin={{ top: 8, right: 8, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)', border: '1px solid var(--border-subtle)',
                    borderRadius: 4, fontSize: 11, color: 'var(--text-primary)',
                  }}
                  labelFormatter={(v) => `t = ${Number(v).toFixed(1)} s`}
                  formatter={(v: unknown, name: string) => [Number(v).toFixed(4), name]}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line dataKey="E_TIS"  name={`TIS (N=${N})`} stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="E_CSTR" name="CSTR (N=1)"   stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                <Line dataKey="E_PFR"  name="PFR (N→∞)"   stroke="#d97706" strokeWidth={1.5} strokeDasharray="2 2" dot={false} isAnimationActive={false} />
                <XAxis dataKey="t" type="number" fontSize={9} stroke="var(--text-muted)"
                  label={{ value: 'Time (s)', position: 'insideBottom', offset: -5, fontSize: 9, fill: 'var(--text-muted)' }}
                  tick={{ fill: 'var(--text-muted)' }} />
                <YAxis fontSize={9} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8,
          }}>
            {[
              { label: 'CSTR (N=1)',      Xa: rtd.Xa_CSTR, color: '#94a3b8' },
              { label: `TIS (N=${N})`,    Xa: rtd.Xa_TIS,  color: '#2563eb' },
              { label: 'PFR (N→∞)',      Xa: rtd.Xa_PFR,  color: '#d97706' },
            ].map(({ label, Xa, color }) => (
              <div key={label} style={{
                background: '#f8faff', border: `1px solid ${color}33`,
                borderRadius: 6, padding: '5px 8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'monospace' }}>
                  {(Xa * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: 8, color: '#9ca3af' }}>Xₐ (1st order)</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
