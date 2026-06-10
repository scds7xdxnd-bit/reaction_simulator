import { useMemo, useState } from 'react';
import {
  ComposedChart,
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

export default function TemperatureProfile() {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);
  const cfg = useSimulatorStore((s) => s.plotConfig['temperature']);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const profileData = useMemo(() => {
    if (!result) return { allPoints: [] as { cumTau: number; T: number; Xa: number }[], boundaries: [] as { cumTau: number; label: string }[], segs: [] as { reactorId: string; label: string; Xa_in: number; Xa_out: number; T_in: number; T_out: number; Da: number; tau: number; startTau: number; endTau: number }[] };
    const allPoints: { cumTau: number; T: number; Xa: number }[] = [];
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
        allPoints.push({ cumTau: p.cumTau, T: p.T, Xa: p.Xa });
      }
      if (seg.profile.length > 0) {
        const last = seg.profile[seg.profile.length - 1];
        boundaries.push({ cumTau: last.cumTau, label: seg.label });
      }
    }

    allPoints.sort((a, b) => a.cumTau - b.cumTau);
    return { allPoints, boundaries, segs };
  }, [result]);

  const tRange = useMemo(() => {
    if (profileData.allPoints.length === 0) {
      return { tMin: 290, tMax: 310, tauMax: 5 };
    }
    const temps = profileData.allPoints.map((p) => p.T).filter(isFinite);
    const tMin = temps.length ? Math.min(...temps) : 290;
    const tMax = temps.length ? Math.max(...temps) : 310;
    const tauMax = profileData.allPoints[profileData.allPoints.length - 1]?.cumTau ?? 5;
    return { tMin, tMax, tauMax: Math.max(tauMax, 1) };
  }, [profileData]);

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
        Add reactors to the flowsheet to see the temperature profile
      </div>
    );
  }

  const T_feed = params.T_feed ?? 300;

  const xDomainFinal: [number, number] = [cfg.xMin ?? 0, cfg.xMax ?? tRange.tauMax];
  const yDomainFinal: [number, number] = [
    cfg.yMin ?? (tRange.tMin - 10),
    cfg.yMax ?? (tRange.tMax + 10),
  ];

  return (
    <div className="flex flex-col h-full">
      <PlotAxisBar plotId="temperature" />
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={profileData.allPoints} margin={{ top: 8, right: 16, left: -10, bottom: 12 }}>
            <XAxis
              dataKey="cumTau"
              type="number"
              domain={xDomainFinal}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#dde3f0' }}
              label={{ value: 'cumulative τ (s)', position: 'bottom', offset: 0, fontSize: 10, fill: '#6b7280' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#dde3f0' }}
              domain={yDomainFinal}
              allowDataOverflow
              label={{ value: 'T (K)', angle: -90, position: 'left', offset: 0, fontSize: 10, fill: '#6b7280' }}
            />
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #dde3f0', borderRadius: 4, fontSize: 11 }}
              cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
              formatter={(value: number, name: string) => {
                if (name === 'T') return [`${value.toFixed(1)} K`, 'Temperature'];
                return [`${(value * 100).toFixed(1)}%`, 'Xa'];
              }}
              labelFormatter={(t: number) => `τ = ${t.toFixed(2)} s`}
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

            <Line
              type="linear"
              dataKey="T"
              stroke="#d97706"
              strokeWidth={2}
              dot={false}
              name="T"
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
