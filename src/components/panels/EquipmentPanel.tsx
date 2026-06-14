/**
 * F22 — Equipment Sizing & Cost Estimation Panel
 *
 * Displays AACE Class-5 (±40%) sizing and screening-level cost for every
 * equipment node, plus Economic Potential readout.
 */
import { useMemo, useState } from 'react';
import { useSimulatorStore } from '../../store/simulatorStore';
import { computeSizing, type SizingResult } from '../../math/sizing';
import { costNode, calcEP, CEPCI_DEFAULT, type CostResult } from '../../math/costing';
import { assignTags } from '../../math/tagging';
import type { Stream } from '../../types/stream';

// ─── Formatting helpers ───────────────────────────────────────────────────────

const fmt = (n: number, dec: number) =>
  n < 1e-9 ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: dec, minimumFractionDigits: dec });

const fmtUSD = (n: number) =>
  n < 1 ? '—' : '$' + Math.round(n).toLocaleString('en-US');

function sizeLabel(r: SizingResult): string {
  if (r.sizeUnit === 'm³' && r.V_design_m3 != null) return `${fmt(r.V_design_m3, 3)} m³`;
  if (r.sizeUnit === 'm²' && r.A_m2       != null) return `${fmt(r.A_m2, 2)} m²`;
  if (r.sizeUnit === 'kW' && r.power_kW   != null) return `${fmt(r.power_kW, 2)} kW`;
  return '—';
}

function dimLabel(r: SizingResult): string {
  if (r.D_m != null && r.L_m != null)
    return `Ø${fmt(r.D_m, 3)} × ${fmt(r.L_m, 3)} m`;
  if (r.Q_kW != null)
    return `${fmt(r.Q_kW, 1)} kW duty`;
  return '—';
}

const TYPE_LABEL: Record<string, string> = {
  cstr: 'CSTR', pfr: 'PFR', fixedbed: 'Fixed Bed',
  batch: 'Batch', semibatch: 'Semibatch',
  hx: 'HX', flash: 'Flash', pump: 'Pump', comp: 'Compressor', valve: 'Valve',
};

// ─── Editable field ───────────────────────────────────────────────────────────

