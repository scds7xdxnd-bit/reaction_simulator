import { useState, useRef, useEffect, lazy, Suspense } from 'react';
const ReactionBuilderModal = lazy(() => import('./ReactionBuilderModal'));
import { useSimulatorStore } from '../../store/simulatorStore';
import type { ReactionMode } from '../../types/simulation';
import { PRESETS, getPreset } from '../../math/reactionRegistry';
import { formatEquation } from '../../math/formatEquation';
import { Input } from '../ui';

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


function ParamRow({ label, unit, children }: { label: string; unit: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace', width: 72, flexShrink: 0 }}>{label}</span>
      {children}
      {unit && <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>{unit}</span>}
    </div>
  );
}

export default function ParameterPanel() {
  const params = useSimulatorStore((s) => s.params);
  const updateParams = useSimulatorStore((s) => s.updateParams);
  const paramsOpen = useSimulatorStore((s) => s.paramsOpen);
  const [showBuilder, setShowBuilder] = useState(false);

  const preset = getPreset(params);
  const isSingle = preset.isSingle;
  const kUnit = preset.kUnit ?? 's⁻¹';

  const kLabel = isSingle ? 'k₁' : 'k₁';

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

      {/* ── Numeric params body — shown only when paramsOpen ── */}
      {paramsOpen && <div style={{ padding: '8px 16px 10px', display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 320 }}>

        {/* Feed Conditions */}
        <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Feed Conditions</div>
        <ParamRow label="Cₐ₀" unit="mol/L">
          <Input type="number" min="0.1" max="100" step="0.1" value={params.Ca0}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateParams({ Ca0: Math.max(0.1, Math.min(100, v)) }); }}
            className="w-20" />
        </ParamRow>
        {params.reactionMode === 'series-parallel' && (
          <ParamRow label="C_B₀" unit="mol/L">
            <Input type="number" min="0.1" max="100" step="0.1" value={params.Cb0}
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateParams({ Cb0: Math.max(0.1, Math.min(100, v)) }); }}
              className="w-20" />
          </ParamRow>
        )}
        <ParamRow label="T feed" unit="K">
          <Input type="number" min="200" max="600" step="1" value={params.T_feed}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateParams({ T_feed: Math.max(200, Math.min(600, v)) }); }}
            className="w-20" />
        </ParamRow>

        <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 2, marginBottom: 2 }} />

        {/* Kinetics */}
        <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Kinetics</div>
        <ParamRow label={kLabel} unit={kUnit}>
          <Input type="number" min="0.01" max="10" step="0.01" value={params.k}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateParams({ k: Math.max(0.01, Math.min(10, v)) }); }}
            className="w-20" />
        </ParamRow>
        {params.reactionMode !== 'single' && (
          <ParamRow label="k₂" unit={kUnit}>
            <Input type="number" min="0.01" max="10" step="0.01" value={params.k2}
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateParams({ k2: Math.max(0.01, Math.min(10, v)) }); }}
              className="w-20" />
          </ParamRow>
        )}
        {(params.reactionMode === 'series3' || params.reactionMode === 'denbigh') && (
          <ParamRow label="k₃" unit={kUnit}>
            <Input type="number" min="0.01" max="10" step="0.01" value={params.k3}
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateParams({ k3: Math.max(0.01, Math.min(10, v)) }); }}
              className="w-20" />
          </ParamRow>
        )}
        {params.reactionMode === 'denbigh' && (
          <ParamRow label="k₄" unit={kUnit}>
            <Input type="number" min="0.01" max="10" step="0.01" value={params.k4}
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateParams({ k4: Math.max(0.01, Math.min(10, v)) }); }}
              className="w-20" />
          </ParamRow>
        )}
        {params.kinetics === 'reversible' && (
          <ParamRow label="Keq_ref" unit="">
            <Input type="number" min="0.01" max="1000" step="0.01" value={params.Keq_ref}
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateParams({ Keq_ref: Math.max(0.01, Math.min(1000, v)) }); }}
              className="w-20" />
          </ParamRow>
        )}
        {params.kinetics === 'autocatalytic' && (
          <ParamRow label="Cᵣ₀/Cₐ₀" unit="">
            <Input type="number" min="0.001" max="0.5" step="0.001" value={params.Cr0_fraction}
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateParams({ Cr0_fraction: Math.max(0.001, Math.min(0.5, v)) }); }}
              className="w-20" />
          </ParamRow>
        )}
        {params.kinetics === 'gas-phase-1st-order' && (
          <ParamRow label="ε" unit="">
            <Input type="number" min="-0.5" max="2" step="0.01" value={params.epsilon}
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateParams({ epsilon: Math.max(-0.5, Math.min(2, v)) }); }}
              className="w-20" />
          </ParamRow>
        )}

        <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 2, marginBottom: 2 }} />

        {/* Thermodynamics */}
        <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Thermodynamics</div>
        <ParamRow label="Ea" unit="kJ/mol">
          <Input type="number" min="0" max="200" step="1" value={params.Ea}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateParams({ Ea: Math.max(0, Math.min(200, v)) }); }}
            className="w-20" />
        </ParamRow>
        <ParamRow label="ΔH" unit="kJ/mol">
          <Input type="number" min="-200" max="200" step="1" value={params.delta_H}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateParams({ delta_H: Math.max(-200, Math.min(200, v)) }); }}
            className="w-20" />
        </ParamRow>
        <ParamRow label="ρCp" unit="kJ/(L·K)">
          <Input type="number" min="0.1" max="10" step="0.1" value={params.rho_Cp}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateParams({ rho_Cp: Math.max(0.1, Math.min(10, v)) }); }}
            className="w-20" />
        </ParamRow>
      </div>}

      {showBuilder && (
        <Suspense fallback={null}>
          <ReactionBuilderModal onClose={() => setShowBuilder(false)} />
        </Suspense>
      )}
    </div>
  );
}
