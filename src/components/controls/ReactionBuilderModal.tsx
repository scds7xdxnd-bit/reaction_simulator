import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { CustomNetworkReaction, CustomSpeciesMeta, CustomReactionNetwork, RateType } from '../../types/simulation';
import { useSimulatorStore } from '../../store/simulatorStore';
import { parseEquations, type ParsedReaction, type ReactionTerm } from '../../math/equationParser';
import { allSpeciesIds, getSpecies } from '../../math/thermoLibrary';
import { presetToText } from '../../math/reactionRegistry';
import type { SpeciesLibraryEntry } from '../../types/chemistry';

const RATE_TYPES: { value: RateType; label: string; desc: string; params: { key: string; label: string; default: number }[] }[] = [
  { value: 'power-law', label: 'Power law', desc: 'r = k\u00b7\u03a0[C\u1d62]\u207f\u2071', params: [
    { key: 'k', label: 'k', default: 0.5 }, { key: 'Ea', label: 'Ea (kJ/mol)', default: 0 }, { key: 'T_ref', label: 'T_ref (K)', default: 300 },
  ]},
  { value: 'michaelis-menten', label: 'Michaelis-Menten', desc: 'r = Vmax\u00b7C\u2090/(Km+C\u2090)', params: [
    { key: 'Vmax', label: 'Vmax', default: 1.0 }, { key: 'Km', label: 'Km', default: 0.5 },
  ]},
  { value: 'langmuir-hinshelwood', label: 'Langmuir-Hinshelwood', desc: 'r = k\u00b7C\u2090/(1+K\u2090C\u2090+K_B\u00b7C_B)', params: [
    { key: 'k', label: 'k', default: 0.5 }, { key: 'K_A', label: 'K_A', default: 0.2 }, { key: 'K_B', label: 'K_B', default: 0.1 },
  ]},
];

interface RateState { rateType: RateType; rateParams: Record<string, number>; deltaH: number | undefined }
function defaultRateState(): RateState { return { rateType: 'power-law', rateParams: { k: 0.5, Ea: 0, T_ref: 300 }, deltaH: undefined }; }

const PRESETS_KEY = 'rsi-custom-presets';
const MAX_PRESETS = 10;
interface SavedPreset { name: string; network: CustomReactionNetwork }
function loadPresets(): SavedPreset[] {
  try { const raw = localStorage.getItem(PRESETS_KEY); return raw ? (JSON.parse(raw) as SavedPreset[]) : []; } catch { return []; }
}
function savePresetsToStorage(presets: SavedPreset[]): void { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); }

function reactionSignature(step: ParsedReaction): string {
  const rct = [...step.reactants].sort((a, b) => a.species.localeCompare(b.species));
  const prd = [...step.products].sort((a, b) => a.species.localeCompare(b.species));
  const fmt = (t: ReactionTerm) => t.coeff === 1 ? t.species : t.coeff.toString() + t.species;
  return rct.map(fmt).join('+') + (step.reversible ? '<->' : '->') + prd.map(fmt).join('+');
}
function stepToText(step: ParsedReaction): string {
  const fmt = (t: ReactionTerm) => t.coeff === 1 ? t.species : t.coeff.toString() + t.species;
  const arrow = step.reversible ? '<->' : '->';
  return step.reactants.map(fmt).join(' + ') + ' ' + arrow + ' ' + step.products.map(fmt).join(' + ');
}
function networkReactionsToText(reactions: CustomNetworkReaction[]): string {
  return reactions.map((rxn) => {
    const fmt = (t: { species: string; coeff: number }) => t.coeff === 1 ? t.species : t.coeff.toString() + t.species;
    const arrow = rxn.reversible ? '<->' : '->';
    return rxn.reactants.map(fmt).join(' + ') + ' ' + arrow + ' ' + rxn.products.map(fmt).join(' + ');
  }).join('\\n');
}
function rxnSignature(rxn: CustomNetworkReaction): string {
  const rct = [...rxn.reactants].sort((a, b) => a.species.localeCompare(b.species));
  const prd = [...rxn.products].sort((a, b) => a.species.localeCompare(b.species));
  const fmt = (t: { species: string; coeff: number }) => t.coeff === 1 ? t.species : t.coeff.toString() + t.species;
  return rct.map(fmt).join('+') + (rxn.reversible ? '<->' : '->') + prd.map(fmt).join('+');
}
function rateParamsForType(rateType: RateType, existing: Record<string, number>): Record<string, number> {
  const rt = RATE_TYPES.find((r) => r.value === rateType)!;
  const out: Record<string, number> = {};
  for (const p of rt.params) out[p.key] = existing[p.key] ?? p.default;
  return out;
}
function speciesUnion(steps: ParsedReaction[]): string[] {
  const s = new Set<string>();
  for (const st of steps) { for (const r of st.reactants) s.add(r.species); for (const p of st.products) s.add(p.species); }
  return [...s];
}
interface RateStateMap { [signature: string]: RateState }
function seedRateStates(steps: ParsedReaction[], saved: RateStateMap | undefined, seedKs: number[], storeEa: number, storeTref: number): RateStateMap {
  const out: RateStateMap = {};
  for (let i = 0; i < steps.length; i++) {
    const key = reactionSignature(steps[i]);
    if (saved?.[key]) { out[key] = { ...saved[key] }; continue; }
    const rp: Record<string, number> = { k: seedKs[i] ?? 0.5, Ea: storeEa, T_ref: storeTref };
    for (const r of steps[i].reactants) rp['n_' + r.species] = r.coeff;
    out[key] = { rateType: 'power-law', rateParams: rp, deltaH: undefined };
  }
  return out;
}

