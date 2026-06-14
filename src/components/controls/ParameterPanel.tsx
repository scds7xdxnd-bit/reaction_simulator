import { useState, lazy, Suspense } from 'react';
const ReactionBuilderModal = lazy(() => import('./ReactionBuilderModal'));
import { useSimulatorStore } from '../../store/simulatorStore';
import { getPreset } from '../../math/reactionRegistry';
import { formatEquation, formatNetworkLabel } from '../../math/formatEquation';

const MODE_LABELS: Record<string, string> = {
  single:          'Single',
  series:          'Series A→R→S',
  series3:         'A→R→S→T',
  'series-parallel': 'A+B→R+B→S',
  denbigh:         'Denbigh',
  parallel:        'Parallel A→R/A→S',
  custom:          'Custom',
};

export default function ParameterPanel() {
  const params = useSimulatorStore((s) => s.params);
  const [showBuilder, setShowBuilder] = useState(false);

  const preset = getPreset(params);

  const modeAccent = params.reactionMode === 'series'   ? '#0d9488'
                   : params.reactionMode === 'series3'  ? '#0d9488'
                   : params.reactionMode === 'parallel' ? '#7c3aed'
                   : '#2563eb';

  const modeLabel = MODE_LABELS[params.reactionMode] ?? params.reactionMode;
  const kineticsLabel = (preset.isSingle && preset.kinetics != null) ? preset.uiLabel : null;

  return (
    <div
      className="bg-[#ffffff] border-b border-[#dde3f0] flex flex-col"
      style={{ borderLeft: `3px solid ${modeAccent}` }}
    >
      <div className="flex items-center gap-3 px-4 overflow-x-auto" style={{ height: 36 }}>
        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600,
                       letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
          {modeLabel}{kineticsLabel ? ` · ${kineticsLabel}` : ''}
        </span>

        {params.reactionMode === 'custom' && params.customReaction && (
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#7c3aed',
                          flexShrink: 0, fontWeight: 500 }}>
            {formatNetworkLabel(params.customReaction.reactions)}
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
