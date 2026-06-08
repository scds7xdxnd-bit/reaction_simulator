import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceDot,
} from 'recharts';
import { useSimulatorStore } from '../../store/simulatorStore';
import { buildOperatingDiagram } from '../../math/thermalSolvers';
import { conversion } from '../../types/stream';
import { makeFeedStream } from '../../math/streamBridge';

export default function OperatingDiagram() {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);
  const nodes = useSimulatorStore((s) => s.nodes);
  const edges = useSimulatorStore((s) => s.edges);

  const cooledCstrs = useMemo(() => {
    if (!result || params.reactionMode !== 'single') return [];
    return nodes.filter(
      (n) =>
        n.type === 'cstr' &&
        (n.data as { thermalMode?: string }).thermalMode === 'cooled'
    );
  }, [nodes, result, params.reactionMode]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeId =
    selectedId && cooledCstrs.find((n) => n.id === selectedId)
      ? selectedId
      : cooledCstrs[0]?.id ?? null;

  const diagramData = useMemo(() => {
    if (!activeId || !result) return null;

    const cstrNode = nodes.find((n) => n.id === activeId);
    if (!cstrNode) return null;

    const nodeData = cstrNode.data as {
      thermalMode?: string;
      Tc?: number;
      kappa_v?: number;
      tau: number;
    };

    const inEdges = edges.filter((e) => e.target === cstrNode.id);
    const inletStream =
      inEdges.length > 0 ? result.streams[inEdges[0].id] : undefined;
    const feedStream = makeFeedStream(params.Ca0, params.T_feed);
    const Xa_in = inletStream ? conversion(inletStream, feedStream, 'A') : 0;
    const T_in = inletStream?.T ?? (params.T_feed ?? 300);

    const diagram = buildOperatingDiagram(
      Xa_in,
      T_in,
      nodeData.tau,
      nodeData.Tc ?? 300,
      nodeData.kappa_v ?? 0.5,
      params
    );

    return { diagram, Xa_in, T_in, hasMultiplicity: diagram.steadyStates.length >= 3 };
  }, [activeId, result, params, nodes, edges]);

  if (!diagramData) {
    return (
      <div className="flex items-center justify-center h-full text-[#6b7280] text-sm">
        Select a cooled CSTR in single-reaction mode
      </div>
    );
  }

  const { diagram, hasMultiplicity } = diagramData;

  return (
    <div className="w-full h-full flex flex-col">
      {cooledCstrs.length > 1 && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#dde3f0] bg-[#ffffff]">
          <span className="text-[10px] text-[#6b7280]">CSTR:</span>
          <select
            value={activeId ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className="text-[10px] bg-[#f8faff] border border-[#dde3f0] rounded px-1 py-0.5 text-[#0f1730] outline-none"
          >
            {cooledCstrs.map((n) => (
              <option key={n.id} value={n.id}>
                {(n.data as { label: string }).label}
              </option>
            ))}
          </select>
        </div>
      )}
      {hasMultiplicity && (
        <div className="text-[10px] font-medium text-[#d97706] px-3 py-1 bg-[#fffbeb] border-b border-[#fde68a]">
          Multiple steady states detected ({diagram.steadyStates.length})
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={diagram.curve}
            margin={{ top: 8, right: 16, left: -10, bottom: 12 }}
          >
            <XAxis
              dataKey="T"
              type="number"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#dde3f0' }}
              label={{
                value: 'T (K)',
                position: 'bottom',
                offset: 0,
                fontSize: 10,
                fill: '#6b7280',
              }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#dde3f0' }}
              label={{
                value: 'G, R (kJ/L)',
                angle: -90,
                position: 'left',
                offset: 0,
                fontSize: 10,
                fill: '#6b7280',
              }}
            />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #dde3f0',
                borderRadius: 4,
                fontSize: 11,
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
            {diagram.steadyStates.map((ss, i) => {
              const nearest = diagram.curve.reduce((prev, curr) =>
                Math.abs(curr.T - ss.T) < Math.abs(prev.T - ss.T) ? curr : prev
              );
              return (
                <ReferenceDot
                  key={i}
                  x={ss.T}
                  y={nearest.G}
                  r={6}
                  fill={ss.stable ? '#16a34a' : 'transparent'}
                  stroke={ss.stable ? '#16a34a' : '#dc2626'}
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
