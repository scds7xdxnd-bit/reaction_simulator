import { useState, useEffect, useRef } from 'react';
import { useSimulatorStore } from '../../store/simulatorStore';
import { getPreset } from '../../math/reactionRegistry';
import { Input } from '../ui';
import { PARAM_SECTIONS } from '../../schema/parameterSchema';
import type { ParamFieldDef } from '../../schema/parameterSchema';
import ReactionModeCards from './ReactionModeCards';

const STORAGE_KEY = 'rsi-param-sections';
function loadSectionState(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; }
}
function saveSectionState(state: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function ParameterPopover() {
  const paramsOpen  = useSimulatorStore((s) => s.paramsOpen);
  const setParamsOpen = useSimulatorStore((s) => s.setParamsOpen);
  const params      = useSimulatorStore((s) => s.params);
  const updateParams = useSimulatorStore((s) => s.updateParams);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(loadSectionState);
  const panelRef = useRef<HTMLDivElement>(null);

  const preset  = getPreset(params);
  const isSingle = preset.isSingle;

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveSectionState(next);
      return next;
    });
  };

  function isFieldVisible(field: ParamFieldDef): boolean {
    switch (field.key) {
      case 'Cb0':          return params.reactionMode === 'series-parallel';
      case 'epsilon':      return isSingle && params.kinetics === 'gas-phase-1st-order';
      case 'Cr0_fraction': return isSingle && params.kinetics === 'autocatalytic';
      case 'k2':           return !isSingle;
      case 'k3':           return params.reactionMode === 'series3' || params.reactionMode === 'denbigh';
      case 'k4':           return params.reactionMode === 'denbigh';
      case 'Keq_ref':      return isSingle && params.kinetics === 'reversible';
      default:             return true;
    }
  }

  useEffect(() => {
    if (!paramsOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (panelRef.current?.contains(target)) return;
      if (target.closest('[data-params-trigger]')) return;
      setParamsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [paramsOpen, setParamsOpen]);

  if (!paramsOpen) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: 76,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 340,
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
        zIndex: 200,
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px 6px',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Parameters
        </span>
        <button
          onClick={() => setParamsOpen(false)}
          style={{ fontSize: 14, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      <div>
        <div
          onClick={() => toggleSection('reaction')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            borderTop: '1px solid var(--border)',
            background: openSections['reaction'] ? '#faf5ff' : 'var(--surface)',
            padding: '5px 12px',
          }}
        >
          <span style={{ width: 3, height: 14, background: '#7c3aed', borderRadius: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Reaction
          </span>
          <svg width="8" height="5" viewBox="0 0 8 5" fill="none"
            style={{ marginLeft: 2, transform: openSections['reaction'] ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M1 1L4 4L7 1" stroke="#7c3aed" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
        {openSections['reaction'] && (
          <div style={{ background: '#faf5ff', borderBottom: '1px solid var(--border)' }}>
            <ReactionModeCards />
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
                borderTop: '1px solid var(--border)',
                background: openSections[sec.id] ? sec.bgColor : 'var(--surface)',
                padding: '5px 12px',
              }}
            >
              <span style={{ width: 3, height: 14, background: sec.color, borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: sec.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {sec.label}
              </span>
              <svg width="8" height="5" viewBox="0 0 8 5" fill="none"
                style={{ marginLeft: 2, transform: openSections[sec.id] ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                <path d="M1 1L4 4L7 1" stroke={sec.color} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            {openSections[sec.id] && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                padding: '6px 12px 8px', background: sec.bgColor,
                borderBottom: '1px solid var(--border)',
              }}>
                {visibleFields.map((field) => (
                  <div key={field.key} className="flex items-center gap-1 shrink-0">
                    <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{field.label}</span>
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
