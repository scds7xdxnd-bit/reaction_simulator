import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useSimulatorStore } from '../../store/simulatorStore';
import PlotAxisBar from './PlotAxisBar';

export default function TemperatureProfile() {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);
  const cfg = useSimulatorStore((s) => s.plotConfig['temperature']);

  const profileData = useMemo(() => {
    if (!result) return { allPoints: [] as { cumTau: number; T: number; Xa: number }[] };
    const allPoints: { cumTau: number; T: number; Xa: number }[] = [];

    for (const seg of result.segments) {
      for (const p of seg.profile) {
        allPoints.push({ cumTau: p.cumTau, T: p.T, Xa: p.Xa });
      }
    }

    allPoints.sort((a, b) => a.cumTau - b.cumTau);
    return { allPoints };
  }, [result]);

  // Must be before early returns — Rules of Hooks
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
              formatter={(value: number, name: string) => {
                if (name === 'T') return [`${value.toFixed(1)} K`, 'Temperature'];
                return [`${(value * 100).toFixed(1)}%`, 'Xa'];
              }}
              labelFormatter={(t: number) => `τ = ${t.toFixed(2)} s`}
            />
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
    </div>
  );
}
