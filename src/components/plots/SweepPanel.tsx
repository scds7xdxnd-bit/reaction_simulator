import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useSimulatorStore } from '../../store/simulatorStore';
import { runSweep } from '../../math/sweepEngine';
import type { SweepVariable } from '../../math/sweepEngine';
import { solveTarget } from '../../math/targetSolver';
import type { TargetConfig, TargetResult } from '../../math/targetSolver';
import { runComparison } from '../../math/comparisonEngine';
import type { CompareConfig } from '../../math/comparisonEngine';
import type { AnalysisMode } from '../../store/slices/sweepSlice';

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

const VARIABLE_DISPLAY: Record<SweepVariable, { label: string; unit: string }> = {
  k:      { label: 'k',      unit: 's⁻¹'  },
  Ca0:    { label: 'Cₐ₀',   unit: 'mol/L' },
  T_feed: { label: 'T_feed', unit: 'K'    },
  tau:    { label: 'τ',      unit: 's'    },
};

interface TargetResultCardProps {
  result: TargetResult | null;
  targetXa: number;
  variable: SweepVariable;
  reactorLabel: string | null;
  lo: number;
  hi: number;
}

function TargetResultCard({ result, targetXa, variable, reactorLabel, lo, hi }: TargetResultCardProps) {
  if (result === null) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-center px-4" style={{ color: 'var(--text-secondary)' }}>
        Set a target Xₐ and click Solve
      </div>
    );
  }

  const { solvedValue, achievedXa, bracketValid } = result;
  const { label: varLabel, unit } = VARIABLE_DISPLAY[variable];
  const err = Math.abs(achievedXa - targetXa);
  const errPct = err * 100;

  const fmt = (v: number) =>
    v < 10 ? v.toFixed(3) : v < 100 ? v.toFixed(2) : v.toFixed(1);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 gap-4">
      {!bracketValid && (
        <div
          style={{
            width: '100%', background: 'var(--warn-soft)',
            border: '1px solid var(--border-mid)', borderRadius: 6,
            padding: '8px 12px', fontSize: 11, color: 'var(--warn)', lineHeight: 1.5,
          }}
        >
          Xₐ does not cross the target in [{fmt(lo)}, {fmt(hi)}] {unit}. The best estimate is shown — try widening the search bounds.
        </div>
      )}

      <div
        style={{
          width: '100%', background: 'var(--bg-surface)',
          border: bracketValid ? '1.5px solid var(--accent)' : '1.5px solid var(--warn)',
          borderRadius: 'var(--radius-md)', padding: '20px 24px',
          boxShadow: 'var(--shadow-popover)',
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Required {varLabel}
          {reactorLabel && (
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({reactorLabel})</span>
          )}
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace', lineHeight: 1.1 }}>
          {fmt(solvedValue)}
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 6 }}>
            {unit}
          </span>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Target Xₐ</span>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: 600 }}>
            {(targetXa * 100).toFixed(1)}%
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Achieved Xₐ</span>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: 600 }}>
            {(achievedXa * 100).toFixed(3)}%
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Error</span>
          <span style={{ fontSize: 11, fontFamily: 'monospace',
            color: errPct < 0.01 ? 'var(--success)' : errPct < 0.1 ? 'var(--warn)' : 'var(--danger)',
            fontWeight: 600 }}>
            {errPct < 0.001 ? '< 0.001%' : `${errPct.toFixed(3)}%`}
          </span>
        </div>

        <div style={{ marginTop: 14, fontSize: 11, color: bracketValid ? 'var(--success)' : 'var(--warn)', fontWeight: 600 }}>
          {bracketValid ? '✓ Converged' : '⚠ Best estimate (no bracket)'}
        </div>
      </div>
    </div>
  );
}

