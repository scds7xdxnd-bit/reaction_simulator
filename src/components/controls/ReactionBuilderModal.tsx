import { useState, useEffect } from 'react';
import type { CustomSpecies, CustomReaction, RateType } from '../../types/simulation';
import { useSimulatorStore } from '../../store/simulatorStore';
import { formatEquation } from '../../math/formatEquation';

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

export default function ReactionBuilderModal({ onClose }: { onClose: () => void }) {
  const existing = useSimulatorStore((s) => s.params.customReaction);
  const updateParams = useSimulatorStore((s) => s.updateParams);

  const [species, setSpecies] = useState<CustomSpecies[]>(
    existing?.species ?? DEFAULT_SPECIES
  );
  const [rateType, setRateType] = useState<RateType>(existing?.rateType ?? 'power-law');
  const [rateParams, setRateParams] = useState<Record<string, number>>(() => {
    if (existing?.rateParams) return existing.rateParams;
    const def: Record<string, number> = {};
    RATE_TYPES[0].params.forEach((p) => { def[p.key] = p.default; });
    return def;
  });

  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(loadPresets);
  const [presetName, setPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  // Sync n_[label] order keys in rateParams when species or rateType changes
  useEffect(() => {
    if (rateType !== 'power-law') return;
    setRateParams((prev) => {
      const updated = { ...prev };
      const reactantLabels = new Set(
        species.filter((s) => s.role === 'reactant').map((s) => s.label)
      );
      Object.keys(updated).forEach((key) => {
        if (key.startsWith('n_') && !reactantLabels.has(key.slice(2))) delete updated[key];
      });
      reactantLabels.forEach((label) => {
        if (!(`n_${label}` in updated)) updated[`n_${label}`] = 1;
      });
      return updated;
    });
  }, [species, rateType]);

  const rateDef = RATE_TYPES.find((r) => r.value === rateType)!;
  const error = validate(species);

  const handleRateTypeChange = (rt: RateType) => {
    setRateType(rt);
    const def: Record<string, number> = {};
    RATE_TYPES.find((r) => r.value === rt)!.params.forEach((p) => { def[p.key] = p.default; });
    setRateParams(def);
  };

  const addSpecies = (role: 'reactant' | 'product') => {
    const usedLabels = new Set(species.map((s) => s.label));
    const seq = role === 'reactant'
      ? ['A', 'B', 'C', 'D', 'E', 'F']
      : ['R', 'S', 'T', 'U', 'P', 'Q'];
    let label = seq.find((l) => !usedLabels.has(l));
    if (!label) {
      const base = role === 'reactant' ? 'A' : 'R';
      let n = 2;
      while (usedLabels.has(`${base}${n}`)) n++;
      label = `${base}${n}`;
    }
    setSpecies((prev) => [...prev, { id: nextId(), label, role, stoich: 1 }]);
  };

  const updateSpecies = (id: string, patch: Partial<CustomSpecies>) => {
    setSpecies((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
  };

  const removeSpecies = (id: string) => {
    setSpecies((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSave = () => {
    if (error) return;
    const cr: CustomReaction = { species, rateType, rateParams };
    updateParams({ customReaction: cr, reactionMode: 'custom' });
    onClose();
  };

  const handleSavePreset = () => {
    if (!presetName.trim() || error) return;
    const cr: CustomReaction = { species, rateType, rateParams };
    const updated = [
      { name: presetName.trim(), reaction: cr },
      ...savedPresets.filter((p) => p.name !== presetName.trim()),
    ].slice(0, MAX_PRESETS);
    savePresetsToStorage(updated);
    setSavedPresets(updated);
    setPresetName('');
    setShowSaveInput(false);
  };

  const handleLoadPreset = (preset: SavedPreset) => {
    setSpecies(preset.reaction.species);
    setRateType(preset.reaction.rateType);
    setRateParams(preset.reaction.rateParams);
  };

  const handleDeletePreset = (name: string) => {
    const updated = savedPresets.filter((p) => p.name !== name);
    savePresetsToStorage(updated);
    setSavedPresets(updated);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
        boxShadow: '0 16px 48px rgba(0,0,0,0.24)', width: 480, maxHeight: '85vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
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
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                My Presets
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {savedPresets.map((p) => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 2,
                    background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 6px 2px 8px' }}>
                    <button
                      onClick={() => handleLoadPreset(p)}
                      style={{ fontSize: 10, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                      {p.name}
                    </button>
                    <button
                      onClick={() => handleDeletePreset(p.name)}
                      style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Equation preview */}
          <div style={{
            background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)',
            borderRadius: 6, padding: '8px 12px', textAlign: 'center',
            fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace',
            letterSpacing: '0.04em',
          }}>
            {formatEquation(species)}
          </div>

          {/* Species editor */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              Species
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {species.map((sp) => (
                <div key={sp.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    value={sp.label}
                    maxLength={3}
                    onChange={(e) => updateSpecies(sp.id, { label: e.target.value.toUpperCase() })}
                    style={{
                      width: 44, fontSize: 12, fontWeight: 600, textAlign: 'center',
                      background: 'var(--surface-raised)', border: '1px solid var(--border)',
                      borderRadius: 4, padding: '3px 6px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'monospace',
                    }}
                  />
                  <select
                    value={sp.role}
                    onChange={(e) => updateSpecies(sp.id, { role: e.target.value as 'reactant' | 'product' })}
                    style={{ fontSize: 11, background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="reactant">Reactant</option>
                    <option value="product">Product</option>
                  </select>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>stoich</span>
                  <input
                    type="number"
                    min={0.01} step={0.5}
                    value={sp.stoich}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v > 0) updateSpecies(sp.id, { stoich: v });
                    }}
                    style={{
                      width: 52, fontSize: 11, textAlign: 'right',
                      background: 'var(--surface-raised)', border: '1px solid var(--border)',
                      borderRadius: 4, padding: '3px 6px', color: 'var(--text-primary)', outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => removeSpecies(sp.id)}
                    disabled={species.length <= 2}
                    style={{ fontSize: 13, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', opacity: species.length <= 2 ? 0.3 : 1 }}
                  >✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={() => addSpecies('reactant')}
                style={{ fontSize: 10, padding: '3px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface-raised)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                + Reactant
              </button>
              <button onClick={() => addSpecies('product')}
                style={{ fontSize: 10, padding: '3px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface-raised)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                + Product
              </button>
            </div>
          </div>

          {/* Rate type */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              Rate Law
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {RATE_TYPES.map((rt) => (
                <label key={rt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="rateType"
                    checked={rateType === rt.value}
                    onChange={() => handleRateTypeChange(rt.value)}
                    style={{ marginTop: 2 }}
                  />
                  <span style={{ fontSize: 11, color: rateType === rt.value ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {rt.label}
                  </span>
                </label>
              ))}
            </div>

            {/* Rate params */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
              {rateDef.params.map((p) => (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.label}</span>
                  <input
                    type="number"
                    step={0.01}
                    value={rateParams[p.key] ?? p.default}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) setRateParams((prev) => ({ ...prev, [p.key]: v }));
                    }}
                    style={{
                      width: 64, fontSize: 11,
                      background: 'var(--surface-raised)', border: '1px solid var(--border)',
                      borderRadius: 4, padding: '3px 6px', color: 'var(--text-primary)', outline: 'none',
                    }}
                  />
                </div>
              ))}
              {rateType === 'power-law' && species.filter((s) => s.role === 'reactant').map((sp) => (
                <div key={`n_${sp.label}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>n_{sp.label} (order)</span>
                  <input
                    type="number" step={0.1} min={0}
                    value={rateParams[`n_${sp.label}`] ?? 1}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) setRateParams((prev) => ({ ...prev, [`n_${sp.label}`]: v }));
                    }}
                    style={{
                      width: 64, fontSize: 11,
                      background: 'var(--surface-raised)', border: '1px solid var(--border)',
                      borderRadius: 4, padding: '3px 6px', color: 'var(--text-primary)', outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Save as preset */}
          {showSaveInput ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                autoFocus
                placeholder="Preset name…"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') setShowSaveInput(false); }}
                maxLength={30}
                style={{
                  flex: 1, fontSize: 11, padding: '4px 8px', borderRadius: 4,
                  background: 'var(--surface-raised)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', outline: 'none',
                }}
              />
              <button
                onClick={handleSavePreset}
                disabled={!presetName.trim() || !!error || savedPresets.length >= MAX_PRESETS}
                style={{ fontSize: 10, padding: '4px 10px', borderRadius: 4, border: 'none',
                  background: '#7c3aed', color: '#fff', fontWeight: 600, cursor: 'pointer',
                  opacity: (!presetName.trim() || !!error) ? 0.5 : 1 }}>
                Save
              </button>
              <button
                onClick={() => setShowSaveInput(false)}
                style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--surface-raised)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSaveInput(true)}
              disabled={!!error || savedPresets.length >= MAX_PRESETS}
              style={{ alignSelf: 'flex-start', fontSize: 10, padding: '3px 10px', borderRadius: 4,
                border: '1px solid #7c3aed', background: '#f5f3ff', color: '#7c3aed',
                cursor: !!error ? 'not-allowed' : 'pointer', opacity: !!error ? 0.5 : 1,
                fontWeight: 600 }}>
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
            <button onClick={onClose} style={{ fontSize: 11, padding: '5px 14px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface-raised)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!!error}
              style={{ fontSize: 11, padding: '5px 14px', borderRadius: 5, border: 'none', background: error ? '#94a3b8' : '#2563eb', color: '#fff', fontWeight: 600, cursor: error ? 'not-allowed' : 'pointer' }}
            >
              Save Reaction
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
