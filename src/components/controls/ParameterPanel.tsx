import { useState, useRef, useEffect, lazy, Suspense } from 'react';
const ReactionBuilderModal = lazy(() => import('./ReactionBuilderModal'));
import { useSimulatorStore } from '../../store/simulatorStore';
import type { ReactionMode } from '../../types/simulation';
import { PRESETS, getPreset } from '../../math/reactionRegistry';
import { formatEquation } from '../../math/formatEquation';

const kineticsOptions = PRESETS
  .filter((p) => p.kinetics != null)
  .map((p) => ({ value: p.kinetics!, label: p.uiLabel }));

const modeOptions: { value: ReactionMode; label: string }[] = [
  { value: 'single',   label: 'Single' },
  { value: 'series',   label: 'Series A→R→S' },
  { value: 'series3',         label: 'A→R→S→T' },
  { value: 'series-parallel', label: 'A+B→R+B→S' },
  { value: 'denbigh',         label: 'Denbigh' },
  { value: 'parallel',        label: 'Parallel A→R/A→S' },
  { value: 'custom',   label: 'Custom…' },
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


export default function ParameterPanel() {
  const params = useSimulatorStore((s) => s.params);
  const updateParams = useSimulatorStore((s) => s.updateParams);
  const [showBuilder, setShowBuilder] = useState(false);

  const preset = getPreset(params);
  const isSingle = preset.isSingle;

  const modeAccent = params.reactionMode === 'series'   ? '#0d9488'
                   : params.reactionMode === 'series3'  ? '#0d9488'
                   : params.reactionMode === 'parallel' ? '#7c3aed'
                   : '#2563eb';

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

        {isSingle && params.reactionMode !== 'custom' && (
          <HoverDropdown
            label="Kinetics"
            options={kineticsOptions}
            value={params.kinetics}
            onChange={(v) => updateParams({ kinetics: v })}
            minWidth={148}
          />
        )}

        {params.reactionMode === 'custom' && params.customReaction && (
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#7c3aed',
                         flexShrink: 0, fontWeight: 500 }}>
            {formatEquation(params.customReaction.species)}
          </span>
        )}

        {params.reactionMode === 'custom' && (
          <button
            onClick={() => setShowBuilder(true)}
            style={{
              fontSize: 10, padding: '3px 10px', borderRadius: 4, flexShrink: 0,
              border: '1px solid #7c3aed', background: '#f5f3ff', color: '#7c3aed',
              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Edit Reaction…
          </button>
        )}

      </div>

      {showBuilder && (
        <Suspense fallback={null}>
          <ReactionBuilderModal onClose={() => setShowBuilder(false)} />
        </Suspense>
      )}
    </div>
  );
}
