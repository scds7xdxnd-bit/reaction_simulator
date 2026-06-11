import { useState, useMemo, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useSimulatorStore } from '../../store/simulatorStore';
import { brent } from '../../math/numerics';
import { solveNetwork } from '../../math/networkSolver';
import type { SimulationParams } from '../../types/reactor';
import type { NetworkResult } from '../../types/reactor';
import type { DesignSpec, DesignMetric } from '../../types/simulation';

const PARAM_OPTIONS = [
  { value: 'tau',    label: 'τ — residence time' },
  { value: 'k',     label: 'k — rate const' },
  { value: 'k2',    label: 'k₂' },
  { value: 'k3',    label: 'k₃' },
  { value: 'Ca0',   label: 'Cₐ₀ — feed conc.' },
  { value: 'T_ref', label: 'T_ref — temperature' },
  { value: 'Keq_ref', label: 'Keq_ref' },
] as const;

const METRIC_OPTIONS: { value: DesignMetric; label: string; fmt: (v: number) => string }[] = [
  { value: 'Xa',           label: 'Final Xₐ',       fmt: (v) => `${(v * 100).toFixed(2)}%` },
  { value: 'Ca_out',       label: 'Cₐ_out (mol/L)',  fmt: (v) => `${v.toFixed(4)}` },
  { value: 'T_out',        label: 'T_out (K)',        fmt: (v) => `${v.toFixed(2)}` },
  { value: 'yield_R',      label: 'Yield R',          fmt: (v) => `${(v * 100).toFixed(2)}%` },
  { value: 'selectivity_R', label: 'Selectivity R',  fmt: (v) => `${(v * 100).toFixed(2)}%` },
];

function extractMetric(result: NetworkResult, spec: DesignSpec): number {
  const { metric, nodeId } = spec.target;
  const segs = result.segments;
  if (metric === 'Xa') {
    if (nodeId) return segs.find((s) => s.reactorId === nodeId)?.Xa_out ?? result.finalConversion;
    return result.finalConversion;
  }
  if (metric === 'Ca_out') {
    if (nodeId) return segs.find((s) => s.reactorId === nodeId)?.Ca_out ?? 0;
    return segs[segs.length - 1]?.Ca_out ?? 0;
  }
  if (metric === 'T_out') {
    if (nodeId) return segs.find((s) => s.reactorId === nodeId)?.T_out ?? 0;
    return segs[segs.length - 1]?.T_out ?? 0;
  }
  if (metric === 'yield_R') return result.finalYield;
  if (metric === 'selectivity_R') return result.finalSelectivity;
  return 0;
}

function solveSpec(
  nodes: Node[],
  edges: Edge[],
  params: SimulationParams,
  spec: DesignSpec,
): { root: number; converged: boolean; achieved: number } | null {
  const { vary } = spec;
  if (vary.lo >= vary.hi) return null;

  const evaluate = (val: number): number => {
    const sweepNodes =
      vary.param === 'tau' && vary.nodeId
        ? nodes.map((n) => (n.id === vary.nodeId ? { ...n, data: { ...n.data, tau: val } } : n))
        : nodes;
    const sweepParams =
      vary.param !== 'tau' ? ({ ...params, [vary.param]: val } as SimulationParams) : params;
    const result = solveNetwork(sweepNodes, edges, sweepParams);
    if (!result) return -spec.target.value;
    return extractMetric(result, spec) - spec.target.value;
  };

  const { root, converged } = brent(evaluate, vary.lo, vary.hi, 1e-6, 50);
  const achieved = evaluate(root) + spec.target.value;
  return { root, converged, achieved };
}

function paramLabel(spec: DesignSpec, nodes: Node[]): string {
  const opt = PARAM_OPTIONS.find((o) => o.value === spec.vary.param);
  const base = opt?.label ?? spec.vary.param;
  if (spec.vary.nodeId) {
    const node = nodes.find((n) => n.id === spec.vary.nodeId);
    const nl = (node?.data as { label?: string })?.label ?? spec.vary.nodeId;
    return `${base} @ ${nl}`;
  }
  return base;
}

