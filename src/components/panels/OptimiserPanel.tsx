/**
 * F23 — Optimisation Engine Panel
 *
 * Nelder-Mead multi-variable optimiser wired to the live flowsheet.
 * Variables: node params (τ, T_c, W_cat…). Objectives: Xa, T_out, Ca_out, EP.
 */
import { useState, useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { useSimulatorStore } from '../../store/simulatorStore';
import {
  useOptimizer, OPTIM_SCHEMA,
  type OptimVar, type OptimConfig, type OptimObjective,
} from '../../hooks/useOptimizer';

// ─── Constants ────────────────────────────────────────────────────────────────

const OBJ_OPTIONS: { value: OptimObjective; label: string; unit: string }[] = [
  { value: 'Xa',     label: 'Conversion Xₐ',     unit: ''     },
  { value: 'T_out',  label: 'Outlet temp T_out',  unit: 'K'   },
  { value: 'Ca_out', label: 'Exit conc C_A,out',  unit: 'M'   },
  { value: 'EP',     label: 'Economic Potential', unit: '$/yr' },
];

const inputStyle: React.CSSProperties = {
  fontSize: 10, fontFamily: 'monospace',
  background: 'var(--bg-surface)', border: '1px solid var(--border)',
  borderRadius: 4, padding: '2px 4px', color: 'var(--text-primary)',
  outline: 'none', width: 60,
};

function fmtMetric(v: number, obj: OptimObjective): string {
  if (obj === 'Xa' || obj === 'Ca_out') return v.toFixed(4);
  if (obj === 'T_out') return `${v.toFixed(2)} K`;
  if (obj === 'EP') return `$${Math.round(v).toLocaleString('en-US')}/yr`;
  return v.toFixed(4);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OptimiserPanel() {
  const nodes = useSimulatorStore(s => s.nodes);
  const { run, cancel, reset, applyToFlowsheet, isRunning, progress, applied } = useOptimizer();

  // ── Build default variable list from equipment nodes ────────────────────────
  const defaultVars = useMemo((): OptimVar[] => {
    const vars: OptimVar[] = [];
    for (const n of nodes) {
      const schema = OPTIM_SCHEMA[n.type ?? ''];
      if (!schema) continue;
      const nodeLabel = (n.data as { label?: string })?.label ?? n.type ?? n.id;
      for (const s of schema) {
        // initialise bounds from current node value if set
        const currentVal = (n.data as Record<string, number>)[s.param];
        const min = s.min;
        const max = s.max;
        vars.push({
          nodeId: n.id,
          param:  s.param,
          label:  `${nodeLabel} · ${s.label}`,
          min,
          max,
          enabled: false,
        });
        void currentVal; // used in tooltip only
      }
    }
    return vars;
  }, [nodes]);

  const [vars, setVars] = useState<OptimVar[]>([]);
  // Sync when defaultVars changes (new nodes added)
  const effectiveVars: OptimVar[] = useMemo(() => {
    return defaultVars.map(dv => {
      const existing = vars.find(v => v.nodeId === dv.nodeId && v.param === dv.param);
      return existing ?? dv;
    });
  }, [defaultVars, vars]);

  const [objective,  setObjective]  = useState<OptimObjective>('Xa');
  const [maximize,   setMaximize]   = useState(true);
  const [maxIter,    setMaxIter]    = useState(200);

  const activeCount = effectiveVars.filter(v => v.enabled).length;

  // ── Build config ─────────────────────────────────────────────────────────────
  const config: OptimConfig = {
    vars: effectiveVars,
    objective,
    maximize,
    constraints: [],
    maxIter,
  };

  // ── Handlers ──────────────────────────────────────────────────────────────────
  function toggleVar(nodeId: string, param: string) {
    setVars(prev => {
      const updated = effectiveVars.map(v =>
        v.nodeId === nodeId && v.param === param ? { ...v, enabled: !v.enabled } : v
      );
      return updated;
    });
  }

  function updateBound(nodeId: string, param: string, key: 'min' | 'max', val: number) {
    setVars(prev => {
      const base = effectiveVars;
      return base.map(v =>
        v.nodeId === nodeId && v.param === param ? { ...v, [key]: val } : v
      );
    });
  }

  const latestProgress = progress[progress.length - 1];

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ color: 'var(--text-primary)', fontSize: 10 }}>
      {/* Header */}
      <div
        className="px-3 py-2 shrink-0 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <span style={{ fontWeight: 600, fontSize: 11 }}>Optimisation Engine</span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Nelder–Mead · {activeCount} var{activeCount !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── Variable selection ──────────────────────────────────────────────── */}
        <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 600, fontSize: 10, marginBottom: 5, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Design Variables
          </div>

          {effectiveVars.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 10 }}>
              Add equipment nodes (CSTR, PFR, HX…) to the canvas first.
            </p>
          )}

          {effectiveVars.map(v => (
            <div key={`${v.nodeId}:${v.param}`} className="flex items-center gap-2 mb-1">
              <input
                type="checkbox"
                checked={v.enabled}
                onChange={() => toggleVar(v.nodeId, v.param)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ flex: 1, color: v.enabled ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {v.label}
              </span>
              {v.enabled && (
                <>
                  <input
                    type="number"
                    value={v.min}
                    step={(v.max - v.min) / 100}
                    onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) updateBound(v.nodeId, v.param, 'min', n); }}
                    onKeyDown={e => e.stopPropagation()}
                    style={{ ...inputStyle, width: 52 }}
                    title="Min"
                  />
                  <span style={{ color: 'var(--text-muted)' }}>–</span>
                  <input
                    type="number"
                    value={v.max}
                    step={(v.max - v.min) / 100}
                    onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) updateBound(v.nodeId, v.param, 'max', n); }}
                    onKeyDown={e => e.stopPropagation()}
                    style={{ ...inputStyle, width: 52 }}
                    title="Max"
                  />
                </>
              )}
            </div>
          ))}
        </div>

        {/* ── Objective ───────────────────────────────────────────────────────── */}
        <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 600, fontSize: 10, marginBottom: 5, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Objective
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={objective}
              onChange={e => setObjective(e.target.value as OptimObjective)}
              onKeyDown={e => e.stopPropagation()}
              style={{ ...inputStyle, width: 'auto', flex: 1 }}
            >
              {OBJ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="seg-ctrl" style={{ fontSize: 10 }}>
              <button className={maximize ? 'active' : ''}  onClick={() => setMaximize(true)}>Maximise</button>
              <button className={!maximize ? 'active' : ''} onClick={() => setMaximize(false)}>Minimise</button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span style={{ color: 'var(--text-secondary)' }}>Budget</span>
            <input
              type="number"
              min={20} max={2000} step={20}
              value={maxIter}
              onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n)) setMaxIter(Math.max(20, n)); }}
              onKeyDown={e => e.stopPropagation()}
              style={{ ...inputStyle, width: 60 }}
            />
            <span style={{ color: 'var(--text-muted)' }}>iterations</span>
          </div>
        </div>

        {/* ── Run button ──────────────────────────────────────────────────────── */}
        <div className="px-3 py-2 flex gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
          {!isRunning ? (
            <button
              onClick={() => run(config)}
              disabled={activeCount === 0}
              style={{
                flex: 1, padding: '5px 0', fontSize: 11, fontWeight: 600,
                background: activeCount === 0 ? 'var(--bg-surface)' : 'var(--accent)',
                color: activeCount === 0 ? 'var(--text-muted)' : '#fff',
                border: 'none', borderRadius: 6, cursor: activeCount === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Optimise
            </button>
          ) : (
            <button
              onClick={cancel}
              style={{
                flex: 1, padding: '5px 0', fontSize: 11, fontWeight: 600,
                background: '#dc2626', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={reset}
            disabled={isRunning}
            style={{
              padding: '5px 10px', fontSize: 10,
              background: 'var(--bg-surface)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>

        {/* ── Convergence sparkline ────────────────────────────────────────────── */}
        {progress.length > 0 && (
          <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center mb-1">
              <span style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Convergence
              </span>
              {latestProgress && (
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--accent)' }}>
                  iter {latestProgress.iteration} → {fmtMetric(latestProgress.metric, objective)}
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={progress} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ fontSize: 9, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4 }}
                  formatter={(v: number) => [fmtMetric(v, objective), objective]}
                  labelFormatter={(l: number) => `iter ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="metric"
                  stroke="var(--accent)"
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Result card ──────────────────────────────────────────────────────── */}
        {applied && (
          <div className="px-3 py-2">
            <div style={{ fontWeight: 600, fontSize: 10, marginBottom: 5, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Optimum
            </div>
            <div
              className="p-2 rounded mb-2"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent)', fontSize: 10 }}
            >
              {applied.varLabels.map((label, i) => (
                <div key={i} className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {applied.x[i].toLocaleString('en-US', { maximumFractionDigits: 4, minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
              <div
                className="flex justify-between mt-1 pt-1"
                style={{ borderTop: '1px solid var(--border)', fontWeight: 700 }}
              >
                <span>{OBJ_OPTIONS.find(o => o.value === objective)?.label}</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>
                  {fmtMetric(applied.metric, objective)}
                </span>
              </div>
            </div>

            <button
              onClick={() => applyToFlowsheet(config)}
              style={{
                width: '100%', padding: '5px 0', fontSize: 11, fontWeight: 600,
                background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer',
              }}
            >
              Apply to Flowsheet
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
