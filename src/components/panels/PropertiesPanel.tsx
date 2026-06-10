import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useSimulatorStore } from '../../store/simulatorStore';
import type { ReactorNodeData } from '../../types/reactor';

const thermalOptions = [
  { value: 'isothermal', label: 'Isothermal' },
  { value: 'adiabatic',  label: 'Adiabatic' },
  { value: 'cooled',     label: 'Cooled' },
] as const;

const typeBadgeColor: Record<string, string> = {
  cstr:  '#2563eb',
  pfr:   '#d97706',
  batch: '#be123c',
};

export default function PropertiesPanel({ onClose }: { onClose: () => void }) {
  const propertiesNodeId    = useSimulatorStore((s) => s.propertiesNodeId);
  const nodes               = useSimulatorStore((s) => s.nodes);
  const result              = useSimulatorStore((s) => s.result);
  const params              = useSimulatorStore((s) => s.params);
  const sizingMode          = useSimulatorStore((s) => s.sizingMode);
  const updateReactorTau    = useSimulatorStore((s) => s.updateReactorTau);
  const updateNodeThermal   = useSimulatorStore((s) => s.updateNodeThermal);
  const updateNodeLabel     = useSimulatorStore((s) => s.updateNodeLabel);

  const node = nodes.find((n) => n.id === propertiesNodeId);
  const [editingLabel, setEditingLabel] = useState(false);

  if (!node) return null;

  const data = node.data as unknown as ReactorNodeData;
  const segment = result?.segments.find((s) => s.reactorId === node.id);
  const accentColor = typeBadgeColor[node.type ?? 'cstr'] ?? '#2563eb';
  const Da = params.k * data.tau;
  const V  = sizingMode ? (data.tau * params.Q_feed).toFixed(2) : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--surface)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderBottom: '1px solid var(--border)',
          borderLeft: `3px solid ${accentColor}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 10, fontWeight: 700, color: '#fff',
              background: accentColor, borderRadius: 4, padding: '1px 6px',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}
          >
            {node.type?.toUpperCase()}
          </span>
          {editingLabel ? (
            <input
              autoFocus
              defaultValue={data.label}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v) updateNodeLabel(node.id, v);
                setEditingLabel(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setEditingLabel(false);
              }}
              style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                background: 'var(--surface-raised)', border: '1px solid var(--border)',
                borderRadius: 4, padding: '1px 6px', outline: 'none', width: 120,
              }}
            />
          ) : (
            <span
              onClick={() => setEditingLabel(true)}
              title="Click to rename"
              style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                cursor: 'text', borderBottom: '1px dashed var(--border-mid)',
              }}
            >
              {data.label}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ fontSize: 14, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>

      {/* τ Slider */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Residence Time τ
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: accentColor, fontFamily: 'monospace' }}>
            {data.tau.toFixed(2)} s
          </span>
        </div>
        <input
          type="range"
          min={0.01} max={100} step={0.01}
          value={data.tau}
          onChange={(e) => updateReactorTau(node.id, parseFloat(e.target.value))}
          style={{ width: '100%', accentColor }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>0.01 s</span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>100 s</span>
        </div>
      </div>

      {/* Thermal mode */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
          Thermal
        </span>
        <select
          value={data.thermalMode}
          onChange={(e) => updateNodeThermal(node.id, { thermalMode: e.target.value as typeof data.thermalMode })}
          style={{
            fontSize: 11, background: 'var(--surface-raised)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '2px 6px', color: 'var(--text-primary)', outline: 'none',
          }}
        >
          {thermalOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Da + Volume */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Da</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: accentColor, fontFamily: 'monospace' }}>{Da.toFixed(3)}</div>
        </div>
        {V !== null && (
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Volume</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{V} L</div>
          </div>
        )}
        {segment && (
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Xₐ out</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: accentColor, fontFamily: 'monospace' }}>{(segment.Xa_out * 100).toFixed(1)}%</div>
          </div>
        )}
      </div>

      {/* Mini conversion profile */}
      {segment && segment.profile.length > 1 && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>
            Conversion Profile
          </div>
          <div style={{ height: 90, background: 'var(--plot-bg)', borderRadius: 4 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={segment.profile} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="cumTau" hide />
                <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', fontSize: 10, color: 'var(--text-primary)' }}
                  labelFormatter={(v) => `τ=${Number(v).toFixed(1)}s`}
                  formatter={(v: unknown) => [`${((v as number) * 100).toFixed(1)}%`, 'Xₐ']}
                />
                <Line dataKey="Xa" stroke={accentColor} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Stream IN/OUT table */}
      {segment && (
        <div style={{ padding: '8px 12px' }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>
            Streams
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {['', 'Cₐ (mol/L)', 'T (K)', 'Xₐ'].map((h) => (
                  <th key={h} style={{ textAlign: 'right', padding: '2px 6px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 9 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { row: 'IN',  Ca: params.Ca0 * (1 - segment.Xa_in),  T: segment.T_in,  Xa: segment.Xa_in  },
                { row: 'OUT', Ca: segment.Ca_out,                     T: segment.T_out, Xa: segment.Xa_out },
              ].map(({ row, Ca, T, Xa }) => (
                <tr key={row} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '3px 6px', color: 'var(--text-muted)', fontWeight: 700, fontSize: 9 }}>{row}</td>
                  <td style={{ textAlign: 'right', padding: '3px 6px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{Ca.toFixed(3)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 6px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{T.toFixed(1)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 6px', fontFamily: 'monospace', color: accentColor }}>{(Xa * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!segment && (
        <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
          Run simulation to see stream data
        </div>
      )}
    </div>
  );
}