function NumInput({
  label, value, onChange, unit, step = 1,
}: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; step?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[10px]">
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          onKeyDown={(e) => e.stopPropagation()}
          style={{
            width: 64, fontSize: 10, fontFamily: 'monospace',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '2px 4px', color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        {unit && <span style={{ color: 'var(--text-muted)', minWidth: 28 }}>{unit}</span>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EquipmentPanel() {
  const nodes  = useSimulatorStore((s) => s.nodes);
  const edges  = useSimulatorStore((s) => s.edges);
  const result = useSimulatorStore((s) => s.result);

  // Economic parameters (local state — display only, not persisted)
  const [cepci,      setCepci]      = useState(CEPCI_DEFAULT);
  const [plantLife,  setPlantLife]  = useState(10);
  const [opHours,    setOpHours]    = useState(8000);
  const [productP,   setProductP]   = useState(0.01);   // $/mol
  const [feedP,      setFeedP]      = useState(0.001);  // $/mol
  const [steamP,     setSteamP]     = useState(6);      // $/GJ
  const [coolingP,   setCoolingP]   = useState(0.1);    // $/GJ
  const [elecP,      setElecP]      = useState(0.08);   // $/kWh

  // ── Compute sizing ──────────────────────────────────────────────────────────
  const tags = useMemo(() =>
    assignTags(
      nodes.map(n => ({ id: n.id, type: n.type ?? '' })),
      edges.map(e => ({ source: e.source, target: e.target })),
    ),
  [nodes, edges]);

  const streams = useMemo((): Record<string, Stream> => {
    if (!result?.streams) return {};
    return result.streams as Record<string, Stream>;
  }, [result]);

  const sizings = useMemo(() =>
    computeSizing(
      nodes.map(n => ({ id: n.id, type: n.type ?? '', data: n.data as Record<string, unknown> })),
      edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? undefined })),
      streams,
    ),
  [nodes, edges, streams]);

  const costs = useMemo((): CostResult[] =>
    Object.values(sizings).map(s => costNode(s, cepci)),
  [sizings, cepci]);

  // ── Aggregate utility flows from sizing ─────────────────────────────────────
  const { heat_kW, power_kW } = useMemo(() => {
    let heat = 0, power = 0;
    for (const r of Object.values(sizings)) {
      heat  += r.Q_kW    ?? 0;
      power += r.power_kW ?? 0;
    }
    return { heat_kW: heat, power_kW: power };
  }, [sizings]);

  // ── Total product / feed flows ───────────────────────────────────────────────
  const { productFlow, feedFlow } = useMemo(() => {
    let prd = 0, fde = 0;
    if (!result?.streams) return { productFlow: 0, feedFlow: 0 };
    // Product = streams from product nodes; feed = streams from feed nodes
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    for (const [edgeId, stream] of Object.entries(result.streams)) {
      const edge = edges.find(e => e.id === edgeId);
      if (!edge) continue;
      const srcNode = nodeMap.get(edge.source);
      const tgtNode = nodeMap.get(edge.target);
      const F_total = Object.values((stream as Stream).F).reduce((a, b) => a + b, 0);
      if (srcNode?.type === 'feed') fde += F_total;
      if (tgtNode?.type === 'product') prd += F_total;
    }
    return { productFlow: prd, feedFlow: fde };
  }, [result, nodes, edges]);

  const ep = useMemo(() => calcEP({
    costs,
    utilities: { heat_kW, cool_kW: heat_kW, power_kW, steam_USD_GJ: steamP, cooling_USD_GJ: coolingP, elec_USD_kWh: elecP, op_hr_yr: opHours },
    product_mol_s: productFlow, product_USD_mol: productP,
    feed_mol_s: feedFlow, feed_USD_mol: feedP,
    plant_life_yr: plantLife,
  }), [costs, heat_kW, power_kW, steamP, coolingP, elecP, opHours, productFlow, productP, feedFlow, feedP, plantLife]);

  const sizingList = Object.values(sizings);
  const hasData = sizingList.length > 0;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden text-[10px]" style={{ color: 'var(--text-primary)' }}>
      {/* Header */}
      <div
        className="px-3 py-2 shrink-0 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <span style={{ fontWeight: 600, fontSize: 11 }}>Equipment Sizing</span>
        <span
          title="AACE Class-5 (±40%) screening estimate"
          style={{ fontSize: 9, color: 'var(--text-muted)', cursor: 'help', textDecoration: 'underline dotted' }}
        >
          ±40% AACE Class-5
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── Equipment table ───────────────────────────────────────────────── */}
        {!hasData && (
          <p className="p-3" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            Run the simulation to compute equipment sizes.
          </p>
        )}

        {hasData && (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                  {['Tag', 'Type', 'Size', 'D×L / Duty', 'C_p (yr)', 'C_BM'].map(h => (
                    <th key={h} style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sizingList.map((r, i) => {
                  const cost = costs.find(c => c.nodeId === r.nodeId);
                  const isEven = i % 2 === 0;
                  return (
                    <tr
                      key={r.nodeId}
                      style={{ background: isEven ? 'transparent' : 'var(--bg-surface)' }}
                    >
                      <td style={{ padding: '3px 6px', fontFamily: 'monospace', fontWeight: 600 }}>
                        {tags[r.nodeId] ?? '—'}
                      </td>
                      <td style={{ padding: '3px 6px' }}>{TYPE_LABEL[r.nodeType] ?? r.nodeType}</td>
                      <td style={{ padding: '3px 6px', fontFamily: 'monospace' }}>{sizeLabel(r)}</td>
                      <td style={{ padding: '3px 6px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{dimLabel(r)}</td>
                      <td style={{ padding: '3px 6px', fontFamily: 'monospace' }}>
                        {cost ? fmtUSD(cost.Cp_USD) : '—'}
                        {cost?.clamped && (
                          <span title="Outside Turton valid range — extrapolated" style={{ color: 'var(--warning)', marginLeft: 3 }}>*</span>
                        )}
                      </td>
                      <td style={{ padding: '3px 6px', fontFamily: 'monospace', fontWeight: 600 }}>
                        {cost ? fmtUSD(cost.Cbm_USD) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                  <td colSpan={4} style={{ padding: '3px 6px' }}>Total Module Cost (×1.18)</td>
                  <td colSpan={2} style={{ padding: '3px 6px', fontFamily: 'monospace' }}>
                    {fmtUSD(ep.totalModule_USD)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* ── Economic parameters ───────────────────────────────────────────── */}
        <div
          className="px-3 py-2"
          style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
        >
          <div style={{ fontWeight: 600, fontSize: 10, marginBottom: 6, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Economic Parameters
          </div>
          <div className="flex flex-col gap-1.5">
            <NumInput label="CEPCI index"         value={cepci}     onChange={setCepci}     step={10} />
            <NumInput label="Plant life"          value={plantLife} onChange={setPlantLife} unit="yr" />
            <NumInput label="Operating hours"     value={opHours}   onChange={setOpHours}   unit="hr/yr" step={100} />
            <NumInput label="Product price"       value={productP}  onChange={setProductP}  unit="$/mol"  step={0.001} />
            <NumInput label="Feed price"          value={feedP}     onChange={setFeedP}     unit="$/mol"  step={0.001} />
            <NumInput label="Steam"               value={steamP}    onChange={setSteamP}    unit="$/GJ"   step={0.5} />
            <NumInput label="Cooling water"       value={coolingP}  onChange={setCoolingP}  unit="$/GJ"   step={0.05} />
            <NumInput label="Electricity"         value={elecP}     onChange={setElecP}     unit="$/kWh"  step={0.01} />
          </div>
        </div>

        {/* ── EP summary ───────────────────────────────────────────────────── */}
        <div className="px-3 py-2">
          <div style={{ fontWeight: 600, fontSize: 10, marginBottom: 6, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Economic Potential (Annual)
          </div>
          <div className="flex flex-col gap-1">
            {([
              ['Product revenue',    ep.annualProduct_USD,  '#16a34a'],
              ['Feed cost',         -ep.annualFeed_USD,     '#dc2626'],
              ['Utility cost',      -ep.annualUtility_USD,  '#dc2626'],
              ['Annualised capital',-ep.annualCapital_USD,  '#dc2626'],
            ] as [string, number, string][]).map(([label, val, color]) => (
              <div key={label} className="flex justify-between items-center">
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontFamily: 'monospace', color, fontWeight: 500 }}>
                  {val >= 0 ? '+' : ''}{fmtUSD(Math.abs(val))}
                </span>
              </div>
            ))}
            <div
              className="flex justify-between items-center mt-1 pt-1"
              style={{ borderTop: '1px solid var(--border)', fontWeight: 700 }}
            >
              <span>EP [$/yr]</span>
              <span style={{
                fontFamily: 'monospace', fontSize: 12,
                color: ep.EP_USD_yr >= 0 ? '#16a34a' : '#dc2626',
              }}>
                {ep.EP_USD_yr >= 0 ? '+' : ''}{fmtUSD(Math.abs(ep.EP_USD_yr))}
              </span>
            </div>
          </div>

          <p style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 8 }}>
            * Outside Turton valid range — estimate extrapolated.
            CEPCI {cepci} (ref. 397, 2001). Douglas methodology.
          </p>
        </div>
      </div>
    </div>
  );
}
