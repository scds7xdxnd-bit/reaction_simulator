import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Label,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useSimulatorStore } from '../../store/simulatorStore';

export default function SpeciesProfile() {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);

  const profileData = useMemo(() => {
    if (!result) return { allPoints: [], boundaries: [] };
    const allPoints: { cumTau: number; Ca: number; Cr: number; Cs: number }[] = [];
    const boundaries: { cumTau: number; label: string }[] = [];

    for (const seg of result.segments) {
      for (const p of seg.profile) {
        allPoints.push({ cumTau: p.cumTau, Ca: p.Ca, Cr: p.Cr, Cs: p.Cs });
      }
      if (seg.profile.length > 0) {
        const last = seg.profile[seg.profile.length - 1];
        boundaries.push({ cumTau: last.cumTau, label: seg.label });
      }
    }

    allPoints.sort((a, b) => a.cumTau - b.cumTau);
    return { allPoints, boundaries };
  }, [result]);

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-[#6b7280] text-sm">
        No simulation data
      </div>
    );
  }

  const maxTau = profileData.allPoints.length > 0
    ? profileData.allPoints[profileData.allPoints.length - 1].cumTau
    : 5;

  return (
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
          SPECIES PROFILE
        </text>

        <Legend
          verticalAlign="top"
          align="right"
          wrapperStyle={{ fontSize: 10, paddingRight: 10 }}
          iconType="line"
        />

        <Tooltip
          contentStyle={{
            backgroundColor: '#ffffff',
            border: '1px solid #dde3f0',
            borderRadius: 4,
            fontSize: 12,
          }}
          labelFormatter={(val) => `τ = ${Number(val).toFixed(2)} s`}
          formatter={(value: unknown) => [`${(value as number).toFixed(3)} mol/L`]}
        />

        {profileData.boundaries.map((b, i) => (
          <ReferenceLine
            key={`b-${i}`}
            x={b.cumTau}
            stroke="#b0bcd4"
            strokeDasharray="4 4"
            strokeWidth={1}
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
          dataKey="Ca"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          name="A (Reactant)"
        />
        <Line
          dataKey="Cr"
          stroke="#16a34a"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          name="R (Desired)"
        />
        <Line
          dataKey="Cs"
          stroke="#dc2626"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          name="S (Byproduct)"
        />

        <XAxis
          dataKey="cumTau"
          type="number"
          domain={[0, Math.max(maxTau * 1.05, 5)]}
          stroke="#374151"
          fontSize={11}
          label={{
            value: 'Cumulative τ (s)',
            position: 'insideBottom',
            offset: -5,
            fill: '#374151',
            fontSize: 11,
          }}
          tick={{ fill: '#374151' }}
        />
        <YAxis
          type="number"
          domain={[0, params.Ca0 * 1.05]}
          stroke="#374151"
          fontSize={11}
          label={{
            value: 'Concentration (mol/L)',
            angle: -90,
            position: 'insideLeft',
            fill: '#374151',
            fontSize: 11,
          }}
          tick={{ fill: '#374151' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
