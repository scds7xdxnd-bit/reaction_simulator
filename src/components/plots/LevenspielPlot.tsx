import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ReferenceArea,
  ReferenceLine,
  Label,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useSimulatorStore } from '../../store/simulatorStore';
import { useTheme } from '../../hooks/useTheme';
import PlotAxisBar from './PlotAxisBar';

function interpolateCurve(
  curve: { Xa: number; inv_rA_norm: number }[],
  xa: number,
): number {
  if (!curve.length) return 0;
  for (let i = 0; i < curve.length - 1; i++) {
    if (curve[i].Xa <= xa && xa <= curve[i + 1].Xa) {
      const t = (xa - curve[i].Xa) / (curve[i + 1].Xa - curve[i].Xa);
      return curve[i].inv_rA_norm * (1 - t) + curve[i + 1].inv_rA_norm * t;
    }
  }
  return curve[curve.length - 1].inv_rA_norm;
}

export default function LevenspielPlot() {
  const result = useSimulatorStore((s) => s.result);
  const cfg = useSimulatorStore((s) => s.plotConfig['levenspiel']);
  const { isDark } = useTheme();
  const curveStroke = isDark ? '#e2e8f0' : '#0f1730';

  const yDomain = useMemo<[number, number]>(() => {
    if (!result?.levenspielCurve?.length) return [0, 10];
    const vals = result.levenspielCurve
      .map(p => p.inv_rA_norm)
      .filter(v => isFinite(v) && v > 0)
      .sort((a, b) => a - b);
    if (!vals.length) return [0, 10];
    const p97 = vals[Math.floor(vals.length * 0.97)];
    return [0, p97 * 1.2];
  }, [result]);

  const allAreas = useMemo(() => {
    if (!result) return { cstrs: [], pfrs: [] };

    const cstrs = result.segments
      .filter((s) => s.reactorType === 'CSTR')
      .map((s) => {
        const height = interpolateCurve(result.levenspielCurve, s.Xa_out);
        return {
          x1: s.Xa_in,
          x2: s.Xa_out,
          y1: 0,
          y2: Math.min(height, yDomain[1]),
          label: s.label,
        };
      });

    const pfrs = result.segments
      .filter((s) => s.reactorType === 'PFR')
      .map((s) => {
        const strips = 20;
        const dx = (s.Xa_out - s.Xa_in) / strips;
        const stripData = [];
        for (let i = 0; i < strips; i++) {
          const xa = s.Xa_in + dx * (i + 0.5);
          const h = interpolateCurve(result.levenspielCurve, xa);
          stripData.push({
            x1: s.Xa_in + dx * i,
            x2: s.Xa_in + dx * (i + 1),
            height: Math.min(h, yDomain[1]),
          });
        }
        return {
          strips: stripData,
          x1: s.Xa_in,
          x2: s.Xa_out,
          label: s.label,
        };
      });

    return { cstrs, pfrs };
  }, [result, yDomain]);

  const xAxisDomain = useMemo(() => {
    if (!result || result.segments.length === 0) return [0, 1];
    let maxX = 0;
    for (const seg of result.segments) {
      maxX = Math.max(maxX, seg.Xa_out);
    }
    return [0, Math.min(1, Math.max(maxX * 1.15, 0.1))];
  }, [result]);

  const xDomainFinal: [number, number] = [
    cfg.xMin ?? (xAxisDomain[0] as number),
    cfg.xMax ?? (xAxisDomain[1] as number),
  ];

  const yDomainFinal: [number, number] = cfg.yLog
    ? [Math.max(cfg.yMin ?? 0.001, 0.001), cfg.yMax ?? yDomain[1]]
    : [cfg.yMin ?? yDomain[0], cfg.yMax ?? yDomain[1]];

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-[#6b7280] text-sm">
        Connect Feed → Reactors → Product
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PlotAxisBar plotId="levenspiel" showYLog />
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={result.levenspielCurve}
            margin={{ top: 40, right: 10, left: 10, bottom: 30 }}
          >
            <text
              x={10}
              y={12}
              fill="#6b7280"
              fontSize={11}
              fontWeight={600}
              style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              LEVENSPIEL PLOT
            </text>
            <text
              x={10}
              y={28}
              fill="#9ca3af"
              fontSize={9}
            >
              Rectangle area = τ_CSTR   |   Shaded area = τ_PFR
            </text>

            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #dde3f0',
                borderRadius: 4,
                fontSize: 12,
              }}
              labelFormatter={(val) => `Xₐ = ${Number(val).toFixed(3)}`}
              formatter={(value: unknown) => [`${(Number(value) as number).toFixed(2)} s`]}
            />

            {allAreas.cstrs.map((cstr, i) => (
              <ReferenceArea
                key={`cstr-${i}`}
                x1={cstr.x1}
                x2={cstr.x2}
                y1={cstr.y1}
                y2={cstr.y2}
                fill="#2563eb40"
                stroke="#2563eb"
                strokeWidth={2.5}
              >
                <Label
                  value={cstr.label}
                  position="insideTop"
                  fill="#2563eb"
                  fontSize={10}
                  offset={-2}
                />
              </ReferenceArea>
            ))}

            {allAreas.pfrs.map((pfr, pfrIdx) => (
              <g key={`pfr-${pfrIdx}`}>
                {pfr.strips.map((strip, si) => (
                  <ReferenceArea
                    key={`pfr-${pfrIdx}-${si}`}
                    x1={strip.x1}
                    x2={strip.x2}
                    y1={0}
                    y2={strip.height}
                    fill="#d97706"
                    fillOpacity={0.22}
                    stroke="none"
                  />
                ))}
                <ReferenceLine
                  x={pfr.x1}
                  stroke="#d9770699"
                  strokeWidth={1.5}
                />
                <ReferenceLine
                  x={pfr.x2}
                  stroke="#d97706"
                  strokeWidth={1.5}
                >
                  <Label
                    value={pfr.label}
                    position="top"
                    fill="#d97706"
                    fontSize={10}
                    offset={4}
                  />
                </ReferenceLine>
              </g>
            ))}

            <Line
              dataKey="inv_rA_norm"
              stroke={curveStroke}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />

            <XAxis
              dataKey="Xa"
              type="number"
              domain={xDomainFinal}
              tickFormatter={(v) => v.toFixed(1)}
              stroke="#374151"
              fontSize={11}
              label={{ value: 'Conversion, Xₐ', position: 'insideBottom', offset: -5, fill: '#374151', fontSize: 11 }}
              tick={{ fill: '#374151' }}
            />
            <YAxis
              type="number"
              domain={yDomainFinal}
              scale={cfg.yLog ? 'log' : 'linear'}
              allowDataOverflow
              tickFormatter={(v) => Number(v).toFixed(0)}
              stroke="#374151"
              fontSize={11}
              label={{ value: 'Cₐ₀/(−rₐ) [s]  ←area = τ', angle: -90, position: 'insideLeft', fill: '#374151', fontSize: 11 }}
              tick={{ fill: '#374151' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
