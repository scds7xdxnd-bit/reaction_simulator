import { useSimulatorStore } from '../store/simulatorStore';
import { AlertTriangle } from 'lucide-react';

export default function StatusBar() {
  const result = useSimulatorStore((s) => s.result);
  const params = useSimulatorStore((s) => s.params);
  const nodes = useSimulatorStore((s) => s.nodes);

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

  const reactorCount = nodes.filter((n) => n.type === 'cstr' || n.type === 'pfr').length;

  const kUnit = isSingle
    ? params.kinetics === 'first-order' ? 's⁻¹' : 'L·mol⁻¹·s⁻¹'
    : 's⁻¹';

  const kineticsLabel = isSingle
    ? params.kinetics === 'first-order'
      ? '1st Order'
      : params.kinetics === 'second-order'
        ? '2nd Order'
        : 'Autocatalytic'
    : params.reactionMode === 'series'
      ? 'Series A→R→S'
      : 'Parallel A→R/A→S';

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
        </>
      ) : (
        <span className="flex items-center gap-1.5" style={{ color: '#d97706' }}>
          <AlertTriangle size={14} />
          <span>Connect Feed → Reactors → Product to simulate</span>
        </span>
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

      {isSingle && params.kinetics === 'autocatalytic' && (
        <>
          <span className="text-[#b0bcd4]">|</span>
          <span className="text-[#374151]">Cᵣ₀/Cₐ₀ =</span>
          <span className="font-mono text-[#0f1730]">{params.Cr0_fraction.toFixed(3)}</span>
        </>
      )}

      <span className="text-[#b0bcd4]">|</span>
      <span className="text-[#374151]">
        {reactorCount} Reactor{reactorCount !== 1 ? 's' : ''} in Series
      </span>
    </div>
  );
}
