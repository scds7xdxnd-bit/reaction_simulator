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

export default function TemperatureProfile() {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);

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

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={profileData.allPoints} margin={{ top: 8, right: 16, left: -10, bottom: 12 }}>
        <XAxis
          dataKey="cumTau"
          type="number"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#dde3f0' }}
          label={{ value: 'cumulative τ (s)', position: 'bottom', offset: 0, fontSize: 10, fill: '#6b7280' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#dde3f0' }}
          domain={['dataMin - 10', 'dataMax + 10']}
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
  );
}
