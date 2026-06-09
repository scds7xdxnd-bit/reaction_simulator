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
import { runSweep } from '../../math/sweepEngine';
import type { SweepVariable } from '../../math/sweepEngine';

const VARIABLE_LABELS: Record<SweepVariable, string> = {
  k: 'k (s⁻¹)',
  Ca0: 'Ca₀ (mol/L)',
  T_feed: 'T_feed (K)',
  tau: 'τ (s)',
};

const VARIABLE_UNITS: Record<SweepVariable, string> = {
  k: 's⁻¹',
  Ca0: 'mol/L',
  T_feed: 'K',
  tau: 's',
};

const DEFAULT_RANGES: Record<SweepVariable, { from: number; to: number }> = {
  k: { from: 0.1, to: 5.0 },
  Ca0: { from: 0.5, to: 5.0 },
  T_feed: { from: 280, to: 420 },
  tau: { from: 0.5, to: 20.0 },
};

export default function SweepPanel() {
  const nodes = useSimulatorStore((s) => s.nodes);
  const edges = useSimulatorStore((s) => s.edges);
  const params = useSimulatorStore((s) => s.params);
  const result = useSimulatorStore((s) => s.result);
  const sweepConfig = useSimulatorStore((s) => s.sweepConfig);
  const sweepResults = useSimulatorStore((s) => s.sweepResults);
  const setSweepConfig = useSimulatorStore((s) => s.setSweepConfig);
  const setSweepResults = useSimulatorStore((s) => s.setSweepResults);

  const isSingle = params.reactionMode === 'single';
  const xAxisLabel = VARIABLE_LABELS[sweepConfig.variable];

  const reactorNodes = useMemo(
    () => nodes.filter((n) => n.type === 'cstr' || n.type === 'pfr'),
    [nodes]
  );
  const showReactorPicker = sweepConfig.variable === 'tau';

  const currentParamValue = useMemo((): number => {
    switch (sweepConfig.variable) {
      case 'k':
        return params.k;
      case 'Ca0':
        return params.Ca0;
      case 'T_feed':
        return params.T_feed;
      case 'tau': {
        const n = reactorNodes.find((n) => n.id === sweepConfig.targetNodeId) ?? reactorNodes[0];
        return (n?.data.tau as number) ?? 1;
      }
    }
  }, [sweepConfig.variable, sweepConfig.targetNodeId, params, reactorNodes]);

  const canRun = result !== null;

  const handleVariableChange = (newVar: SweepVariable) => {
    const defaults = DEFAULT_RANGES[newVar];
    setSweepConfig({
      variable: newVar,
      from: defaults.from,
      to: defaults.to,
      targetNodeId: null,
    });
    setSweepResults(null);
  };

  const handleRun = () => {
    const effectiveConfig = {
      ...sweepConfig,
      targetNodeId:
        sweepConfig.variable === 'tau'
          ? (sweepConfig.targetNodeId ?? reactorNodes[0]?.id ?? null)
          : null,
    };
    const results = runSweep(nodes, edges, params, effectiveConfig);
    setSweepResults(results);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 p-3 space-y-2" style={{ background: '#f8faff' }}>
        <div
          className="text-[11px] font-semibold tracking-wider"
          style={{ color: '#6b7280', textTransform: 'uppercase' }}
        >
          PARAMETER SWEEP
        </div>

        <select
          value={sweepConfig.variable}
          onChange={(e) => handleVariableChange(e.target.value as SweepVariable)}
          className="w-full rounded text-[12px] px-2 py-1.5"
          style={{ border: '1px solid #dde3f0', background: '#fff', color: '#374151' }}
        >
          <option value="k">Rate Constant (k)</option>
          <option value="Ca0">Initial Concentration (Ca₀)</option>
          <option value="T_feed">Feed Temperature (T_feed)</option>
          <option value="tau">Residence Time (τ)</option>
        </select>

        {showReactorPicker && (
          <div>
            <div className="text-[10px] text-[#6b7280] mb-1">Reactor:</div>
            <select
              value={sweepConfig.targetNodeId ?? ''}
              onChange={(e) =>
                setSweepConfig({ targetNodeId: e.target.value || null })
              }
              disabled={reactorNodes.length === 0}
              className="w-full rounded text-[12px] px-2 py-1.5"
              style={{
                border: '1px solid #dde3f0',
                background: '#fff',
                color: '#374151',
              }}
            >
              {reactorNodes.length === 0 ? (
                <option value="">No reactors</option>
              ) : (
                reactorNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {(n.data as { label?: string }).label ?? n.id}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-[10px] text-[#6b7280]">From</div>
            <input
              type="number"
              value={sweepConfig.from}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) setSweepConfig({ from: v });
              }}
              className="w-full rounded text-[12px] px-2 py-1"
              style={{ border: '1px solid #dde3f0', background: '#fff', color: '#374151' }}
            />
            <div className="text-[9px] text-[#9ca3af]">
              {VARIABLE_UNITS[sweepConfig.variable]}
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-[#6b7280]">To</div>
            <input
              type="number"
              value={sweepConfig.to}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) setSweepConfig({ to: v });
              }}
              className="w-full rounded text-[12px] px-2 py-1"
              style={{ border: '1px solid #dde3f0', background: '#fff', color: '#374151' }}
            />
            <div className="text-[9px] text-[#9ca3af]">
              {VARIABLE_UNITS[sweepConfig.variable]}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#6b7280] shrink-0">
              Steps: {sweepConfig.steps}
            </span>
            <input
              type="range"
              min={10}
              max={100}
              value={sweepConfig.steps}
              onChange={(e) => setSweepConfig({ steps: parseInt(e.target.value) })}
              className="flex-1"
              style={{ accentColor: '#2563eb' }}
            />
          </div>
        </div>

        <div>
          {!canRun && (
            <div className="text-[12px] text-[#d97706] mb-1.5">
              ⚠ Connect the flowsheet first
            </div>
          )}
          <button
            onClick={handleRun}
            disabled={!canRun}
            className="w-full rounded text-[12px] font-medium py-1.5 transition-opacity"
            style={{
              background: canRun ? '#2563eb' : '#9ca3af',
              color: '#ffffff',
              opacity: canRun ? 1 : 0.6,
              cursor: canRun ? 'pointer' : 'default',
            }}
          >
            Run Sweep
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {sweepResults === null ? (
          <div className="flex items-center justify-center h-full text-[#6b7280] text-sm text-center px-4">
            Configure and click Run to start a sweep
          </div>
        ) : sweepResults.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#6b7280] text-sm text-center px-4">
            No results — check flowsheet connectivity
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={sweepResults}
              margin={{ top: 8, right: 44, left: -10, bottom: 30 }}
            >
              <XAxis
                dataKey="paramValue"
                type="number"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#dde3f0' }}
                label={{
                  value: xAxisLabel,
                  position: 'insideBottom',
                  offset: -5,
                  fontSize: 10,
                  fill: '#6b7280',
                }}
              />
              <YAxis
                yAxisId="left"
                domain={[0, 1]}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#dde3f0' }}
                label={{
                  value: 'Xₐ',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 12,
                  fontSize: 10,
                  fill: '#6b7280',
                }}
              />
              {!isSingle && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 1]}
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#dde3f0' }}
                  label={{
                    value: 'Y_R',
                    angle: 90,
                    position: 'insideRight',
                    offset: 12,
                    fontSize: 10,
                    fill: '#16a34a',
                  }}
                />
              )}
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #dde3f0',
                  borderRadius: 4,
                  fontSize: 11,
                }}
                labelFormatter={(v: number) => `${xAxisLabel}: ${v.toFixed(3)}`}
                formatter={(value: number, name: string) => [
                  `${(value * 100).toFixed(1)}%`,
                  name === 'Xa' ? 'Conversion Xₐ' : 'Yield Y_R',
                ]}
              />
              <ReferenceLine
                x={currentParamValue}
                yAxisId="left"
                stroke="#374151"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
              <Line
                yAxisId="left"
                dataKey="Xa"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                name="Xa"
              />
              {!isSingle && (
                <Line
                  yAxisId="right"
                  dataKey="yieldR"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  name="yieldR"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
