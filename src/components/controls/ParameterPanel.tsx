import { useState, useRef, useEffect } from 'react';
import { useSimulatorStore } from '../../store/simulatorStore';
import type { ReactionMode } from '../../types/reactor';
import { PRESETS, getPreset } from '../../math/reactionRegistry';
import { Gauge, X } from 'lucide-react';
import { Input } from '../ui';

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
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
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
        className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider rounded border border-[#dde3f0] bg-[#ffffff] text-[#0f1730] hover:border-[#2563eb] transition-colors min-w-[140px] text-left flex items-center justify-between gap-2"
      >
        <span>
          <span className="text-[#6b7280] mr-1">{label}:</span>
          {selected?.label}
        </span>
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
  const [thermalOpen, setThermalOpen] = useState(false);

  const preset = getPreset(params);
  const isSingle = preset.isSingle;
  const kUnit = preset.kUnit ?? 's⁻¹';

  const kLabel = isSingle ? 'k₁' : 'k₁';

  return (
    <div className="bg-[#ffffff] border-b border-[#dde3f0] flex items-center gap-4 px-4 overflow-x-auto" style={{ minHeight: 60 }}>
      <HoverDropdown
        label="Mode"
        options={modeOptions}
        value={params.reactionMode}
        onChange={(v) => updateParams({ reactionMode: v })}
      />

      {isSingle && (
        <HoverDropdown
          label="Kinetics"
          options={kineticsOptions}
          value={params.kinetics}
          onChange={(v) => updateParams({ kinetics: v })}
        />
      )}

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[11px] text-[#374151] font-mono">{kLabel} =</span>
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
          className="w-16"
        />
        <span className="text-[10px] text-[#6b7280]">{kUnit}</span>
      </div>

      {!isSingle && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-[#374151] font-mono">k₂ =</span>
          <Input
            type="number"
            min="0.01"
            max="10"
            step="0.01"
            value={params.k2}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) updateParams({ k2: Math.max(0.01, Math.min(10, v)) });
            }}
            className="w-16"
          />
          <span className="text-[10px] text-[#6b7280]">s⁻¹</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[11px] text-[#374151] font-mono">Cₐ₀ =</span>
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
          className="w-16"
        />
        <span className="text-[10px] text-[#6b7280]">mol/L</span>
      </div>

      {preset.id === 'single-autocatalytic' && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-[#374151] font-mono">Cᵣ₀/Cₐ₀ =</span>
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
            className="w-16"
          />
        </div>
      )}

      <button
        onClick={() => setThermalOpen(!thermalOpen)}
        className="ml-auto flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[#6b7280] hover:text-[#2563eb] transition-colors shrink-0 px-2 py-1 rounded hover:bg-[#f8faff]"
      >
        {thermalOpen ? <X size={12} /> : <Gauge size={12} />}
        Thermal
      </button>

      {thermalOpen && (
        <div className="flex items-center gap-3 shrink-0 pl-2 pr-1 py-1 border-l border-[#dde3f0]">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#6b7280]">T_feed</span>
            <Input
              type="number"
              min="200"
              max="600"
              step="5"
              value={params.T_feed}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) updateParams({ T_feed: Math.max(200, Math.min(600, v)) });
              }}
              className="w-12"
            />
            <span className="text-[9px] text-[#6b7280]">K</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#6b7280]">Eₐ</span>
            <Input
              type="number"
              min="0"
              max="500"
              step="1"
              value={params.Ea}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) updateParams({ Ea: Math.max(0, Math.min(500, v)) });
              }}
              className="w-12"
            />
            <span className="text-[9px] text-[#6b7280]">kJ/mol</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#6b7280]">ΔH</span>
            <Input
              type="number"
              min="-500"
              max="500"
              step="1"
              value={params.delta_H}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) updateParams({ delta_H: Math.max(-500, Math.min(500, v)) });
              }}
              className="w-12"
            />
            <span className="text-[9px] text-[#6b7280]">kJ/mol</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#6b7280]">ρCp</span>
            <Input
              type="number"
              min="0.1"
              max="20"
              step="0.1"
              value={params.rho_Cp}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) updateParams({ rho_Cp: Math.max(0.1, Math.min(20, v)) });
              }}
              className="w-12"
            />
            <span className="text-[9px] text-[#6b7280]">kJ/(m³·K)</span>
          </div>
        </div>
      )}
    </div>
  );
}
