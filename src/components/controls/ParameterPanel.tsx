import { useState, useRef, useEffect } from 'react';
import { useSimulatorStore } from '../../store/simulatorStore';
import type { ReactionMode } from '../../types/simulation';
import { PRESETS, getPreset } from '../../math/reactionRegistry';
import { Input } from '../ui';
import { PARAM_SECTIONS } from '../../schema/parameterSchema';
import type { ParamFieldDef } from '../../schema/parameterSchema';

const kineticsOptions = PRESETS
  .filter((p) => p.kinetics != null)
  .map((p) => ({ value: p.kinetics!, label: p.uiLabel }));

const modeOptions: { value: ReactionMode; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'series', label: 'Series A→R→S' },
  { value: 'parallel', label: 'Parallel A→R/A→S' },
];

function HoverDropdown<T extends string>({
  label,
  options,
  value,
  onChange,
  minWidth,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const handleEnter = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(true);
  };

  const handleLeave = () => {
    timerRef.current = setTimeout(() => {
      setOpen(false);
    }, 150);
  };

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: rect.width,
        zIndex: 9999,
      });
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div
      className="shrink-0 leading-none"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        ref={buttonRef}
        className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider rounded border border-[#dde3f0] bg-[#ffffff] text-[#0f1730] hover:border-[#2563eb] transition-colors text-left flex items-center justify-between gap-2"
        style={{ minWidth }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
          <span style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8',
                         textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#0f1730', lineHeight: '1.2' }}>
            {selected?.label}
          </span>
        </div>
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
          <path d="M1 1L4 4L7 1" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          style={menuStyle}
          className="bg-[#ffffff] border border-[#dde3f0] rounded-md shadow-lg py-1"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt.value);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#f8faff] transition-colors"
              style={{
                color: opt.value === value ? '#2563eb' : '#374151',
                fontWeight: opt.value === value ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STORAGE_KEY = 'rsi-param-sections';

function loadSectionState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch { return {}; }
}

function saveSectionState(state: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function ParameterPanel() {
  const params = useSimulatorStore((s) => s.params);
  const updateParams = useSimulatorStore((s) => s.updateParams);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(loadSectionState);

  const preset = getPreset(params);
  const isSingle = preset.isSingle;
  const kUnit = preset.kUnit ?? 's⁻¹';

  const kLabel = isSingle ? 'k₁' : 'k₁';

  const modeAccent = params.reactionMode === 'series'   ? '#0d9488'
                   : params.reactionMode === 'parallel' ? '#7c3aed'
                   : '#2563eb';

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveSectionState(next);
      return next;
    });
  };

  function isFieldVisible(field: ParamFieldDef): boolean {
    if (field.key === 'k' || field.key === 'Ca0' || field.key === 'Cr0_fraction') return false;
    switch (field.key) {
      case 'k2': return !isSingle;
      case 'Keq_ref': return isSingle && params.kinetics === 'reversible';
      case 'epsilon': return isSingle && params.kinetics === 'gas-phase-1st-order';
      default: return true;
    }
  }

  return (
    <div
      className="bg-[#ffffff] border-b border-[#dde3f0] flex flex-col"
      style={{ borderLeft: `3px solid ${modeAccent}` }}
    >
      <div className="flex items-center gap-3 px-4 overflow-x-auto" style={{ height: 48 }}>
        <HoverDropdown
          label="Mode"
          options={modeOptions}
          value={params.reactionMode}
          onChange={(v) => updateParams({ reactionMode: v })}
          minWidth={100}
        />

        {isSingle && (
          <HoverDropdown
            label="Kinetics"
            options={kineticsOptions}
            value={params.kinetics}
            onChange={(v) => updateParams({ kinetics: v })}
            minWidth={148}
          />
        )}

        <div style={{ width: 1, height: 24, background: '#e0e6f0', flexShrink: 0 }} />

        <div className="flex items-center gap-1 shrink-0">
          <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{kLabel}</span>
          <Input
            type="number"
            min="0.01"
            max="10"
            step="0.01"
            value={params.k}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) updateParams({ k: Math.max(0.01, Math.min(10, v)) });
            }}
            className="w-14"
          />
          <span style={{ fontSize: 9, color: '#94a3b8' }}>{kUnit}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>Cₐ₀</span>
          <Input
            type="number"
            min="0.1"
            max="100"
            step="0.1"
            value={params.Ca0}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) updateParams({ Ca0: Math.max(0.1, Math.min(100, v)) });
            }}
            className="w-14"
          />
          <span style={{ fontSize: 9, color: '#94a3b8' }}>mol/L</span>
        </div>

        {preset.id === 'single-autocatalytic' && (
          <div className="flex items-center gap-1 shrink-0">
            <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>Cᵣ₀/Cₐ₀</span>
            <Input
              type="number"
              min="0.001"
              max="0.5"
              step="0.001"
              value={params.Cr0_fraction}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) updateParams({ Cr0_fraction: Math.max(0.001, Math.min(0.5, v)) });
              }}
              className="w-14"
            />
          </div>
        )}
      </div>

      {PARAM_SECTIONS.map((sec) => {
        const visibleFields = sec.fields.filter(isFieldVisible);
        if (visibleFields.length === 0) return null;

        return (
          <div key={sec.id}>
            <div
              onClick={() => toggleSection(sec.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                borderTop: '1px solid #e0e6f0',
                background: openSections[sec.id] ? sec.bgColor : 'var(--surface)',
                padding: '4px 16px',
              }}
            >
              <span style={{
                width: 3, height: 14, background: sec.color,
                borderRadius: 2, flexShrink: 0,
              }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: sec.color,
                            textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {sec.label}
              </span>
              <svg width="8" height="5" viewBox="0 0 8 5" fill="none"
                   style={{ marginLeft: 2, transform: openSections[sec.id] ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s' }}>
                <path d="M1 1L4 4L7 1" stroke={sec.color} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            {openSections[sec.id] && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                padding: '6px 16px 8px', background: sec.bgColor,
                borderBottom: '1px solid #e0e6f0',
              }}>
                {visibleFields.map((field) => (
                  <div key={field.key} className="flex items-center gap-1 shrink-0">
                    <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
                      {field.label}
                    </span>
                    <Input
                      type="number"
                      min={String(field.min)} max={String(field.max)} step={String(field.step)}
                      value={params[field.key] as number}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) updateParams({ [field.key]: Math.max(field.min, Math.min(field.max, v)) });
                      }}
                      className="w-14"
                    />
                    <span style={{ fontSize: 9, color: '#94a3b8' }}>{field.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
