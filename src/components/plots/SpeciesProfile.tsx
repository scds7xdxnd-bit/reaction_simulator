import { useMemo } from 'react';
import {
  ComposedChart,
  CartesianGrid,
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
import PlotAxisBar from './PlotAxisBar';

export default function SpeciesProfile() {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);
  const cfg = useSimulatorStore((s) => s.plotConfig['species']);

  const profileData = useMemo(() => {
    if (!result) return { allPoints: [], boundaries: [], hasT: false, hasU: false };
    const allPoints: { cumTau: number; Ca: number; Cr: number; Cs: number; Ct: number; Cu: number }[] = [];
    const boundaries: { cumTau: number; label: string }[] = [];
    let hasT = false;
    let hasU = false;

    for (const seg of result.segments) {
      for (const p of seg.profile) {
        const Ct = p.Ct ?? 0;
        const Cu = p.Cu ?? 0;
        if (Ct > 1e-10) hasT = true;
        if (Cu > 1e-10) hasU = true;
        allPoints.push({ cumTau: p.cumTau, Ca: p.Ca, Cr: p.Cr, Cs: p.Cs, Ct, Cu });
      }
      if (seg.profile.length > 0) {
        const last = seg.profile[seg.profile.length - 1];
        boundaries.push({ cumTau: last.cumTau, label: seg.label });
      }
    }

    allPoints.sort((a, b) => a.cumTau - b.cumTau);
    return { allPoints, boundaries, hasT, hasU };
  }, [result]);

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-secondary)' }}>
        No simulation data
      </div>
    );
  }

  if (result.segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-center px-4" style={{ color: 'var(--text-secondary)' }}>
        Add reactors to the flowsheet to see the species profile
      </div>
    );
  }

  const { hasT, hasU } = profileData;

  const maxTau = profileData.allPoints.length > 0
    ? profileData.allPoints[profileData.allPoints.length - 1].cumTau
    : 5;

  const autoXMax = Math.max(maxTau * 1.05, 5);
  const xDomainFinal: [number, number] = [cfg.xMin ?? 0, cfg.xMax ?? autoXMax];
  const yDomainFinal: [number, number] = [cfg.yMin ?? 0, cfg.yMax ?? (params.Ca0 * 1.05)];

  return (
    <div className="flex flex-col h-full">
      <PlotAxisBar plotId="species" />
      <div className="flex-1 min-h-0" style={{ background: 'var(--plot-bg)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={profileData.allPoints}
            margin={{ top: 20, right: 10, left: 10, bottom: 30 }}
          >
            <text
              x={10}
              y={12}
              fontSize={11}
              fontWeight={600}
              style={{ fill: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              SPECIES PROFILE
            </text>

            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ fontSize: 10, paddingRight: 10 }}
              iconType="line"
            />

            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 4,
                fontSize: 12,
                color: 'var(--text-primary)',
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
            {hasT && (
              <Line
                dataKey="Ct"
                stroke="#d97706"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                isAnimationActive={false}
                name="T (Byproduct)"
              />
            )}
            {hasU && (
              <Line
                dataKey="Cu"
                stroke="#7c3aed"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={false}
                isAnimationActive={false}
                name="U (Byproduct)"
              />
            )}

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
              domain={yDomainFinal}
              allowDataOverflow
              stroke="var(--text-muted)"
              fontSize={11}
              label={{
                value: 'Concentration (mol/L)',
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
    </div>
  );
}