// ---- SVG layout ----
interface SNode { symbol: string; depth: number; indexInDepth: number; x: number; y: number; isFeed: boolean }
interface ArrowDef { rxnIdx: number; from: SNode; to: SNode }
function computeLayout(steps: ParsedReaction[]): { nodes: SNode[]; arrows: ArrowDef[]; viewBox: string } {
  if (steps.length === 0) return { nodes: [], arrows: [], viewBox: '0 0 60 80' };
  const prodSet = new Set<string>();
  const rctSet = new Set<string>();
  for (const s of steps) { for (const r of s.reactants) rctSet.add(r.species); for (const p of s.products) prodSet.add(p.species); }
  const feeds = [...rctSet].filter((x) => !prodSet.has(x));
  const depth = new Map<string, number>();
  const queue: string[] = [...feeds];
  for (const f of feeds) depth.set(f, 0);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const cd = depth.get(cur)!;
    for (const s of steps) {
      if (s.reactants.some((r) => r.species === cur)) {
        for (const p of s.products) {
          const nd = cd + 1;
          if (!depth.has(p.species) || depth.get(p.species)! > nd) {
            depth.set(p.species, nd);
            if (!queue.includes(p.species)) queue.push(p.species);
          }
        }
      }
    }
  }
  const byDepth = new Map<number, SNode[]>();
  for (const [sym, d] of depth) {
    const list = byDepth.get(d) ?? [];
    const node: SNode = { symbol: sym, depth: d, indexInDepth: list.length, x: 24 + d * 84, y: 26 + list.length * 56, isFeed: feeds.includes(sym) };
    list.push(node);
    byDepth.set(d, list);
  }
  const nodes = [...byDepth.values()].flat();
  const nodeMap = new Map(nodes.map((n) => [n.symbol, n]));
  const arrows: ArrowDef[] = [];
  for (let i = 0; i < steps.length; i++) {
    for (const r of steps[i].reactants) {
      for (const p of steps[i].products) {
        const from = nodeMap.get(r.species), to = nodeMap.get(p.species);
        if (from && to) arrows.push({ rxnIdx: i, from, to });
      }
    }
  }
  const maxDepth = Math.max(...nodes.map((n) => n.depth), 0);
  const maxY = nodes.length > 0 ? Math.max(...nodes.map((n) => n.y)) + 28 : 56;
  return { nodes, arrows, viewBox: '0 0 ' + Math.max(24 + maxDepth * 84 + 36, 80) + ' ' + Math.max(maxY + 10, 120) };
}