export default function SweepPanel() {
  const nodes = useSimulatorStore((s) => s.nodes);
  const edges = useSimulatorStore((s) => s.edges);
  const params = useSimulatorStore((s) => s.params);
  const result = useSimulatorStore((s) => s.result);
  const sweepConfig = useSimulatorStore((s) => s.sweepConfig);
  const sweepResults = useSimulatorStore((s) => s.sweepResults);
  const setSweepConfig = useSimulatorStore((s) => s.setSweepConfig);
  const setSweepResults = useSimulatorStore((s) => s.setSweepResults);
  const analysisMode   = useSimulatorStore((s) => s.analysisMode);
  const targetXa       = useSimulatorStore((s) => s.targetXa);
  const targetResult   = useSimulatorStore((s) => s.targetResult);
  const setAnalysisMode = useSimulatorStore((s) => s.setAnalysisMode);
  const setTargetXa    = useSimulatorStore((s) => s.setTargetXa);
  const setTargetResult = useSimulatorStore((s) => s.setTargetResult);
  const compareCfg     = useSimulatorStore((s) => s.compareCfg);
  const compareResults = useSimulatorStore((s) => s.compareResults);
  const setCompareCfg  = useSimulatorStore((s) => s.setCompareCfg);
  const setCompareResults = useSimulatorStore((s) => s.setCompareResults);

  const isSingle = params.reactionMode === 'single';
  const xAxisLabel = VARIABLE_LABELS[sweepConfig.variable];

  const reactorNodes = useMemo(
    () => nodes.filter((n) => n.type === 'cstr' || n.type === 'pfr' || n.type === 'batch'),
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
    setTargetResult(null);
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

  const canSolve =
    result !== null &&
    sweepConfig.from < sweepConfig.to &&
    targetXa > 0 && targetXa < 1;

  const handleSolve = () => {
    const effectiveTargetNodeId =
      sweepConfig.variable === 'tau'
        ? (sweepConfig.targetNodeId ?? reactorNodes[0]?.id ?? null)
        : null;

    const config: TargetConfig = {
      variable:     sweepConfig.variable,
      targetNodeId: effectiveTargetNodeId,
      targetXa,
      lo: sweepConfig.from,
      hi: sweepConfig.to,
    };
    const res = solveTarget(nodes, edges, params, config);
    setTargetResult(res);
  };

  const handleCompare = () => {
    const results = runComparison(params, compareCfg);
    setCompareResults(results);
  };

  const headerLabel =
    analysisMode === 'sweep' ? 'PARAMETER SWEEP' :
    analysisMode === 'target' ? 'TARGET SOLVER' :
    'REACTOR COMPARISON';

  return (
    <div className="flex flex-col h-full">
      {/* Mode toggle */}
      <div style={{ display: 'flex', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {(['sweep', 'target', 'compare'] as AnalysisMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setAnalysisMode(mode)}
            style={{
              flex: 1, padding: '6px 0',
              fontSize: 11, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: 'none',
              color: analysisMode === mode ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: analysisMode === mode
                ? '2px solid var(--accent)'
                : '2px solid transparent',
              textTransform: 'capitalize',
            }}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Config section */}
      <div className="shrink-0 p-3 space-y-2" style={{ background: 'var(--bg-inset)', borderBottom: '1px solid var(--border)' }}>
        <div
          className="text-[11px] font-semibold tracking-wider"
          style={{ color: 'var(--text-secondary)', textTransform: 'uppercase' }}
        >
          {headerLabel}
        </div>

        {/* Variable picker — only for sweep/target modes */}
        {analysisMode !== 'compare' && (
          <select
            value={sweepConfig.variable}
            onChange={(e) => handleVariableChange(e.target.value as SweepVariable)}
            className="w-full rounded text-[12px] px-2 py-1.5"
            style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          >
            <option value="k">Rate Constant (k)</option>
            <option value="Ca0">Initial Concentration (Ca₀)</option>
            <option value="T_feed">Feed Temperature (T_feed)</option>
            <option value="tau">Residence Time (τ)</option>
          </select>
        )}

        {analysisMode !== 'compare' && showReactorPicker && (
          <div>
            <div className="text-[10px] mb-1" style={{ color: 'var(--text-secondary)' }}>Reactor:</div>
            <select
              value={sweepConfig.targetNodeId ?? ''}
              onChange={(e) =>
                setSweepConfig({ targetNodeId: e.target.value || null })
              }
              disabled={reactorNodes.length === 0}
              className="w-full rounded text-[12px] px-2 py-1.5"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--bg-inset)',
                color: 'var(--text-primary)',
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

        {/* ── SWEEP MODE config ── */}
        {analysisMode === 'sweep' && (
          <>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>From</div>
                <input
                  type="number"
                  value={sweepConfig.from}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) setSweepConfig({ from: v });
                  }}
                  className="w-full rounded text-[12px] px-2 py-1"
                  style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                />
                <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  {VARIABLE_UNITS[sweepConfig.variable]}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>To</div>
                <input
                  type="number"
                  value={sweepConfig.to}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) setSweepConfig({ to: v });
                  }}
                  className="w-full rounded text-[12px] px-2 py-1"
                  style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                />
                <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  {VARIABLE_UNITS[sweepConfig.variable]}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] shrink-0" style={{ color: 'var(--text-secondary)' }}>
                  Steps: {sweepConfig.steps}
                </span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={sweepConfig.steps}
                  onChange={(e) => setSweepConfig({ steps: parseInt(e.target.value) })}
                  className="flex-1"
                  style={{ accentColor: 'var(--accent)' }}
                />
              </div>
            </div>

            <div>
              {!canRun && (
                <div className="text-[12px] mb-1.5" style={{ color: 'var(--warn)' }}>
                  ⚠ Connect the flowsheet first
                </div>
              )}
              <button
                onClick={handleRun}
                disabled={!canRun}
                className="w-full rounded text-[12px] font-medium py-1.5 transition-opacity"
                style={{
                  background: canRun ? 'var(--accent)' : 'var(--text-disabled)',
                  color: '#ffffff',
                  opacity: canRun ? 1 : 0.6,
                  cursor: canRun ? 'pointer' : 'default',
                }}
              >
                Run Sweep
              </button>
            </div>
          </>
        )}

        {/* ── TARGET MODE config ── */}
        {analysisMode === 'target' && (
          <>
            <div>
              <div className="text-[10px] mb-1" style={{ color: 'var(--text-secondary)' }}>Target Conversion (Xₐ)</div>
              <input
                type="number" min="0.01" max="0.999" step="0.01"
                value={targetXa}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > 0 && v < 1) setTargetXa(v);
                }}
                className="w-full rounded text-[12px] px-2 py-1"
                style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)',
                         fontFamily: 'monospace' }}
              />
              <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                0 &lt; Xₐ &lt; 1 &nbsp;·&nbsp; e.g. 0.90 for 90%
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Search from</div>
                <input
                  type="number"
                  value={sweepConfig.from}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) setSweepConfig({ from: v });
                  }}
                  className="w-full rounded text-[12px] px-2 py-1"
                  style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                />
                <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  {VARIABLE_UNITS[sweepConfig.variable]}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Search to</div>
                <input
                  type="number"
                  value={sweepConfig.to}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) setSweepConfig({ to: v });
                  }}
                  className="w-full rounded text-[12px] px-2 py-1"
                  style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                />
                <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  {VARIABLE_UNITS[sweepConfig.variable]}
                </div>
              </div>
            </div>

            <div>
              {!canSolve && result !== null && (
                <div className="text-[12px] mb-1.5" style={{ color: 'var(--warn)' }}>
                  ⚠ Target Xₐ must be between 0 and 1
                </div>
              )}
              {!canSolve && result === null && (
                <div className="text-[12px] mb-1.5" style={{ color: 'var(--warn)' }}>
                  ⚠ Connect the flowsheet first
                </div>
              )}
              <button
                onClick={handleSolve}
                disabled={!canSolve}
                className="w-full rounded text-[12px] font-medium py-1.5 transition-opacity"
                style={{
                  background: canSolve ? 'var(--accent)' : 'var(--text-disabled)',
                  color: '#ffffff',
                  opacity: canSolve ? 1 : 0.6,
                  cursor: canSolve ? 'pointer' : 'default',
                }}
              >
                Solve
              </button>
            </div>
          </>
        )}

        {/* ── COMPARE MODE config ── */}
        {analysisMode === 'compare' && (
          <>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>τ max</div>
                <input
                  type="number"
                  min="0.5"
                  max="100"
                  step="0.5"
                  value={compareCfg.tau_to}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > 0) setCompareCfg({ tau_to: v });
                  }}
                  className="w-full rounded text-[12px] px-2 py-1"
                  style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                />
                <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>s</div>
              </div>
              <div className="flex-1">
                <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>N CSTRs</div>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  value={compareCfg.N}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v) && v >= 1 && v <= 10) setCompareCfg({ N: v });
                  }}
                  className="w-full rounded text-[12px] px-2 py-1"
                  style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                />
                <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>in series</div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] shrink-0" style={{ color: 'var(--text-secondary)' }}>
                  Steps: {compareCfg.steps}
                </span>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={compareCfg.steps}
                  onChange={(e) => setCompareCfg({ steps: parseInt(e.target.value) })}
                  className="flex-1"
                  style={{ accentColor: 'var(--accent)' }}
                />
              </div>
            </div>

            <button
              onClick={handleCompare}
              className="w-full rounded text-[12px] font-medium py-1.5"
              style={{ background: 'var(--accent)', color: '#ffffff', cursor: 'pointer' }}
            >
              Run Comparison
            </button>
          </>
        )}
      </div>

      {/* Display section */}
      <div className="flex-1 min-h-0">
        {analysisMode === 'compare' ? (
          compareResults === null || compareResults.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-center px-4" style={{ color: 'var(--text-secondary)' }}>
              Configure and click Run Comparison
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={compareResults}
                margin={{ top: 8, right: 16, left: -10, bottom: 30 }}
              >
                <XAxis
                  dataKey="tau"
                  type="number"
                  tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                  label={{
                    value: 'τ (s)',
                    position: 'insideBottom',
                    offset: -5,
                    fontSize: 10,
                    fill: 'var(--text-secondary)',
                  }}
                />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                  label={{
                    value: 'Xₐ',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 12,
                    fontSize: 10,
                    fill: 'var(--text-secondary)',
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    fontSize: 11,
                  }}
                  labelFormatter={(v: number) => `τ = ${v.toFixed(2)} s`}
                  formatter={(value: number, name: string) => [
                    `${(value * 100).toFixed(1)}%`,
                    name === 'cstr' ? 'Single CSTR'
                      : name === 'pfr' ? 'Single PFR'
                      : `${compareCfg.N} CSTRs`,
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                  formatter={(name) =>
                    name === 'cstr' ? 'Single CSTR'
                      : name === 'pfr' ? 'Single PFR'
                      : `${compareCfg.N} CSTRs in series`
                  }
                />
                <Line
                  dataKey="cstr"
                  stroke="#2563eb"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="pfr"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="nCstr"
                  stroke="#d97706"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )
        ) : analysisMode === 'sweep' ? (
          sweepResults === null ? (
            <div className="flex items-center justify-center h-full text-sm text-center px-4" style={{ color: 'var(--text-secondary)' }}>
              Configure and click Run to start a sweep
            </div>
          ) : sweepResults.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-center px-4" style={{ color: 'var(--text-secondary)' }}>
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
                  tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                  label={{
                    value: xAxisLabel,
                    position: 'insideBottom',
                    offset: -5,
                    fontSize: 10,
                    fill: 'var(--text-secondary)',
                  }}
                />
                <YAxis
                  yAxisId="left"
                  domain={[0, 1]}
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                  label={{
                    value: 'Xₐ',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 12,
                    fontSize: 10,
                    fill: 'var(--text-secondary)',
                  }}
                />
                {!isSingle && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 1]}
                    tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                    tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border)' }}
                    label={{
                      value: 'Y_R',
                      angle: 90,
                      position: 'insideRight',
                      offset: 12,
                      fontSize: 10,
                      fill: 'var(--success)',
                    }}
                  />
                )}
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
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
          )
        ) : (
          <TargetResultCard
            result={targetResult}
            targetXa={targetXa}
            variable={sweepConfig.variable}
            reactorLabel={
              sweepConfig.variable === 'tau'
                ? (reactorNodes.find(n =>
                    n.id === (sweepConfig.targetNodeId ?? reactorNodes[0]?.id)
                  )?.data as { label?: string })?.label ?? null
                : null
            }
            lo={sweepConfig.from}
            hi={sweepConfig.to}
          />
        )}
      </div>
    </div>
  );
}
