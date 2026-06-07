import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useSimulatorStore } from '../../store/simulatorStore';
import type { DynamicPoint } from '../../hooks/useDynamicSimulation';

interface Props {
  history: DynamicPoint[];
  tCurrent: number;
  disturbanceLog: { t: number; desc: string }[];
}

export default function DynamicResponse({ history, tCurrent, disturbanceLog }: Props) {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);
  const isSingle = params.reactionMode === 'single';

  const nodes = useSimulatorStore((s) => s.nodes);
  const hasNonIsothermal = useMemo(() => {
    return nodes.some(n => (n.type === 'cstr' || n.type === 'pfr') && (n.data as any)?.thermalMode !== 'isothermal');
  }, [nodes]);

  const steadyReached = useMemo(() => {
    if (!result || history.length < 20) return false;
    const ss = result.finalConversion;
    const last20 = history.slice(-20);
    return last20.every(p => Math.abs(p.Xa - ss) < 0.02 * Math.max(ss, 0.01));
  }, [history, result]);

  const xDomain = useMemo<[number, number]>(() => {
    return [0, Math.max(tCurrent * 1.1, 5)];
  }, [tCurrent]);

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[#6b7280] text-sm">
        Press Play to start dynamic simulation
      </div>
    );
  }

  const ssXa = result?.finalConversion;
  const ssCr = result?.segments?.[result.segments.length - 1]?.Cr_out;
  const ssCs = result?.segments?.[result.segments.length - 1]?.Cs_out;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={history}
        margin={{ top: 40, right: 20, left: 10, bottom: 30 }}
      >
        <text x={10} y={12} fill="#6b7280" fontSize={11} fontWeight={600} style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          DYNAMIC RESPONSE
        </text>

        {steadyReached && (
          <text x="97%" y={14} fill="#16a34a" fontSize={10} fontWeight={600} textAnchor="end">
            ✓ Steady state reached at t ≈ {history[history.length - 1].t.toFixed(1)} s
          </text>
        )}

        <Tooltip
          contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #dde3f0', borderRadius: 4, fontSize: 12 }}
          labelFormatter={(val) => `t = ${Number(val).toFixed(2)} s`}
        />

        {disturbanceLog.map((d, i) => (
          <ReferenceLine
            key={`dist-${i}`}
            x={d.t}
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            label={{ value: d.desc, position: 'top', fill: '#dc2626', fontSize: 9 }}
          />
        ))}

        {ssXa !== undefined && (
          <ReferenceLine
            y={ssXa}
            stroke="#2563eb66"
            strokeWidth={1}
            strokeDasharray="4 3"
            label={{ value: 'SS Xₐ', position: 'right', fill: '#2563eb', fontSize: 9 }}
          />
        )}

        <Line
          yAxisId="left"
          dataKey="Xa"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          name="Xₐ"
        />

        {!isSingle && (
          <>
            <Line
              yAxisId="left"
              dataKey="Cr"
              stroke="#059669"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              name="Cᵣ"
            />
            <Line
              yAxisId="left"
              dataKey="Cs"
              stroke="#d97706"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              name="Cₛ"
            />
          </>
        )}

        {hasNonIsothermal && (
          <Line
            yAxisId="right"
            dataKey="T"
            stroke="#dc2626"
            strokeWidth={1.5}
            strokeDasharray="6 2"
            dot={false}
            isAnimationActive={false}
            name="T"
          />
        )}

        <XAxis
          dataKey="t"
          type="number"
          domain={xDomain}
          tickFormatter={(v) => Number(v).toFixed(1)}
          stroke="#374151"
          fontSize={11}
          label={{ value: 'Time (s)', position: 'insideBottom', offset: -5, fill: '#374151', fontSize: 11 }}
          tick={{ fill: '#374151' }}
        />
        <YAxis
          yAxisId="left"
          type="number"
          domain={[0, 'auto']}
          tickFormatter={(v) => Number(v).toFixed(1)}
          stroke="#374151"
          fontSize={11}
          label={{ value: 'Xₐ / C (mol/L)', angle: -90, position: 'insideLeft', fill: '#374151', fontSize: 11 }}
          tick={{ fill: '#374151' }}
        />
        {hasNonIsothermal && (
          <YAxis
            yAxisId="right"
            orientation="right"
            type="number"
            domain={['auto', 'auto']}
            tickFormatter={(v) => `${Number(v).toFixed(0)}`}
            stroke="#dc2626"
            fontSize={11}
            label={{ value: 'T (K)', angle: 90, position: 'insideRight', fill: '#dc2626', fontSize: 11 }}
            tick={{ fill: '#dc2626' }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