// ---- Component ----
export default function ReactionBuilderModal({ onClose, initialEqText }: { onClose: () => void; initialEqText?: string }) {
  const existing = useSimulatorStore((s) => s.params.customReaction);
  const storeParams = useSimulatorStore((s) => s.params);
  const updateParams = useSimulatorStore((s) => s.updateParams);
  const reactionMode = useSimulatorStore((s) => s.params.reactionMode);

  const initText = useMemo(() => {
    if (initialEqText) return initialEqText;
    if (existing && existing.reactions.length > 0) return networkReactionsToText(existing.reactions);
    if (presetToText(reactionMode)) return presetToText(reactionMode);
    return 'A -> R';
  }, [initialEqText, existing, reactionMode]);

  const [eqText, setEqText] = useState(initText);
  const [eqError, setEqError] = useState<string | null>(null);
  const initParsed = useMemo(() => parseEquations(initText), [initText]);

  const existingRateStates = useMemo((): RateStateMap | undefined => {
    if (!existing || existing.reactions.length === 0) return undefined;
    const map: RateStateMap = {};
    for (const rxn of existing.reactions) map[rxnSignature(rxn)] = { rateType: rxn.rateType, rateParams: { ...rxn.rateParams }, deltaH: rxn.deltaH };
    return map;
  }, [existing]);

  const [rateStates, setRateStates] = useState<RateStateMap>(() =>
    seedRateStates(initParsed, existingRateStates, [storeParams.k, storeParams.k2, storeParams.k3, storeParams.k4], storeParams.Ea, storeParams.T_ref),
  );
  const [parsedSteps, setParsedSteps] = useState<ParsedReaction[]>(initParsed);
  const [selectedRxnIdx, setSelectedRxnIdx] = useState(0);
  const [speciesMeta, setSpeciesMeta] = useState<Record<string, CustomSpeciesMeta>>(() => existing?.speciesMeta ?? {});

  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(loadPresets);
  const [presetName, setPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [searchOpen, setSearchOpen] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const allLibIds = useMemo(() => allSpeciesIds(), []);
  const filterLib = useCallback((query: string): SpeciesLibraryEntry[] => {
    const q = query.toLowerCase().trim();
    if (q.length < 1) return [];
    const out: SpeciesLibraryEntry[] = [];
    for (const id of allLibIds) {
      const s = getSpecies(id)!;
      if (s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.formula.toLowerCase().includes(q)) { out.push(s); if (out.length >= 6) break; }
    }
    return out;
  }, [allLibIds]);

  // debounced parse
  useEffect(() => {
    if (!eqText.trim()) { setEqError(null); setParsedSteps([]); return; }
    const t = setTimeout(() => {
      const steps = parseEquations(eqText);
      if (steps.length === 0) { setEqError('Could not parse any reactions'); return; }
      setEqError(null);
      setParsedSteps(steps);
      setRateStates((prev) => seedRateStates(steps, prev, [storeParams.k, storeParams.k2, storeParams.k3, storeParams.k4], storeParams.Ea, storeParams.T_ref));
    }, 200);
    return () => clearTimeout(t);
  }, [eqText, storeParams.k, storeParams.k2, storeParams.k3, storeParams.k4, storeParams.Ea, storeParams.T_ref]);

  useEffect(() => { if (selectedRxnIdx >= parsedSteps.length) setSelectedRxnIdx(Math.max(0, parsedSteps.length - 1)); }, [parsedSteps.length, selectedRxnIdx]);

  const layout = useMemo(() => computeLayout(parsedSteps), [parsedSteps]);

  const updateRateState = (sig: string, patch: Partial<RateState>) => {
    setRateStates((prev) => {
      const cur = prev[sig] ?? defaultRateState();
      let next = { ...cur, ...patch };
      if (patch.rateType && patch.rateType !== cur.rateType) next.rateParams = rateParamsForType(patch.rateType, cur.rateParams);
      return { ...prev, [sig]: next };
    });
  };

  const activeStep = parsedSteps[selectedRxnIdx];
  const activeSig = activeStep ? reactionSignature(activeStep) : '';
  const activeRateState = rateStates[activeSig] ?? defaultRateState();
  const activeRateDef = RATE_TYPES.find((r) => r.value === activeRateState.rateType)!;

  const updateSpeciesMeta = (sym: string, patch: Partial<CustomSpeciesMeta>) => {
    setSpeciesMeta((prev) => {
      const cur = prev[sym] ?? {};
      const next = { ...cur, ...patch };
      if (Object.keys(next).length === 0) { const copy = { ...prev }; delete copy[sym]; return copy; }
      return { ...prev, [sym]: next };
    });
  };

  const assembleNetwork = useCallback((): CustomReactionNetwork | null => {
    if (parsedSteps.length === 0) return null;
    const unique = speciesUnion(parsedSteps);
    const meta: Record<string, CustomSpeciesMeta> = {};
    for (const sym of unique) { if (speciesMeta[sym] && Object.keys(speciesMeta[sym]).length > 0) meta[sym] = { ...speciesMeta[sym] }; }
    const reactions: CustomNetworkReaction[] = parsedSteps.map((step, i) => {
      const rs = rateStates[reactionSignature(step)] ?? defaultRateState();
      return {
        id: 'cr-' + (i + 1),
        reactants: step.reactants.map((t) => ({ species: t.species, coeff: t.coeff })),
        products: step.products.map((t) => ({ species: t.species, coeff: t.coeff })),
        reversible: step.reversible,
        rateType: rs.rateType,
        rateParams: { ...rs.rateParams },
        deltaH: rs.deltaH,
      };
    });
    return { reactions, speciesMeta: meta, keyReactantId: reactions[0]?.reactants[0]?.species };
  }, [parsedSteps, rateStates, speciesMeta]);

  const validation = useMemo((): { ok: boolean; msg: string } => {
    if (parsedSteps.length === 0) return { ok: false, msg: 'No reactions parsed' };
    for (let i = 0; i < parsedSteps.length; i++) {
      const s = parsedSteps[i];
      if (s.reactants.length === 0) return { ok: false, msg: 'Reaction ' + (i + 1) + ' has no reactant' };
      if (s.products.length === 0) return { ok: false, msg: 'Reaction ' + (i + 1) + ' has no product' };
      for (const r of s.reactants) { if (r.coeff <= 0 || !r.species) return { ok: false, msg: 'Reaction ' + (i + 1) + ': invalid reactant' }; }
      for (const p of s.products) { if (p.coeff <= 0 || !p.species) return { ok: false, msg: 'Reaction ' + (i + 1) + ': invalid product' }; }
    }
    const uniq = speciesUnion(parsedSteps);
    return { ok: true, msg: parsedSteps.length + ' reaction' + (parsedSteps.length > 1 ? 's' : '') + ' \u00b7 ' + uniq.length + ' species' };
  }, [parsedSteps]);

  const handleSave = () => {
    if (!validation.ok) return;
    const net = assembleNetwork(); if (!net) return;
    updateParams({ customReaction: net, reactionMode: 'custom' });
    onClose();
  };
  const handleSavePreset = () => {
    if (!presetName.trim() || !validation.ok) return;
    const net = assembleNetwork(); if (!net) return;
    const updated = [{ name: presetName.trim(), network: net }, ...savedPresets.filter((p) => p.name !== presetName.trim())].slice(0, MAX_PRESETS);
    savePresetsToStorage(updated); setSavedPresets(updated); setPresetName(''); setShowSaveInput(false);
  };
  const handleLoadPreset = (preset: SavedPreset) => {
    setEqText(networkReactionsToText(preset.network.reactions));
    setSpeciesMeta({ ...preset.network.speciesMeta });
    const rsMap: RateStateMap = {};
    for (const rxn of preset.network.reactions) rsMap[rxnSignature(rxn)] = { rateType: rxn.rateType, rateParams: { ...rxn.rateParams }, deltaH: rxn.deltaH };
    setRateStates(rsMap);
    setSelectedRxnIdx(0);
  };
  const handleDeletePreset = (name: string) => {
    const updated = savedPresets.filter((p) => p.name !== name);
    savePresetsToStorage(updated); setSavedPresets(updated);
  };

  const uniqueSpecies = useMemo(() => speciesUnion(parsedSteps), [parsedSteps]);
  const handleReversibleToggle = () => {
    if (!activeStep) return;
    const updated = [...parsedSteps];
    updated[selectedRxnIdx] = { ...updated[selectedRxnIdx], reversible: !updated[selectedRxnIdx].reversible };
    setEqText(updated.map(stepToText).join('\\n'));
  };

  const hits = searchOpen ? filterLib(searchQuery) : [];
  const accent = '#2563eb';

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.24)', width: 780, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Reaction network builder</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>Type reactions — the network and species build themselves</div>
          </div>
          <button onClick={onClose} style={{ fontSize: 16, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* Presets bar */}
          {savedPresets.length > 0 && (
            <div style={{ padding: '6px 18px 0' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>My Presets</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {savedPresets.map((p) => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5, padding: '2px 6px 2px 8px' }}>
                    <button onClick={() => handleLoadPreset(p)} style={{ fontSize: 10, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>{p.name}</button>
                    <button onClick={() => handleDeletePreset(p.name)} style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, minHeight: 360 }}>
            {/* LEFT: Source */}
            <div style={{ padding: '10px 12px 10px 18px', display: 'flex', flexDirection: 'column', gap: 10, borderRight: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Source</span>
                <span style={{ fontSize: 8, fontWeight: 600, color: accent, background: '#dbeafe', borderRadius: 8, padding: '1px 6px' }}>you edit this</span>
              </div>
              <textarea value={eqText} onChange={(e) => setEqText(e.target.value)}
                placeholder={'A -> R\nA -> R -> S\nA -> R, A -> S  (parallel)'} rows={6}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 11, fontFamily: 'monospace', padding: '8px 10px', borderRadius: 6, resize: 'vertical', border: '1px solid ' + (eqError ? '#fca5a5' : '#e2e8f0'), background: '#f8fafc', color: '#1e293b', outline: 'none', lineHeight: 1.7 }}
              />
              <div style={{ fontSize: 9, color: '#64748b', marginTop: -6 }}>
                one reaction per line · <code style={{ fontSize: 9 }}>2A + B</code> for coefficients · <code style={{ fontSize: 9 }}>&lt;-&gt;</code> reversible · <code style={{ fontSize: 9 }}>A -&gt; R -&gt; S</code> chains
              </div>
              {eqError ? (
                <div style={{ padding: '5px 10px', borderRadius: 4, background: '#fef2f2', border: '1px solid #fca5a5', fontSize: 10, color: '#dc2626' }}>{eqError}</div>
              ) : parsedSteps.length > 0 ? (
                <div style={{ padding: '5px 10px', borderRadius: 4, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 10, color: '#15803d' }}>
                  ✓ {parsedSteps.length} reaction{parsedSteps.length > 1 ? 's' : ''} parsed
                </div>
              ) : null}

              {/* Reaction tabs */}
              {parsedSteps.length > 1 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {parsedSteps.map((step, i) => (
                    <button key={i} onClick={() => setSelectedRxnIdx(i)}
                      style={{ fontSize: 9, fontWeight: selectedRxnIdx === i ? 700 : 500, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 12, border: '1px solid ' + (selectedRxnIdx === i ? accent : '#e2e8f0'), background: selectedRxnIdx === i ? '#dbeafe' : '#f8fafc', color: selectedRxnIdx === i ? accent : '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      R{i + 1} {stepToText(step).replace(' -> ', '\u2192').replace(' <-> ', '\u21cc')}
                    </button>
                  ))}
                </div>
              )}

              {/* Rate-law inspector */}
              {activeStep && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Rate law · reaction {selectedRxnIdx + 1} <code style={{ fontSize: 10, fontWeight: 400, color: '#1e293b', textTransform: 'none' }}>{stepToText(activeStep)}</code>
                  </div>
                  <select value={activeRateState.rateType}
                    onChange={(e) => updateRateState(activeSig, { rateType: e.target.value as RateType })}
                    style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', maxWidth: 180, fontFamily: 'monospace' }}>
                    {RATE_TYPES.map((rt) => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                  </select>
                  <div style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', marginTop: -4 }}>{activeRateDef.desc}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {activeRateDef.params.map((p) => (
                      <div key={p.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                        <span style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>{p.label}</span>
                        <input type="number" step={0.01}
                          value={activeRateState.rateParams[p.key] ?? p.default}
                          onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateRateState(activeSig, { rateParams: { ...activeRateState.rateParams, [p.key]: v } }); }}
                          style={{ width: 58, fontSize: 10, padding: '3px 5px', borderRadius: 4, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: 'monospace' }}
                        />
                      </div>
                    ))}
                    {activeRateState.rateType === 'power-law' && activeStep.reactants.map((r) => (
                      <div key={'n_' + r.species} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                        <span style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>n_{r.species}</span>
                        <input type="number" step={0.1} min={0}
                          value={activeRateState.rateParams['n_' + r.species] ?? r.coeff}
                          onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateRateState(activeSig, { rateParams: { ...activeRateState.rateParams, ['n_' + r.species]: v } }); }}
                          style={{ width: 48, fontSize: 10, padding: '3px 5px', borderRadius: 4, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: 'monospace' }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* reversible + Keq */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', fontSize: 10 }}>
                    <input type="checkbox" checked={activeStep.reversible} onChange={handleReversibleToggle} />
                    <span style={{ color: activeStep.reversible ? '#1e293b' : '#64748b', fontWeight: activeStep.reversible ? 600 : 400 }}>Reversible</span>
                    {activeStep.reversible && activeRateState.rateType === 'power-law' && (
                      <>
                        <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>Keq</span>
                        <input type="number" min={0.01} max={1000} step={0.1}
                          value={activeRateState.rateParams['Keq'] ?? 4}
                          onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) updateRateState(activeSig, { rateParams: { ...activeRateState.rateParams, Keq: Math.min(1000, v) } }); }}
                          style={{ width: 60, fontSize: 10, padding: '2px 5px', borderRadius: 4, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none' }}
                        />
                      </>
                    )}
                  </label>

                  {/* per-reaction deltaH */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>{'\u0394'}H (kJ/mol)</span>
                    <input type="number" step={1}
                      value={activeRateState.deltaH ?? ''} placeholder="inherit"
                      onChange={(e) => { const raw = e.target.value; updateRateState(activeSig, { deltaH: raw === '' ? undefined : parseFloat(raw) }); }}
                      style={{ width: 64, fontSize: 10, padding: '2px 5px', borderRadius: 4, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Live preview / SVG */}
            <div style={{ padding: '10px 18px 10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live preview</span>
                <span style={{ fontSize: 8, fontWeight: 500, color: '#64748b', background: '#f8fafc', borderRadius: 8, padding: '1px 6px', border: '1px solid #f1f5f9' }}>auto-generated</span>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, overflow: 'auto', minHeight: 200 }}>
                <svg viewBox={layout.viewBox} style={{ width: '100%', height: 'auto', minHeight: 180 }}>
                  <defs>
                    <marker id="arr-sel" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <polygon points="0,1 0,5 5,3" fill={accent} />
                    </marker>
                    <marker id="arr-nor" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <polygon points="0,1 0,5 5,3" fill="#94a3b8" />
                    </marker>
                  </defs>
                  {layout.nodes.map((n) => (
                    <g key={n.symbol}>
                      <circle cx={n.x} cy={n.y} r={14} fill={n.isFeed ? '#dbeafe' : '#fff'}
                        stroke={n.isFeed ? accent : '#94a3b8'} strokeWidth={n.isFeed ? 2 : 1.5} />
                      <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central"
                        fontSize={n.symbol.length > 2 ? 8 : 11} fontWeight={600}
                        fill={n.isFeed ? accent : '#1e293b'} fontFamily="monospace">{n.symbol}</text>
                    </g>
                  ))}
                  {layout.arrows.map((a, ai) => {
                    const midX = (a.from.x + a.to.x) / 2;
                    const midY = (a.from.y + a.to.y) / 2;
                    const isSel = a.rxnIdx === selectedRxnIdx;
                    const sx = a.from.x + 14;
                    const ex = a.to.x - 14;
                    return (
                      <g key={'a' + ai}>
                        <line x1={sx} y1={a.from.y} x2={ex} y2={a.to.y}
                          stroke={isSel ? accent : '#94a3b8'} strokeWidth={isSel ? 2 : 1.3}
                          markerEnd={'url(#' + (isSel ? 'arr-sel' : 'arr-nor') + ')'}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedRxnIdx(a.rxnIdx)} />
                        <circle cx={midX} cy={midY} r={7} fill={isSel ? accent : '#94a3b8'}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedRxnIdx(a.rxnIdx)} />
                        <text x={midX} y={midY} textAnchor="middle" dominantBaseline="central"
                          fontSize={8} fontWeight={700} fill="#fff" fontFamily="monospace"
                          style={{ cursor: 'pointer', pointerEvents: 'none' }}>{a.rxnIdx + 1}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>

          {/* Species strip */}
          {uniqueSpecies.length > 0 && (
            <div style={{ borderTop: '1px solid #e2e8f0', padding: '8px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Species</span>
                <span style={{ fontSize: 8, fontWeight: 500, color: '#64748b', background: '#f8fafc', borderRadius: 8, padding: '1px 6px', border: '1px solid #f1f5f9' }}>found in equations</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {uniqueSpecies.map((sym) => {
                  const meta = speciesMeta[sym] ?? {};
                  const boundEntry = meta.boundLibraryId ? getSpecies(meta.boundLibraryId) : undefined;
                  const libHits = hits.filter((h) => h.id !== meta.boundLibraryId);
                  return (
                    <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', fontFamily: 'monospace', marginRight: 2 }}>{sym}</span>
                      {boundEntry ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 3, padding: '1px 5px', fontSize: 9, color: '#15803d', fontFamily: 'monospace' }}>
                          {boundEntry.id}
                          <button onClick={() => updateSpeciesMeta(sym, { boundLibraryId: undefined })}
                            style={{ fontSize: 10, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>×</button>
                        </span>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <input value={searchOpen === sym ? searchQuery : ''}
                            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(sym); }}
                            onFocus={() => setSearchOpen(sym)}
                            onBlur={() => setTimeout(() => setSearchOpen(null), 160)}
                            placeholder="bind…"
                            style={{ width: 56, fontSize: 10, padding: '2px 4px', borderRadius: 3, background: '#fff', border: '1px solid #e2e8f0', color: '#64748b', outline: 'none' }}
                          />
                          {searchOpen === sym && libHits.length > 0 && (
                            <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 2, zIndex: 500, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.14)', minWidth: 210 }}>
                              {libHits.map((h) => (
                                <button key={h.id}
                                  onMouseDown={() => { updateSpeciesMeta(sym, { boundLibraryId: h.id }); setSearchOpen(null); setSearchQuery(''); }}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 10px', border: 'none', borderBottom: '1px solid #f1f5f9', background: 'none', cursor: 'pointer' }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: accent }}>{h.id}</span>
                                  <span style={{ fontSize: 10, color: '#64748b', marginLeft: 5 }}>{h.name}</span>
                                  <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 4 }}>({h.formula})</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <select value={meta.phase ?? ''}
                        onChange={(e) => updateSpeciesMeta(sym, { phase: (e.target.value || undefined) as 'g' | 'l' | 's' | undefined })}
                        style={{ fontSize: 10, padding: '1px 3px', borderRadius: 3, background: '#fff', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', marginLeft: 4 }}>
                        <option value="">phase</option>
                        <option value="g">g</option>
                        <option value="l">l</option>
                        <option value="s">s</option>
                      </select>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4 }}>
                        <span style={{ fontSize: 8, color: '#64748b' }}>feed</span>
                        <input type="number" min={0} step={0.1}
                          value={meta.feedConc ?? ''} placeholder="0"
                          onChange={(e) => { const v = e.target.value === '' ? undefined : parseFloat(e.target.value); updateSpeciesMeta(sym, { feedConc: isNaN(v as number) ? undefined : v as number }); }}
                          style={{ width: 42, fontSize: 10, padding: '1px 3px', borderRadius: 3, background: '#fff', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', textAlign: 'right' }}
                        />
                        <span style={{ fontSize: 8, color: '#64748b' }}>mol/L</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Save preset row */}
          <div style={{ padding: '6px 18px' }}>
            {showSaveInput ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input autoFocus placeholder="Preset name…" value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') setShowSaveInput(false); }}
                  maxLength={30}
                  style={{ flex: 1, fontSize: 11, padding: '4px 8px', borderRadius: 4, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none' }}
                />
                <button onClick={handleSavePreset} disabled={!presetName.trim() || !validation.ok}
                  style={{ fontSize: 10, padding: '4px 10px', borderRadius: 4, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: (!presetName.trim() || !validation.ok) ? 0.5 : 1 }}>Save</button>
                <button onClick={() => setShowSaveInput(false)}
                  style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer' }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setShowSaveInput(true)} disabled={!validation.ok || savedPresets.length >= MAX_PRESETS}
                style={{ fontSize: 10, padding: '3px 10px', borderRadius: 4, border: '1px solid #7c3aed', background: '#f5f3ff', color: '#7c3aed', cursor: !validation.ok ? 'not-allowed' : 'pointer', opacity: !validation.ok ? 0.5 : 1, fontWeight: 600 }}>
                {savedPresets.length >= MAX_PRESETS ? 'Presets full (10 max)' : '+ Save as preset'}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {validation.ok ? (
            <span style={{ fontSize: 10, color: '#15803d' }}>{validation.msg} ✓</span>
          ) : (
            <span style={{ fontSize: 11, color: '#dc2626' }}>{validation.msg}</span>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ fontSize: 11, padding: '5px 14px', borderRadius: 5, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={!validation.ok}
              style={{ fontSize: 11, padding: '5px 14px', borderRadius: 5, border: 'none', background: validation.ok ? accent : '#94a3b8', color: '#fff', fontWeight: 600, cursor: validation.ok ? 'pointer' : 'not-allowed' }}>
              Save network
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
