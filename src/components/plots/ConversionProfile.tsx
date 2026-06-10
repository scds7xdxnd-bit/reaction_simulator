import { useMemo, useState } from 'react';
import {
  ComposedChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ReferenceArea,
  Label,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useSimulatorStore } from '../../store/simulatorStore';
import PlotAxisBar from './PlotAxisBar';

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <span style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: '#0f1730', fontWeight: 600, fontFamily: 'monospace' }}>
        {value}
      </span>
    </div>
  );
}

export default function ConversionProfile() {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);
  const cfg = useSimulatorStore((s) => s.plotConfig['conversion']);
  const [view, setView] = useState<'Xa' | 'Ca'>('Xa');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const profileData = useMemo(() => {
    if (!result) return { allPoints: [] as { cumTau: number; Xa: number; Ca: number }[], boundaries: [] as { cumTau: number; label: string }[], segs: [] as { reactorId: string; label: string; Xa_in: number; Xa_out: number; T_in: number; T_out: number; Da: number; tau: number; startTau: number; endTau: number }[] };
    const allPoints: { cumTau: number; Xa: number; Ca: number }[] = [];
    const boundaries: { cumTau: number; label: string }[] = [];
    const segs: { reactorId: string; label: string; Xa_in: number; Xa_out: number; T_in: number; T_out: number; Da: number; tau: number; startTau: number; endTau: number }[] = [];

    for (let i = 0; i < result.segments.length; i++) {
      const seg = result.segments[i];
      const startTau = i === 0 ? 0 : (result.segments[i - 1].profile[result.segments[i - 1].profile.length - 1]?.cumTau ?? 0);
      const endTau = seg.profile[seg.profile.length - 1]?.cumTau ?? 0;

      segs.push({
        reactorId: seg.reactorId,
        label: seg.label,
        Xa_in: seg.Xa_in,
        Xa_out: seg.Xa_out,
        T_in: seg.T_in,
        T_out: seg.T_out,
        Da: seg.Da,
        tau: seg.tau,
        startTau,
        endTau,
      });

      for (const p of seg.profile) {
        allPoints.push({ cumTau: p.cumTau, Xa: p.Xa, Ca: p.Ca });
      }
      if (seg.profile.length > 0) {
        const last = seg.profile[seg.profile.length - 1];
        boundaries.push({ cumTau: last.cumTau, label: seg.label });
      }
    }

    allPoints.sort((a, b) => a.cumTau - b.cumTau);
    return { allPoints, boundaries, segs };
  }, [result]);

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-[#6b7280] text-sm">
        No simulation data
      </div>
    );
  }

  if (result.segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[#6b7280] text-sm text-center px-4">
        Add reactors to the flowsheet to see the conversion profile
      </div>
    );
  }

  const maxTau = profileData.allPoints.length > 0
    ? profileData.allPoints[profileData.allPoints.length - 1].cumTau
    : 5;

  const autoXMax = Math.max(maxTau * 1.05, 5);
  const xDomainFinal: [number, number] = [cfg.xMin ?? 0, cfg.xMax ?? autoXMax];

  const yDomainXa: [number, number] = [cfg.yMin ?? 0, cfg.yMax ?? 1];
  const yDomainCa: [number, number] = [cfg.yMin ?? 0, cfg.yMax ?? (params.Ca0 * 1.05)];

  const dataKey = view === 'Xa' ? 'Xa' : 'Ca';
  const strokeColor = view === 'Xa' ? '#0f1730' : '#0d9488';
  const yDomain = view === 'Xa' ? yDomainXa : yDomainCa;

  const yTickFormatter = view === 'Xa'
    ? (v: number) => `${(v * 100).toFixed(0)}%`
    : (v: number) => v.toFixed(2);

  const yAxisLabel = view === 'Xa' ? 'Conversion, Xₐ' : 'Cₐ (mol/L)';

  const tooltipFormatter = view === 'Xa'
    ? (_value: unknown) => [`${((Number(_value) as number) * 100).toFixed(1)}%`, 'Xₐ']
    : (_value: unknown) => [`${Number(_value).toFixed(3)} mol/L`, 'Cₐ'];

  return (
    <div className="flex flex-col h-full">
      <PlotAxisBar plotId="conversion" />
      <div style={{ display: 'flex', gap: 4, paddingLeft: 12, paddingBottom: 4 }}>
        {(['Xa', 'Ca'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            style={{
              fontSize: 10, padding: '1px 8px', borderRadius: 4, cursor: 'pointer',
              border: '1px solid #dde3f0',
              background: view === v ? '#0f1730' : '#f8faff',
              color:      view === v ? '#ffffff' : '#6b7280',
              fontWeight: view === v ? 600 : 400,
            }}>
            {v === 'Xa' ? 'Xₐ(τ)' : 'C(τ)'}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0" style={{ background: 'var(--plot-bg)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={profileData.allPoints}
            margin={{ top: 20, right: 10, left: 10, bottom: 30 }}
          >
            <text
              x={10}
              y={12}
              fill="#6b7280"
              fontSize={11}
              fontWeight={600}
              style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              {view === 'Xa' ? 'CONVERSION PROFILE' : 'CONCENTRATION PROFILE'}
            </text>

            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 4,
                fontSize: 12,
                color: 'var(--text-primary)',
              }}
              cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
              labelFormatter={(val) => `τ = ${Number(val).toFixed(2)} s`}
              formatter={tooltipFormatter}
            />

            {profileData.segs.map((seg, i) => (
              <ReferenceArea
                key={seg.reactorId}
                x1={seg.startTau} x2={seg.endTau}
                fill={selectedIdx === i ? '#2563eb08' : 'transparent'}
                onClick={() => setSelectedIdx(i === selectedIdx ? null : i)}
                style={{ cursor: 'pointer' }}
                ifOverflow="visible"
              />
            ))}

            {profileData.boundaries.map((b, i) => (
              <ReferenceLine
                key={`b-${i}`}
                x={b.cumTau}
                stroke={selectedIdx === i ? '#2563eb' : '#b0bcd4'}
                strokeDasharray="4 4"
                strokeWidth={selectedIdx === i ? 2 : 1}
              >
                <Label
                  value={b.label}
                  position="top"
                  fill="#374151"
                  fontSize={9}
                  offset={2}
                />
              </ReferenceLine>
            ))}

            {view === 'Xa' && result.Xa_eq != null && (
              <ReferenceLine
                y={result.Xa_eq}
                stroke="#dc2626"
                strokeDasharray="6 3"
                strokeWidth={1.5}
              >
                <Label
                  value={`Xeq = ${result.Xa_eq.toFixed(2)}`}
                  position="right"
                  fill="#dc2626"
                  fontSize={9}
                  offset={4}
                />
              </ReferenceLine>
            )}

            <Line
              dataKey={dataKey}
              stroke={strokeColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />

            <XAxis
              dataKey="cumTau"
              type="number"
              domain={xDomainFinal}
              stroke="var(--text-muted)"
              fontSize={11}
              label={{
                value: 'Cumulative τ (s)',
                position: 'insideBottom',
                offset: -5,
                fill: 'var(--text-muted)',
                fontSize: 11,
              }}
              tick={{ fill: 'var(--text-muted)' }}
            />
            <YAxis
              type="number"
              domain={yDomain}
              allowDataOverflow
              tickFormatter={yTickFormatter}
              stroke="var(--text-muted)"
              fontSize={11}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: 'insideLeft',
                fill: 'var(--text-muted)',
                fontSize: 11,
              }}
              tick={{ fill: 'var(--text-muted)' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {selectedIdx !== null && profileData.segs[selectedIdx] && (() => {
        const seg = profileData.segs[selectedIdx];
        return (
          <div style={{
            flexShrink: 0, height: 52, borderTop: '1px solid #dde3f0',
            background: '#f8faff', display: 'flex', alignItems: 'center',
            gap: 20, paddingLeft: 16, paddingRight: 12, overflow: 'hidden',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0f1730', minWidth: 60 }}>
              {seg.label}
            </span>
            <KV label="Xₐ" value={`${(seg.Xa_in * 100).toFixed(1)}% → ${(seg.Xa_out * 100).toFixed(1)}%`} />
            <KV label="T" value={`${seg.T_in.toFixed(0)} → ${seg.T_out.toFixed(0)} K`} />
            <KV label="Da" value={seg.Da.toFixed(2)} />
            <KV label="τ" value={`${seg.tau.toFixed(2)} s`} />
            <button onClick={() => setSelectedIdx(null)}
              style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8', background: 'none',
                       border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        );
      })()}
    </div>
  );
}
