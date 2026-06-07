import { useSimulatorStore } from '../../store/simulatorStore';
import type { KineticsType, ReactionMode } from '../../types/reactor';

const kineticsOptions: { value: KineticsType; label: string }[] = [
  { value: 'first-order', label: '1st Order' },
  { value: 'second-order', label: '2nd Order' },
  { value: 'autocatalytic', label: 'Autocatalytic' },
];

const modeOptions: { value: ReactionMode; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'series', label: 'Series A→R→S' },
  { value: 'parallel', label: 'Parallel A→R/A→S' },
];

export default function ParameterPanel() {
  const params = useSimulatorStore((s) => s.params);
  const updateParams = useSimulatorStore((s) => s.updateParams);

  const isSingle = params.reactionMode === 'single';
  const kUnit = isSingle
    ? params.kinetics === 'first-order' ? 's⁻¹' : 'L·mol⁻¹·s⁻¹'
    : 's⁻¹';

  const kLabel = isSingle ? 'k =' : 'k₁ =';

  return (
    <div className="h-16 bg-[#ffffff] border-b border-[#dde3f0] flex items-center gap-4 px-4 overflow-x-auto">
      <div className="flex gap-0 rounded-md overflow-hidden border border-[#dde3f0] shrink-0">
        {modeOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => updateParams({ reactionMode: opt.value })}
            className="px-3 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors"
            style={{
              backgroundColor: params.reactionMode === opt.value ? '#2563eb' : '#f3f4f6',
              color: params.reactionMode === opt.value ? '#ffffff' : '#374151',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isSingle && (
        <div className="flex gap-0 rounded-md overflow-hidden border border-[#dde3f0] shrink-0">
          {kineticsOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateParams({ kinetics: opt.value })}
              className="px-3 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors"
              style={{
                backgroundColor: params.kinetics === opt.value ? '#2563eb' : '#f3f4f6',
                color: params.kinetics === opt.value ? '#ffffff' : '#374151',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[11px] text-[#374151] font-mono">{kLabel}</span>
        <input
          type="range"
          min="0.01"
          max="5"
          step="0.01"
          value={params.k}
          onChange={(e) => updateParams({ k: parseFloat(e.target.value) })}
          className="w-24 h-1 accent-[#2563eb]"
        />
        <span className="text-[11px] font-mono text-[#0f1730] w-10 text-right">
          {params.k.toFixed(2)}
        </span>
        <span className="text-[10px] text-[#6b7280]">{kUnit}</span>
      </div>

      {!isSingle && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-[#374151] font-mono">k₂ =</span>
          <input
            type="range"
            min="0.01"
            max="5"
            step="0.01"
            value={params.k2}
            onChange={(e) => updateParams({ k2: parseFloat(e.target.value) })}
            className="w-24 h-1 accent-[#2563eb]"
          />
          <span className="text-[11px] font-mono text-[#0f1730] w-10 text-right">
            {params.k2.toFixed(2)}
          </span>
          <span className="text-[10px] text-[#6b7280]">s⁻¹</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[11px] text-[#374151] font-mono">Cₐ₀ =</span>
        <input
          type="number"
          min="0.1"
          max="10"
          step="0.1"
          value={params.Ca0}
          onChange={(e) =>
            updateParams({ Ca0: Math.max(0.1, Math.min(10, parseFloat(e.target.value) || 0.1)) })
          }
          className="w-16 text-[11px] font-mono bg-[#f8faff] border border-[#dde3f0] rounded px-1.5 py-0.5 text-[#0f1730] outline-none"
        />
        <span className="text-[10px] text-[#6b7280]">mol/L</span>
      </div>

      {isSingle && params.kinetics === 'autocatalytic' && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-[#374151] font-mono">Cᵣ₀/Cₐ₀ =</span>
          <input
            type="range"
            min="0.001"
            max="0.1"
            step="0.001"
            value={params.Cr0_fraction}
            onChange={(e) => updateParams({ Cr0_fraction: parseFloat(e.target.value) })}
            className="w-20 h-1 accent-[#2563eb]"
          />
          <span className="text-[11px] font-mono text-[#0f1730] w-8 text-right">
            {params.Cr0_fraction.toFixed(3)}
          </span>
        </div>
      )}
    </div>
  );
}
