import { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useSimulatorStore } from '../../store/simulatorStore';
import type { DynamicPoint } from '../../hooks/useDynamicSimulation';

interface Props {
  selectedNodeId: string | null;
  cstrHistory: Record<string, { t: number; Ca: number; Cr: number; T: number }[]>;
}

export default function PhasePortrait({ selectedNodeId, cstrHistory }: Props) {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);
  const nodes = useSimulatorStore((s) => s.nodes);

  const isothermal = useMemo(() => {
    if (!selectedNodeId) return true;
    const node = nodes.find(n => n.id === selectedNodeId);
    return (node?.data as any)?.thermalMode === 'isothermal' || !(node?.data as any)?.thermalMode;
  }, [selectedNodeId, nodes]);

  const segment = useMemo(() => {
    if (!result || !selectedNodeId) return undefined;
    return result.segments.find(s => s.reactorId === selectedNodeId);
  }, [result, selectedNodeId]);

  const history = selectedNodeId ? cstrHistory[selectedNodeId] : undefined;

  const scatterData = useMemo(() => {
    if (!history) return [];
    return history.map((p, i) => ({
      x: p.Ca,
      y: isothermal ? p.Cr : p.T,
      t: p.t,
      idx: i,
    }));
  }, [history, isothermal]);

  if (!selectedNodeId) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-secondary)' }}>
        Click a CSTR node to view its phase portrait
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-secondary)' }}>
        Waiting for simulation data...
      </div>
    );
  }

  const node = nodes.find(n => n.id === selectedNodeId);
  const data = node?.data as any;
  const ic_Ca = data?.ic_Ca ?? params.Ca0;
  const ic_T = data?.ic_T ?? params.T_feed;

  const latest = history[history.length - 1];
  const xLabel = 'Cₐ (mol/L)';
  const yLabel = isothermal ? 'Cᵣ (mol/L)' : 'T (K)';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart
        margin={{ top: 40, right: 10, left: 10, bottom: 30 }}
      >
        <text x={10} y={12} fontSize={11} fontWeight={600} style={{ fill: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          PHASE PORTRAIT
        </text>
        <text x={10} y={26} fontSize={9} style={{ fill: 'var(--text-muted)' }}>
          {String((node?.data as any)?.label ?? selectedNodeId)}
        </text>

        <Tooltip
          contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, color: 'var(--text-primary)' }}
          labelFormatter={() => ''}
          formatter={(value: unknown, name: string) => {
            const v = Number(value);
            if (name === 'x') return [v.toFixed(3), xLabel];
            if (name === 'y') return [v.toFixed(isothermal ? 3 : 1), yLabel];
            return [v, name];
          }}
        />

        <Scatter
          data={scatterData}
          fill="#2563eb"
          fillOpacity={0.6}
          isAnimationActive={false}
          shape={(props: any) => {
            const { cx, cy, idx } = props;
            const total = scatterData.length;
            const progress = total > 1 ? idx / (total - 1) : 0;
            const r = progress * 180 + 75;
            const g = 99 - progress * 60;
            const b = 235;
            const opacity = 0.3 + progress * 0.7;
            return (
              <circle
                cx={cx}
                cy={cy}
                r={3}
                fill={`rgba(${Math.round(r)}, ${Math.round(g)}, ${b}, ${opacity})`}
              />
            );
          }}
        />

        {segment && (
          <ReferenceDot
            x={segment.Ca_out}
            y={isothermal ? segment.Cr_out : segment.T_out}
            r={5}
            fill="#16a34a"
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        )}

        <ReferenceDot
          x={ic_Ca}
          y={isothermal ? 0 : ic_T}
          r={5}
          fill="none"
          stroke="#6b7280"
          strokeWidth={2}
        />
        <text x={ic_Ca * 0.98} y={isothermal ? 0.05 : ic_T * 0.98} fill="#6b7280" fontSize={14} fontWeight="bold">
          ×
        </text>

        <XAxis
          dataKey="x"
          type="number"
          domain={[0, params.Ca0 * 1.1]}
          tickFormatter={(v) => Number(v).toFixed(2)}
          stroke="var(--text-secondary)"
          fontSize={11}
          label={{ value: xLabel, position: 'insideBottom', offset: -5, fill: 'var(--text-secondary)', fontSize: 11 }}
          tick={{ fill: 'var(--text-secondary)' }}
          name="x"
        />
        <YAxis
          dataKey="y"
          type="number"
          domain={isothermal ? [0, 'auto'] : ['auto', 'auto']}
          tickFormatter={(v) => Number(v).toFixed(isothermal ? 2 : 0)}
          stroke="var(--text-secondary)"
          fontSize={11}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 11 }}
          tick={{ fill: 'var(--text-secondary)' }}
          name="y"
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
