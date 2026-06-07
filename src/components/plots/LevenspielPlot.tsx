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
import { getRate } from '../../math/kinetics';

export default function LevenspielPlot() {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);

  const allAreas = useMemo(() => {
    if (!result) return { cstrs: [], pfrs: [] };

    const cstrs = result.segments
      .filter((s) => s.reactorType === 'CSTR')
      .map((s) => {
        const effectiveParams = params.reactionMode === 'parallel'
          ? { ...params, kinetics: 'first-order' as const, k: params.k + params.k2 }
          : params.reactionMode !== 'single'
            ? { ...params, kinetics: 'first-order' as const }
            : params;
        const rate_at_exit = getRate(s.Xa_out, effectiveParams);
        const height = params.Ca0 / Math.max(rate_at_exit, 1e-12);
        return {
          x1: s.Xa_in,
          x2: s.Xa_out,
          y1: 0,
          y2: height,
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
          const effectiveParams = params.reactionMode === 'parallel'
            ? { ...params, kinetics: 'first-order' as const, k: params.k + params.k2 }
            : params.reactionMode !== 'single'
              ? { ...params, kinetics: 'first-order' as const }
              : params;
          const rate = getRate(xa, effectiveParams);
          const h = params.Ca0 / Math.max(rate, 1e-12);
          stripData.push({
            x1: s.Xa_in + dx * i,
            x2: s.Xa_in + dx * (i + 1),
            height: h,
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
  }, [result, params]);

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-[#6b7280] text-sm">
        Connect Feed → Reactors → Product
      </div>
    );
  }

  return (
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
            fill="#eff6ff"
            stroke="#2563eb"
            strokeWidth={1.5}
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
                fill="#fffbeb"
                stroke="none"
              />
            ))}
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
          stroke="#0f1730"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />

        <XAxis
          dataKey="Xa"
          type="number"
          domain={[0, 1]}
          tickFormatter={(v) => v.toFixed(1)}
          stroke="#374151"
          fontSize={11}
          label={{ value: 'Conversion, Xₐ', position: 'insideBottom', offset: -5, fill: '#374151', fontSize: 11 }}
          tick={{ fill: '#374151' }}
        />
        <YAxis
          type="number"
          stroke="#374151"
          fontSize={11}
          label={{ value: 'Cₐ₀/(−rₐ) [s]  ←area = τ', angle: -90, position: 'insideLeft', fill: '#374151', fontSize: 11 }}
          tick={{ fill: '#374151' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
