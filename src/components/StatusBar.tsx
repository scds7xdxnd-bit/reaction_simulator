import { useSimulatorStore } from '../store/simulatorStore';
import { getPreset } from '../math/reactionRegistry';
import { useValidation } from '../hooks/useValidation';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export default function StatusBar() {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);
  const nodes = useSimulatorStore((s) => s.nodes);
  const simulationMode = useSimulatorStore((s) => s.simulationMode);
  const setSimulationMode = useSimulatorStore((s) => s.setSimulationMode);
  const sizingMode = useSimulatorStore((s) => s.sizingMode);
  const setSizingMode = useSimulatorStore((s) => s.setSizingMode);
  const updateParams = useSimulatorStore((s) => s.updateParams);

  const isSingle = params.reactionMode === 'single';
  const finalXa = result?.finalConversion ?? null;

  const conversionColor =
    finalXa !== null
      ? finalXa > 0.7
        ? '#16a34a'
        : finalXa > 0.4
          ? '#d97706'
          : '#dc2626'
      : '#6b7280';

  const reactorCount = nodes.filter((n) => n.type === 'cstr' || n.type === 'pfr' || n.type === 'batch').length;
  const hasMixerOrSplitter = nodes.some((n) => n.type === 'mixer' || n.type === 'splitter');

  const preset        = getPreset(params);
  const kUnit         = preset.kUnit ?? 's⁻¹';
  const kineticsLabel = preset.uiLabel;

  const finalYield = result?.finalYield ?? NaN;
  const finalSelectivity = result?.finalSelectivity ?? NaN;

  const yieldColor = isNaN(finalYield)
    ? '#6b7280'
    : finalYield > 0.4
      ? '#16a34a'
      : finalYield > 0.2
        ? '#d97706'
        : '#dc2626';

  const selColor = isNaN(finalSelectivity)
    ? '#6b7280'
    : finalSelectivity > 0.6
      ? '#16a34a'
      : finalSelectivity > 0.3
        ? '#d97706'
        : '#dc2626';

  const issues     = useValidation();
  const errorCount = issues.filter((i) => i.level === 'error').length;
  const warnCount  = issues.filter((i) => i.level === 'warning').length;

  return (
    <div className="h-12 bg-[#f8faff] border-t border-[#dde3f0] flex items-center px-4 gap-3 text-[12px] shrink-0">
      {result ? (
        <>
          <span className="text-[#374151]">Final Xₐ:</span>
          <span className="font-mono font-bold" style={{ color: conversionColor }}>
            {(finalXa! * 100).toFixed(1)}%
          </span>

          {!isSingle && !isNaN(finalYield) && (
            <>
              <span className="text-[#b0bcd4]">|</span>
              <span className="text-[#374151]">Yield Y_R:</span>
              <span className="font-mono font-bold" style={{ color: yieldColor }}>
                {(finalYield * 100).toFixed(1)}%
              </span>
              <span className="text-[#b0bcd4]">|</span>
              <span className="text-[#374151]">Selectivity S_R:</span>
              <span className="font-mono font-bold" style={{ color: selColor }}>
                {(finalSelectivity * 100).toFixed(1)}%
              </span>
            </>
          )}

          {hasMixerOrSplitter && result && (
            <>
              <span className="text-[#b0bcd4]">|</span>
              {result.converged ? (
                <span className="flex items-center gap-1" style={{ color: '#16a34a' }}>
                  <CheckCircle size={12} />
                  <span className="font-mono">Converged ({result.iterations} iter)</span>
                </span>
              ) : (
                <span className="flex items-center gap-1" style={{ color: '#d97706' }}>
                  <AlertTriangle size={12} />
                  <span className="font-mono">Not converged ({result.iterations} iter)</span>
                </span>
              )}
            </>
          )}
        </>
      ) : (
        <span className="flex items-center gap-1.5" style={{ color: '#d97706' }}>
          <AlertTriangle size={14} />
          <span>{hasMixerOrSplitter
            ? 'Connect Feed → Units → Product to simulate'
            : 'Connect Feed → Reactors → Product to simulate'}</span>
        </span>
      )}

      {issues.length > 0 && (
        <>
          <span className="text-[#b0bcd4]">|</span>
          <span
            title={issues.map((i) => i.message).join('\n')}
            className="flex items-center gap-1 cursor-default"
            style={{ color: errorCount > 0 ? '#dc2626' : '#d97706' }}
          >
            <AlertTriangle size={12} />
            <span className="font-mono">
              {errorCount > 0
                ? `${errorCount} error${errorCount > 1 ? 's' : ''}`
                : `${warnCount} warning${warnCount > 1 ? 's' : ''}`}
            </span>
          </span>
        </>
      )}

      <span className="text-[#b0bcd4]">|</span>
      <span className="text-[#374151]">Kinetics:</span>
      <span className="text-[#0f1730]">{kineticsLabel}</span>

      <span className="text-[#b0bcd4]">|</span>
      <span className="text-[#374151]">{isSingle ? 'k =' : 'k₁ ='}</span>
      <span className="font-mono text-[#0f1730]">
        {params.k.toFixed(2)} {kUnit}
      </span>

      {!isSingle && (
        <>
          <span className="text-[#b0bcd4]">|</span>
          <span className="text-[#374151]">k₂ =</span>
          <span className="font-mono text-[#0f1730]">
            {params.k2.toFixed(2)} s⁻¹
          </span>
        </>
      )}

      <span className="text-[#b0bcd4]">|</span>
      <span className="text-[#374151]">Cₐ₀ =</span>
      <span className="font-mono text-[#0f1730]">{params.Ca0.toFixed(2)} mol/L</span>

      {preset.id === 'single-autocatalytic' && (
        <>
          <span className="text-[#b0bcd4]">|</span>
          <span className="text-[#374151]">Cᵣ₀/Cₐ₀ =</span>
          <span className="font-mono text-[#0f1730]">{params.Cr0_fraction.toFixed(3)}</span>
        </>
      )}

      <span className="text-[#b0bcd4]">|</span>
      <span className="text-[#374151]">
        {hasMixerOrSplitter
          ? `${reactorCount} Reactor${reactorCount !== 1 ? 's' : ''} in Network`
          : `${reactorCount} Reactor${reactorCount !== 1 ? 's' : ''} in Series`}
      </span>

      {sizingMode && result && params.Q_feed > 0 && (
        <>
          <span className="text-[#b0bcd4]">|</span>
          <span className="text-[#374151]">Total V:</span>
          <span className="font-mono font-bold text-[#7c3aed]">
            {result.segments.reduce((acc, s) => acc + (s.V ?? 0), 0).toFixed(2)} L
          </span>
        </>
      )}

      <div className="ml-auto flex gap-1">
        <button
          onClick={() => setSizingMode(!sizingMode)}
          className="text-[10px] px-2 py-0.5 rounded border font-medium transition-colors"
          style={{
            background: sizingMode ? '#7c3aed' : '#f8faff',
            color: sizingMode ? '#ffffff' : '#6b7280',
            borderColor: sizingMode ? '#7c3aed' : '#dde3f0',
          }}
        >
          Sizing
        </button>
        {sizingMode && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#6b7280]">Q =</span>
            <input
              type="number"
              min="0.001"
              max="1000"
              step="0.1"
              value={params.Q_feed || ''}
              placeholder="L/s"
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) updateParams({ Q_feed: v });
              }}
              className="w-16 text-[10px] font-mono border rounded px-1 py-0.5 outline-none"
              style={{ borderColor: '#7c3aed', background: '#faf5ff', color: '#0f1730' }}
            />
            <span className="text-[10px] text-[#6b7280]">L/s</span>
          </div>
        )}
        <button
          onClick={() => setSimulationMode('steady-state')}
          className="text-[10px] px-2 py-0.5 rounded border font-medium transition-colors"
          style={{
            background: simulationMode === 'steady-state' ? '#2563eb' : '#f8faff',
            color: simulationMode === 'steady-state' ? '#ffffff' : '#6b7280',
            borderColor: simulationMode === 'steady-state' ? '#2563eb' : '#dde3f0',
          }}
        >
          Steady State
        </button>
        <button
          onClick={() => setSimulationMode('dynamic')}
          className="text-[10px] px-2 py-0.5 rounded border font-medium transition-colors"
          style={{
            background: simulationMode === 'dynamic' ? '#2563eb' : '#f8faff',
            color: simulationMode === 'dynamic' ? '#ffffff' : '#6b7280',
            borderColor: simulationMode === 'dynamic' ? '#2563eb' : '#dde3f0',
          }}
        >
          Dynamic
        </button>
      </div>
    </div>
  );
}
