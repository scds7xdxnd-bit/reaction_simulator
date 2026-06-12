import { useMemo, useState } from 'react';
import {
  ComposedChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceDot,
} from 'recharts';
import { useSimulatorStore } from '../../store/simulatorStore';
import { classifySteadyStates, steadyStateColor } from '../../math/steadyStateMapper';

export default function OperatingDiagram() {
  const result = useSimulatorStore((s) => s.result);
  const nodes = useSimulatorStore((s) => s.nodes);

  const cooledCstrs = useMemo(() => {
    if (!result) return [];
    return nodes.filter(
      (n) =>
        n.type === 'cstr' &&
        (n.data as { thermalMode?: string }).thermalMode === 'cooled' &&
        result.operatingDiagrams[n.id] != null
    );
  }, [nodes, result]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeId =
    selectedId && cooledCstrs.find((n) => n.id === selectedId)
      ? selectedId
      : cooledCstrs[0]?.id ?? null;

  const diagramData = useMemo(() => {
    if (!activeId || !result) return null;
    const diagram = result.operatingDiagrams[activeId];
    if (!diagram) return null;
    const multiplicity = classifySteadyStates(diagram.steadyStates);
    return { diagram, multiplicity };
  }, [activeId, result]);

  if (!diagramData) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-secondary)' }}>
        Select a cooled CSTR in single-reaction mode
      </div>
    );
  }

  const { diagram, multiplicity } = diagramData;

  return (
    <div className="w-full h-full flex flex-col">
      {cooledCstrs.length > 1 && (
        <div className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>CSTR:</span>
          <select
            value={activeId ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className="text-[10px] rounded px-1 py-0.5 outline-none"
            style={{ background: 'var(--bg-inset)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            {cooledCstrs.map((n) => (
              <option key={n.id} value={n.id}>
                {(n.data as { label: string }).label}
              </option>
            ))}
          </select>
        </div>
      )}
      {multiplicity.hasMultiplicity && (
        <div className="px-3 py-1.5" style={{ background: 'var(--warn-soft)', borderBottom: '1px solid var(--border-mid)' }}>
          <div className="text-[10px] font-bold mb-1" style={{ color: 'var(--warn)' }}>
            ⚡ Multiple Steady States — ignition / unstable / extinction
          </div>
          <div className="flex gap-2">
            {multiplicity.states.map((ss) => (
              <div
                key={ss.label}
                className="flex-1 rounded px-2 py-1 text-[9.5px]"
                style={{ background: steadyStateColor(ss.label) + '18', border: `1px solid ${steadyStateColor(ss.label)}44` }}
              >
                <div className="font-bold capitalize" style={{ color: steadyStateColor(ss.label) }}>{ss.label}</div>
                <div style={{ color: 'var(--text-primary)' }}>T = {ss.T.toFixed(1)} K</div>
                <div style={{ color: 'var(--text-primary)' }}>Xₐ = {ss.Xa.toFixed(3)}</div>
                <div style={{ color: ss.stable ? 'var(--success)' : 'var(--danger)' }}>{ss.stable ? '● stable' : '○ unstable'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0" style={{ background: 'var(--plot-bg)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={diagram.curve}
            margin={{ top: 8, right: 16, left: -10, bottom: 12 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis
              dataKey="T"
              type="number"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              label={{
                value: 'T (K)',
                position: 'bottom',
                offset: 0,
                fontSize: 10,
                fill: 'var(--text-muted)',
              }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              label={{
                value: 'G, R (kJ/L)',
                angle: -90,
                position: 'left',
                offset: 0,
                fontSize: 10,
                fill: 'var(--text-muted)',
              }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 4,
                fontSize: 11,
                color: 'var(--text-primary)',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'G') return [value.toFixed(4), 'Heat Generated G(T)'];
                return [value.toFixed(4), 'Heat Removed R(T)'];
              }}
              labelFormatter={(t: number) => `T = ${t.toFixed(1)} K`}
            />
            <Line
              type="monotone"
              dataKey="G"
              stroke="#dc2626"
              strokeWidth={2}
              dot={false}
              name="G"
            />
            <Line
              type="monotone"
              dataKey="R"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
              name="R"
            />
            {multiplicity.states.map((ss, i) => {
              const nearest = diagram.curve.reduce((prev, curr) =>
                Math.abs(curr.T - ss.T) < Math.abs(prev.T - ss.T) ? curr : prev
              );
              const color = steadyStateColor(ss.label);
              return (
                <ReferenceDot
                  key={i}
                  x={ss.T}
                  y={nearest.G}
                  r={6}
                  fill={ss.stable ? color : 'transparent'}
                  stroke={color}
                  strokeWidth={2}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