function fmtKnob(spec: DesignSpec, root: number): string {
  if (spec.vary.param === 'tau')   return `${root.toFixed(3)} s`;
  if (spec.vary.param === 'T_ref') return `${root.toFixed(2)} K`;
  if (spec.vary.param === 'Ca0')   return `${root.toFixed(4)} mol/L`;
  return root.toFixed(4);
}

interface SpecRowProps {
  spec: DesignSpec;
  result: { root: number; converged: boolean; achieved: number } | null;
  nodes: Node[];
  onRemove: () => void;
}

function SpecRow({ spec, result, nodes, onRemove }: SpecRowProps) {
  const mOpt = METRIC_OPTIONS.find((o) => o.value === spec.target.metric);
  const targetDisplay = mOpt ? mOpt.fmt(spec.target.value) : String(spec.target.value);
  const metricLabel = mOpt?.label ?? spec.target.metric;
  const pl = paramLabel(spec, nodes);

  let chip: React.ReactNode;
  if (!result) {
    chip = (
      <span style={{ background: '#f3f4f6', color: '#6b7280', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>
        computing…
      </span>
    );
  } else if (result.converged && Math.abs(result.achieved - spec.target.value) < 1e-4 * Math.max(1, Math.abs(spec.target.value))) {
    chip = (
      <span style={{ background: '#dcfce7', color: '#166534', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>
        ✓ met · {pl.split('—')[0].trim()} = {fmtKnob(spec, result.root)}
      </span>
    );
  } else {
    chip = (
      <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>
        ✗ no solution in [{spec.vary.lo}, {spec.vary.hi}]
      </span>
    );
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: '8px 10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
            Target: {metricLabel} = {targetDisplay}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Vary: {pl} in [{spec.vary.lo}, {spec.vary.hi}]
          </div>
        </div>
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
          title="Remove"
        >×</button>
      </div>
      <div style={{ marginTop: 6 }}>{chip}</div>
    </div>
  );
}

const DEFAULT_LO: Record<string, number> = {
  tau: 0.5, k: 0.01, k2: 0.01, k3: 0.01, Ca0: 0.1, T_ref: 280, Keq_ref: 1,
};
const DEFAULT_HI: Record<string, number> = {
  tau: 30, k: 10, k2: 10, k3: 10, Ca0: 5, T_ref: 500, Keq_ref: 100,
};

export default function DesignSpecsPanel() {
  const nodes            = useSimulatorStore((s) => s.nodes);
  const edges            = useSimulatorStore((s) => s.edges);
  const params           = useSimulatorStore((s) => s.params);
  const designSpecs      = useSimulatorStore((s) => s.designSpecs);
  const addDesignSpec    = useSimulatorStore((s) => s.addDesignSpec);
  const removeDesignSpec = useSimulatorStore((s) => s.removeDesignSpec);
  const pendingTarget    = useSimulatorStore((s) => s.pendingDesignTarget);
  const setPending       = useSimulatorStore((s) => s.setPendingDesignTarget);

  const reactorNodes = nodes.filter((n) => n.type === 'cstr' || n.type === 'pfr' || n.type === 'batch');

  const [adding, setAdding] = useState(false);
  const [formParam, setFormParam]   = useState('tau');
  const [formNodeId, setFormNodeId] = useState(() =>
    nodes.filter((n) => n.type === 'cstr' || n.type === 'pfr' || n.type === 'batch')[0]?.id ?? '',
  );
  const [formLo, setFormLo]         = useState(0.5);
  const [formHi, setFormHi]         = useState(30);
  const [formMetric, setFormMetric] = useState<DesignMetric>('Xa');
  const [formTargetNode, setFormTargetNode] = useState('');
  const [formValue, setFormValue]   = useState(0.9);

  useEffect(() => {
    if (pendingTarget) {
      setFormMetric(pendingTarget.metric as DesignMetric);
      setFormValue(Number(pendingTarget.value.toFixed(6)));
      setAdding(true);
      setPending(null);
    }
  }, [pendingTarget, setPending]);

  const handleParamChange = (p: string) => {
    setFormParam(p);
    setFormLo(DEFAULT_LO[p] ?? 0.1);
    setFormHi(DEFAULT_HI[p] ?? 10);
    if (p === 'tau') setFormNodeId(reactorNodes[0]?.id ?? '');
    else setFormNodeId('');
  };

  const handleAdd = () => {
    if (formLo >= formHi) return;
    const spec: DesignSpec = {
      id: String(Date.now()),
      vary: {
        param: formParam,
        nodeId: formParam === 'tau' && formNodeId ? formNodeId : undefined,
        lo: formLo,
        hi: formHi,
      },
      target: {
        metric: formMetric,
        nodeId: formTargetNode || undefined,
        value: formValue,
      },
      active: true,
    };
    addDesignSpec(spec);
    setAdding(false);
    setFormParam('tau');
    setFormNodeId(reactorNodes[0]?.id ?? '');
    setFormLo(DEFAULT_LO['tau']);
    setFormHi(DEFAULT_HI['tau']);
    setFormMetric('Xa');
    setFormTargetNode('');
    setFormValue(0.9);
  };

  const specResults = useMemo(() => {
    return designSpecs.map((spec) => {
      if (!spec.active) return null;
      try { return solveSpec(nodes, edges, params, spec); }
      catch { return null; }
    });
  }, [designSpecs, nodes, edges, params]);

  const inputStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '3px 6px',
    fontSize: 11,
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>DESIGN SPECS</span>
        <button
          onClick={() => setAdding((v) => !v)}
          style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #2563eb', background: adding ? '#2563eb' : 'transparent', color: adding ? '#fff' : '#2563eb', cursor: 'pointer' }}
        >
          {adding ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {adding && (
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface-raised)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Vary</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
            <select value={formParam} onChange={(e) => handleParamChange(e.target.value)} style={{ ...inputStyle, flex: '1 1 120px' }}>
              {PARAM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {formParam === 'tau' && reactorNodes.length > 0 && (
              <select value={formNodeId} onChange={(e) => setFormNodeId(e.target.value)} style={{ ...inputStyle, flex: '1 1 100px' }}>
                <option value="">global τ</option>
                {reactorNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {(n.data as { label?: string }).label ?? n.id}
                  </option>
                ))}
              </select>
            )}
            <input type="number" step="any" value={formLo} onChange={(e) => setFormLo(Number(e.target.value))} placeholder="lo" style={{ ...inputStyle, width: 56 }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>–</span>
            <input type="number" step="any" value={formHi} onChange={(e) => setFormHi(Number(e.target.value))} placeholder="hi" style={{ ...inputStyle, width: 56 }} />
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Target</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <select value={formMetric} onChange={(e) => setFormMetric(e.target.value as DesignMetric)} style={{ ...inputStyle, flex: '1 1 140px' }}>
              {METRIC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {reactorNodes.length > 1 && (
              <select value={formTargetNode} onChange={(e) => setFormTargetNode(e.target.value)} style={{ ...inputStyle, flex: '1 1 100px' }}>
                <option value="">final output</option>
                {reactorNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {(n.data as { label?: string }).label ?? n.id}
                  </option>
                ))}
              </select>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>=</span>
            <input type="number" step="any" value={formValue} onChange={(e) => setFormValue(Number(e.target.value))} style={{ ...inputStyle, width: 64 }} />
          </div>

          <button
            onClick={handleAdd}
            disabled={formLo >= formHi}
            style={{ fontSize: 11, padding: '3px 12px', borderRadius: 4, border: 'none', background: formLo < formHi ? '#2563eb' : '#d1d5db', color: '#fff', cursor: formLo < formHi ? 'pointer' : 'not-allowed' }}
          >
            Solve &amp; Add
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {designSpecs.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
            No specs yet.<br />Click + Add to define a target and find the required knob value.
          </div>
        ) : (
          designSpecs.map((spec, i) => (
            <SpecRow
              key={spec.id}
              spec={spec}
              result={specResults[i]}
              nodes={nodes}
              onRemove={() => removeDesignSpec(spec.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
