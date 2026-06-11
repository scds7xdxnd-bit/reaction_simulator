import { useState, useEffect, useMemo, useRef } from 'react';
import type { CustomSpecies, CustomReaction, RateType } from '../../types/simulation';
import { useSimulatorStore } from '../../store/simulatorStore';
import { formatEquation } from '../../math/formatEquation';
import { parseEquations, type ParsedReaction } from '../../math/equationParser';
import { allSpeciesIds, getSpecies, deltaHrxn, keqFromThermo } from '../../math/thermoLibrary';
import type { SpeciesLibraryEntry } from '../../types/chemistry';

const RATE_TYPES: { value: RateType; label: string; params: { key: string; label: string; default: number }[] }[] = [
  {
    value: 'power-law',
    label: 'Power Law  rₐ = k·∏Cᵢⁿ',
    params: [
      { key: 'k',    label: 'k (rate constant)',   default: 0.5  },
      { key: 'Ea',   label: 'Ea (kJ/mol)',          default: 0    },
      { key: 'T_ref', label: 'T_ref (K)',            default: 300  },
    ],
  },
  {
    value: 'michaelis-menten',
    label: 'Michaelis-Menten  rₐ = Vmax·Cₐ/(Km+Cₐ)',
    params: [
      { key: 'Vmax', label: 'Vmax (mol/L/s)',       default: 1.0  },
      { key: 'Km',   label: 'Km (mol/L)',            default: 0.5  },
    ],
  },
  {
    value: 'langmuir-hinshelwood',
    label: 'Langmuir-Hinshelwood  rₐ = k·Cₐ/(1+Kₐ·Cₐ+K_B·C_B)',
    params: [
      { key: 'k',    label: 'k (rate constant)',   default: 0.5  },
      { key: 'K_A',  label: 'K_A (adsorption A)',   default: 0.2  },
      { key: 'K_B',  label: 'K_B (adsorption B)',   default: 0.1  },
    ],
  },
];

interface StepRateLaw { rateType: RateType; rateParams: Record<string, number>; }
function defaultRateLaw(): StepRateLaw {
  return { rateType: 'power-law', rateParams: { k: 0.5, Ea: 0, T_ref: 300 } };
}

const PRESETS_KEY = 'rsi-custom-presets';
const MAX_PRESETS = 10;
interface SavedPreset { name: string; reaction: CustomReaction; }

function loadPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? (JSON.parse(raw) as SavedPreset[]) : [];
  } catch { return []; }
}
function savePresetsToStorage(presets: SavedPreset[]): void {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function validate(species: CustomSpecies[]): string | null {
  if (!species.some((s) => s.role === 'reactant')) return 'Need at least 1 reactant';
  if (!species.some((s) => s.role === 'product'))  return 'Need at least 1 product';
  if (species.some((s) => s.stoich <= 0))           return 'All stoich coefficients must be > 0';
  if (species.some((s) => !s.label.trim()))         return 'All species need a label';
  const labels = species.map((s) => s.label.trim());
  if (new Set(labels).size !== labels.length)       return 'Species labels must be unique';
  return null;
}

let _nextId = 1;
function nextId() { return String(_nextId++); }

const DEFAULT_SPECIES: CustomSpecies[] = [
  { id: nextId(), label: 'A', role: 'reactant', stoich: 1 },
  { id: nextId(), label: 'R', role: 'product',  stoich: 1 },
];

function formatEqText(species: CustomSpecies[], reversible: boolean): string {
  const fmt = (s: CustomSpecies) => s.stoich === 1 ? s.label : `${s.stoich}${s.label}`;
  const lhs = species.filter((s) => s.role === 'reactant').map(fmt).join(' + ');
  const rhs = species.filter((s) => s.role === 'product').map(fmt).join(' + ');
  if (!lhs || !rhs) return '';
  return `${lhs} ${reversible ? '<->' : '->'} ${rhs}`;
}

function parsedToSpecies(step: ParsedReaction): CustomSpecies[] {
  return [
    ...step.reactants.map((t) => ({ id: nextId(), label: t.species, role: 'reactant' as const, stoich: t.coeff })),
    ...step.products.map((t) => ({ id: nextId(), label: t.species, role: 'product' as const, stoich: t.coeff })),
  ];
}

export default function ReactionBuilderModal({ onClose, initialEqText }: { onClose: () => void; initialEqText?: string }) {
  const existing = useSimulatorStore((s) => s.params.customReaction);
  const storeParams = useSimulatorStore((s) => s.params);
  const updateParams = useSimulatorStore((s) => s.updateParams);

  const initSpecies = existing?.species ?? DEFAULT_SPECIES;
  const initReversible = existing?.reversible ?? false;
  const initText = initialEqText ?? formatEqText(initSpecies, initReversible);

  const [species, setSpecies] = useState<CustomSpecies[]>(() => {
    if (initialEqText) {
      const steps = parseEquations(initialEqText);
      return steps.length > 0 ? parsedToSpecies(steps[0]) : DEFAULT_SPECIES;
    }
    return initSpecies;
  });
  const [reversible, setReversible] = useState(initReversible);
  const [Keq_custom, setKeq_custom] = useState(existing?.Keq_custom ?? 4.0);

  const [eqText, setEqText] = useState(initText);
  const [eqError, setEqError] = useState<string | null>(null);
  const [parsedSteps, setParsedSteps] = useState<ParsedReaction[]>(() => parseEquations(initText));
  const [stepRateLaws, setStepRateLaws] = useState<StepRateLaw[]>(() => {
    const initSteps = parseEquations(initText);
    if (initialEqText) {
      const kValues = [storeParams.k, storeParams.k2, storeParams.k3, storeParams.k4];
      return initSteps.map((step, i) => ({
        rateType: 'power-law' as RateType,
        rateParams: {
          k: kValues[i] ?? storeParams.k,
          Ea: storeParams.Ea,
          T_ref: storeParams.T_ref,
          ...Object.fromEntries(step.reactants.map((t) => [`n_${t.species}`, 1])),
        },
      }));
    }
    const step0 = existing
      ? { rateType: existing.rateType, rateParams: existing.rateParams }
      : defaultRateLaw();
    return [step0, ...initSteps.slice(1).map(() => defaultRateLaw())];
  });
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({ 0: true });
  const textDrivenRef = useRef(false);

  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(loadPresets);
  const [presetName, setPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  // species library bindings: CustomSpecies.id → speciesLibrary entry id
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState<Record<string, string>>({});
  const [openSearch, setOpenSearch] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Debounced textarea → parse → species
  useEffect(() => {
    if (!eqText.trim()) { setEqError(null); return; }
    const timer = setTimeout(() => {
      const steps = parseEquations(eqText);
      if (steps.length === 0) {
        setEqError('Could not parse any reactions');
        return;
      }
      setEqError(null);
      setParsedSteps(steps);
      textDrivenRef.current = true;
      setSpecies(parsedToSpecies(steps[0]));
      if (steps[0].reversible) setReversible(true);
      setStepRateLaws((prev) => {
        const updated = steps.map((_, i) => prev[i] ?? defaultRateLaw());
        return updated;
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [eqText]);

  // Species table edits → update textarea
  useEffect(() => {
    if (textDrivenRef.current) { textDrivenRef.current = false; return; }
    const newText = formatEqText(species, reversible);
    if (newText) setEqText(newText);
  }, [species, reversible]);

  // n_X order keys sync for step 0 power-law
  useEffect(() => {
    if (stepRateLaws[0]?.rateType !== 'power-law') return;
    setStepRateLaws((prev) => {
      if (!prev[0]) return prev;
      const updated = { ...prev[0].rateParams };
      const reactantLabels = new Set(species.filter((s) => s.role === 'reactant').map((s) => s.label));
      Object.keys(updated).forEach((key) => {
        if (key.startsWith('n_') && !reactantLabels.has(key.slice(2))) delete updated[key];
      });
      reactantLabels.forEach((label) => {
        if (!(`n_${label}` in updated)) updated[`n_${label}`] = 1;
      });
      const next = [...prev];
      next[0] = { ...next[0], rateParams: updated };
      return next;
    });
  }, [species, stepRateLaws[0]?.rateType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up stale bindings when species are removed
  useEffect(() => {
    const ids = new Set(species.map((s) => s.id));
    setBindings((prev) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) if (ids.has(k)) next[k] = v;
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
    setSearchQuery((prev) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) if (ids.has(k)) next[k] = v;
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
    setBannerDismissed(false);
  }, [species]);

  const updateStepRateLaw = (i: number, patch: Partial<StepRateLaw>) => {
    setStepRateLaws((prev) => {
      const next = [...prev];
      if (patch.rateType && patch.rateType !== prev[i].rateType) {
        const def: Record<string, number> = {};
        RATE_TYPES.find((r) => r.value === patch.rateType)!.params.forEach((p) => { def[p.key] = p.default; });
        next[i] = { rateType: patch.rateType, rateParams: def };
      } else {
        next[i] = { ...prev[i], ...patch };
      }
      return next;
    });
  };

  // Derived: species library search and thermo
  const allLibIds = useMemo(() => allSpeciesIds(), []);

  const filterLib = useMemo(
    () =>
      (query: string): SpeciesLibraryEntry[] => {
        const q = query.toLowerCase().trim();
        if (q.length < 1) return [];
        const out: SpeciesLibraryEntry[] = [];
        for (const id of allLibIds) {
          const s = getSpecies(id)!;
          if (
            s.id.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            s.formula.toLowerCase().includes(q)
          ) {
            out.push(s);
            if (out.length >= 6) break;
          }
        }
        return out;
      },
    [allLibIds],
  );

  const stoichForLib = useMemo((): Record<string, number> | null => {
    if (species.length === 0) return null;
    const result: Record<string, number> = {};
    for (const sp of species) {
      const libId = bindings[sp.id];
      if (!libId) return null;
      const nu = sp.role === 'reactant' ? -sp.stoich : sp.stoich;
      result[libId] = (result[libId] ?? 0) + nu;
    }
    return result;
  }, [species, bindings]);

  const thermoBanner = useMemo((): { dH: number; Keq: number; T: number } | null => {
    if (!stoichForLib) return null;
    try {
      const T = storeParams.T_ref ?? 300;
      return {
        dH: deltaHrxn(stoichForLib, 298.15) / 1000,
        Keq: keqFromThermo(stoichForLib, T),
        T,
      };
    } catch { return null; }
  }, [stoichForLib]); // eslint-disable-line react-hooks/exhaustive-deps

  const rateLaw0 = stepRateLaws[0] ?? defaultRateLaw();
  const error = validate(species);

  const addSpecies = (role: 'reactant' | 'product') => {
    const usedLabels = new Set(species.map((s) => s.label));
    const seq = role === 'reactant' ? ['A', 'B', 'C', 'D', 'E', 'F'] : ['R', 'S', 'T', 'U', 'P', 'Q'];
    let label = seq.find((l) => !usedLabels.has(l));
    if (!label) { const base = role === 'reactant' ? 'A' : 'R'; let n = 2; while (usedLabels.has(`${base}${n}`)) n++; label = `${base}${n}`; }
    setSpecies((prev) => [...prev, { id: nextId(), label, role, stoich: 1 }]);
  };
  const updateSpecies = (id: string, patch: Partial<CustomSpecies>) =>
    setSpecies((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
  const removeSpecies = (id: string) =>
    setSpecies((prev) => prev.filter((s) => s.id !== id));

  const handleSave = () => {
    if (error) return;
    const label = initialEqText ? `Based on ${parsedSteps.length} reaction${parsedSteps.length > 1 ? 's' : ''}` : undefined;
    const cr: CustomReaction = { species, rateType: rateLaw0.rateType, rateParams: rateLaw0.rateParams, reversible, Keq_custom: reversible ? Keq_custom : undefined, label };
    updateParams({ customReaction: cr, reactionMode: 'custom' });
    onClose();
  };

  const handleSavePreset = () => {
    if (!presetName.trim() || error) return;
    const cr: CustomReaction = { species, rateType: rateLaw0.rateType, rateParams: rateLaw0.rateParams, reversible, Keq_custom: reversible ? Keq_custom : undefined };
    const updated = [{ name: presetName.trim(), reaction: cr }, ...savedPresets.filter((p) => p.name !== presetName.trim())].slice(0, MAX_PRESETS);
    savePresetsToStorage(updated); setSavedPresets(updated); setPresetName(''); setShowSaveInput(false);
  };

  const handleLoadPreset = (preset: SavedPreset) => {
    setSpecies(preset.reaction.species);
    updateStepRateLaw(0, { rateType: preset.reaction.rateType, rateParams: preset.reaction.rateParams });
    setReversible(preset.reaction.reversible ?? false);
    setKeq_custom(preset.reaction.Keq_custom ?? 4.0);
  };
  const handleDeletePreset = (name: string) => {
    const updated = savedPresets.filter((p) => p.name !== name);
    savePresetsToStorage(updated); setSavedPresets(updated);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.24)', width: 480, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Reaction Builder</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Define species, stoichiometry, and rate law</div>
          </div>
          <button onClick={onClose} style={{ fontSize: 16, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* My Presets */}
          {savedPresets.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>My Presets</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {savedPresets.map((p) => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 6px 2px 8px' }}>
                    <button onClick={() => handleLoadPreset(p)} style={{ fontSize: 10, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>{p.name}</button>
                    <button onClick={() => handleDeletePreset(p.name)} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Equation input */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              Equation Input
            </div>
            <textarea
              value={eqText}
              onChange={(e) => setEqText(e.target.value)}
              placeholder={'A -> R\nA -> R -> S  (chain)\nA + B -> R, A -> S  (comma)'}
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', fontSize: 11, fontFamily: 'monospace',
                padding: '6px 8px', borderRadius: 5, resize: 'vertical',
                border: `1px solid ${eqError ? '#fca5a5' : '#dde3f0'}`,
                background: 'var(--surface-raised)', color: 'var(--text-primary)', outline: 'none',
                lineHeight: 1.6,
              }}
            />
            {eqError ? (
              <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 4, background: '#fef2f2', border: '1px solid #fca5a5', fontSize: 10, color: '#dc2626' }}>
                {eqError}
              </div>
            ) : parsedSteps.length > 0 ? (
              <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 4, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 10, color: '#15803d' }}>
                ✓ {parsedSteps.length} reaction{parsedSteps.length > 1 ? 's' : ''} parsed
              </div>
            ) : null}
          </div>

          {/* Per-step rate law accordions */}
          {parsedSteps.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Rate Laws</div>
              {parsedSteps.map((step, i) => {
                const rl = stepRateLaws[i] ?? defaultRateLaw();
                const rateDef = RATE_TYPES.find((r) => r.value === rl.rateType)!;
                const stepReactants = step.reactants.map((t) => t.species);
                const isOpen = openSteps[i] ?? false;
                return (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                    <button
                      onClick={() => setOpenSteps((prev) => ({ ...prev, [i]: !prev[i] }))}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: isOpen ? '#f8faff' : 'var(--surface)', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#2563eb', background: '#dbeafe', borderRadius: 10, padding: '1px 6px', flexShrink: 0 }}>Step {i + 1}</span>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)', flexGrow: 1 }}>{step.raw}</span>
                      <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                        <path d="M1 1L4 4L7 1" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div style={{ padding: '8px 10px', background: '#f8faff', borderTop: '1px solid var(--border)' }}>
                        {/* Rate law radio buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                          {RATE_TYPES.map((rt) => (
                            <label key={rt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer' }}>
                              <input type="radio" name={`rateType-${i}`} checked={rl.rateType === rt.value} onChange={() => updateStepRateLaw(i, { rateType: rt.value })} style={{ marginTop: 2 }} />
                              <span style={{ fontSize: 10, color: rl.rateType === rt.value ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'monospace' }}>{rt.label}</span>
                            </label>
                          ))}
                        </div>
                        {/* Rate params */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {rateDef.params.map((p) => (
                            <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.label}</span>
                              <input type="number" step={0.01}
                                value={rl.rateParams[p.key] ?? p.default}
                                onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateStepRateLaw(i, { rateParams: { ...rl.rateParams, [p.key]: v } }); }}
                                style={{ width: 60, fontSize: 10, background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 5px', color: 'var(--text-primary)', outline: 'none' }}
                              />
                            </div>
                          ))}
                          {rl.rateType === 'power-law' && stepReactants.map((label) => (
                            <div key={`n_${label}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>n_{label}</span>
                              <input type="number" step={0.1} min={0}
                                value={rl.rateParams[`n_${label}`] ?? 1}
                                onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateStepRateLaw(i, { rateParams: { ...rl.rateParams, [`n_${label}`]: v } }); }}
                                style={{ width: 48, fontSize: 10, background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 5px', color: 'var(--text-primary)', outline: 'none' }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Species editor (secondary) */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Species</div>
            <div style={{ fontSize: 10, color: 'var(--surface)', background: '#f0fdf4', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', marginBottom: 6 }}>
              <span style={{ color: '#15803d' }}>Secondary input — edits Step 1 stoichiometry</span>
            </div>

            {/* Equation preview */}
            <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 12px', textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: '0.04em', marginBottom: 6 }}>
              {formatEquation(species, reversible)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {species.map((sp) => {
                const boundEntry = bindings[sp.id] ? getSpecies(bindings[sp.id]) : undefined;
                const query = searchQuery[sp.id] ?? '';
                const hits = openSearch === sp.id ? filterLib(query) : [];
                return (
                  <div key={sp.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <input value={sp.label} maxLength={3}
                        onChange={(e) => updateSpecies(sp.id, { label: e.target.value.toUpperCase() })}
                        style={{ width: 40, fontSize: 12, fontWeight: 600, textAlign: 'center', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 5px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'monospace', flexShrink: 0 }}
                      />
                      {/* Type-ahead library binding */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        {boundEntry ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 4, padding: '2px 5px' }}>
                            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'monospace', color: '#15803d' }}>{boundEntry.id}</span>
                            <span style={{ fontSize: 9, color: '#6b7280' }}>·{boundEntry.mw}g</span>
                            <span style={{ fontSize: 9, color: '#6b7280' }}>·{boundEntry.dHf298}kJ</span>
                            <button
                              onClick={() => { setBindings((p) => { const n = { ...p }; delete n[sp.id]; return n; }); setBannerDismissed(false); }}
                              style={{ fontSize: 10, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px', lineHeight: 1 }}>×</button>
                          </div>
                        ) : (
                          <input
                            value={query}
                            onChange={(e) => { setSearchQuery((p) => ({ ...p, [sp.id]: e.target.value })); setOpenSearch(sp.id); }}
                            onFocus={() => setOpenSearch(sp.id)}
                            onBlur={() => setTimeout(() => setOpenSearch(null), 160)}
                            placeholder="bind…"
                            style={{ width: 64, fontSize: 10, padding: '3px 5px', borderRadius: 4, background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)', outline: 'none' }}
                          />
                        )}
                        {hits.length > 0 && (
                          <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 2, zIndex: 500, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.14)', minWidth: 210 }}>
                            {hits.map((h, hi) => (
                              <button key={h.id}
                                onMouseDown={() => { setBindings((p) => ({ ...p, [sp.id]: h.id })); setSearchQuery((p) => ({ ...p, [sp.id]: '' })); setOpenSearch(null); setBannerDismissed(false); }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 10px', border: 'none', borderBottom: hi < hits.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: 'none', cursor: 'pointer' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: '#2563eb' }}>{h.id}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 5 }}>{h.name}</span>
                                <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4 }}>({h.formula})</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <select value={sp.role} onChange={(e) => updateSpecies(sp.id, { role: e.target.value as 'reactant' | 'product' })}
                        style={{ fontSize: 11, background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 5px', color: 'var(--text-primary)', outline: 'none' }}>
                        <option value="reactant">Reactant</option>
                        <option value="product">Product</option>
                      </select>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>stoich</span>
                      <input type="number" min={0.01} step={0.5} value={sp.stoich}
                        onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) updateSpecies(sp.id, { stoich: v }); }}
                        style={{ width: 50, fontSize: 11, textAlign: 'right', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 5px', color: 'var(--text-primary)', outline: 'none' }}
                      />
                      <button onClick={() => removeSpecies(sp.id)} disabled={species.length <= 2}
                        style={{ fontSize: 13, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', opacity: species.length <= 2 ? 0.3 : 1 }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={() => addSpecies('reactant')} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface-raised)', color: 'var(--text-muted)', cursor: 'pointer' }}>+ Reactant</button>
              <button onClick={() => addSpecies('product')} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface-raised)', color: 'var(--text-muted)', cursor: 'pointer' }}>+ Product</button>
            </div>

            {/* Reversible toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={reversible} onChange={(e) => setReversible(e.target.checked)} />
                <span style={{ fontSize: 11, color: reversible ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: reversible ? 600 : 400 }}>⇌ Make reversible</span>
              </label>
              {reversible && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>Keq</span>
                  <input type="number" min={0.01} max={1000} step={0.1} value={Keq_custom}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setKeq_custom(Math.min(1000, v)); }}
                    style={{ width: 72, fontSize: 11, background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Thermo banner — shows when all species are bound to library */}
          {thermoBanner && !bannerDismissed && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: '#15803d', fontWeight: 700, marginBottom: 4 }}>Library thermodynamics (computed)</div>
              <div style={{ fontSize: 11, color: '#166534', fontFamily: 'monospace', marginBottom: 6 }}>
                ΔH_rxn = {thermoBanner.dH >= 0 ? '+' : ''}{thermoBanner.dH.toFixed(1)} kJ/mol
                {' · '}
                Keq({Math.round(thermoBanner.T)}K) = {
                  thermoBanner.Keq >= 1e4
                    ? thermoBanner.Keq.toExponential(2)
                    : thermoBanner.Keq >= 0.001
                      ? thermoBanner.Keq.toFixed(3)
                      : thermoBanner.Keq.toExponential(2)
                }
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => { updateParams({ delta_H: thermoBanner.dH }); setBannerDismissed(true); }}
                  style={{ fontSize: 10, padding: '3px 10px', borderRadius: 4, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  Use computed
                </button>
                <button
                  onClick={() => setBannerDismissed(true)}
                  style={{ fontSize: 10, padding: '3px 10px', borderRadius: 4, border: '1px solid #86efac', background: 'none', color: '#15803d', cursor: 'pointer' }}>
                  Keep manual
                </button>
              </div>
            </div>
          )}

          {/* Save as preset */}
          {showSaveInput ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input autoFocus placeholder="Preset name…" value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') setShowSaveInput(false); }}
                maxLength={30}
                style={{ flex: 1, fontSize: 11, padding: '4px 8px', borderRadius: 4, background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
              />
              <button onClick={handleSavePreset} disabled={!presetName.trim() || !!error || savedPresets.length >= MAX_PRESETS}
                style={{ fontSize: 10, padding: '4px 10px', borderRadius: 4, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: (!presetName.trim() || !!error) ? 0.5 : 1 }}>
                Save
              </button>
              <button onClick={() => setShowSaveInput(false)}
                style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface-raised)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setShowSaveInput(true)} disabled={!!error || savedPresets.length >= MAX_PRESETS}
              style={{ alignSelf: 'flex-start', fontSize: 10, padding: '3px 10px', borderRadius: 4, border: '1px solid #7c3aed', background: '#f5f3ff', color: '#7c3aed', cursor: !!error ? 'not-allowed' : 'pointer', opacity: !!error ? 0.5 : 1, fontWeight: 600 }}>
              {savedPresets.length >= MAX_PRESETS ? 'Presets full (10 max)' : '+ Save as preset'}
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {error ? (
            <span style={{ fontSize: 11, color: '#dc2626' }}>{error}</span>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Equation looks good ✓</span>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ fontSize: 11, padding: '5px 14px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface-raised)', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={!!error}
              style={{ fontSize: 11, padding: '5px 14px', borderRadius: 5, border: 'none', background: error ? '#94a3b8' : '#2563eb', color: '#fff', fontWeight: 600, cursor: error ? 'not-allowed' : 'pointer' }}>
              Save Reaction
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
