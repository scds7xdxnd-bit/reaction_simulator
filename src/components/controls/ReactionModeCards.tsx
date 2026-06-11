import { lazy, Suspense, useState } from 'react';
import { useSimulatorStore } from '../../store/simulatorStore';
import type { ReactionMode, KineticsType } from '../../types/simulation';

const ReactionBuilderModal = lazy(() => import('./ReactionBuilderModal'));

const KINETICS_CHIPS: { value: KineticsType; label: string }[] = [
  { value: 'first-order',         label: '1st order' },
  { value: 'second-order',        label: '2nd order' },
  { value: 'autocatalytic',       label: 'Autocatalytic' },
  { value: 'reversible',          label: 'Reversible' },
  { value: 'gas-phase-1st-order', label: 'Gas-Phase' },
];

interface ModeEntry { mode: ReactionMode; label: string }
const MODES: ModeEntry[] = [
  { mode: 'single',          label: 'Single' },
  { mode: 'series',          label: 'A→R→S' },
  { mode: 'series3',         label: 'A→R→S→T' },
  { mode: 'series-parallel', label: 'A+B→R→S' },
  { mode: 'parallel',        label: 'Parallel' },
  { mode: 'denbigh',         label: 'Denbigh' },
  { mode: 'custom',          label: 'Custom +' },
];

const N = { fontSize: 9, fontWeight: 700, fontFamily: 'monospace' } as const;

function Arr({ id }: { id: string }) {
  return (
    <defs>
      <marker id={id} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
        <polygon points="0,1 0,4 4,2.5" fill="#94a3b8" />
      </marker>
    </defs>
  );
}

function ModeSvg({ mode }: { mode: ReactionMode }) {
  const mid = `arr-rmc-${mode}`;
  const arr = `url(#${mid})`;

  if (mode === 'custom') {
    return (
      <svg viewBox="0 0 120 44" style={{ width: '100%', height: 40 }}>
        <text x="60" y="30" textAnchor="middle" fontSize="20" fontWeight="300" fill="#94a3b8">＋</text>
      </svg>
    );
  }

  if (mode === 'single') {
    return (
      <svg viewBox="0 0 120 44" style={{ width: '100%', height: 40 }}>
        <Arr id={mid} />
        <line x1="24" y1="22" x2="88" y2="22" stroke="#94a3b8" strokeWidth="1.5" markerEnd={arr} />
        <text x="15"  y="26" textAnchor="middle" {...N} fill="#2563eb">A</text>
        <text x="101" y="26" textAnchor="middle" {...N} fill="#0d9488">R</text>
      </svg>
    );
  }

  if (mode === 'series') {
    return (
      <svg viewBox="0 0 120 44" style={{ width: '100%', height: 40 }}>
        <Arr id={mid} />
        <line x1="17" y1="22" x2="48" y2="22" stroke="#94a3b8" strokeWidth="1.5" markerEnd={arr} />
        <line x1="64" y1="22" x2="96" y2="22" stroke="#94a3b8" strokeWidth="1.5" markerEnd={arr} />
        <text x="10"  y="26" textAnchor="middle" {...N} fill="#2563eb">A</text>
        <text x="57"  y="26" textAnchor="middle" {...N} fill="#0d9488">R</text>
        <text x="107" y="26" textAnchor="middle" {...N} fill="#7c3aed">S</text>
      </svg>
    );
  }

  if (mode === 'series3') {
    return (
      <svg viewBox="0 0 120 44" style={{ width: '100%', height: 40 }}>
        <Arr id={mid} />
        <line x1="13" y1="22" x2="25" y2="22" stroke="#94a3b8" strokeWidth="1.5" markerEnd={arr} />
        <line x1="39" y1="22" x2="51" y2="22" stroke="#94a3b8" strokeWidth="1.5" markerEnd={arr} />
        <line x1="65" y1="22" x2="77" y2="22" stroke="#94a3b8" strokeWidth="1.5" markerEnd={arr} />
        <text x="7"  y="26" textAnchor="middle" {...N} fill="#2563eb">A</text>
        <text x="32" y="26" textAnchor="middle" {...N} fill="#0d9488">R</text>
        <text x="58" y="26" textAnchor="middle" {...N} fill="#7c3aed">S</text>
        <text x="86" y="26" textAnchor="middle" {...N} fill="#ea580c">T</text>
      </svg>
    );
  }

  if (mode === 'parallel') {
    return (
      <svg viewBox="0 0 120 44" style={{ width: '100%', height: 40 }}>
        <Arr id={mid} />
        <line x1="23" y1="20" x2="88" y2="11" stroke="#94a3b8" strokeWidth="1.5" markerEnd={arr} />
        <line x1="23" y1="24" x2="88" y2="33" stroke="#94a3b8" strokeWidth="1.5" markerEnd={arr} />
        <text x="15"  y="25" textAnchor="middle" {...N} fill="#2563eb">A</text>
        <text x="99"  y="15" textAnchor="middle" {...N} fill="#0d9488">R</text>
        <text x="99"  y="37" textAnchor="middle" {...N} fill="#7c3aed">S</text>
      </svg>
    );
  }

  if (mode === 'series-parallel') {
    return (
      <svg viewBox="0 0 120 44" style={{ width: '100%', height: 40 }}>
        <Arr id={mid} />
        <line x1="13" y1="15" x2="54" y2="21" stroke="#94a3b8" strokeWidth="1.5" markerEnd={arr} />
        <line x1="13" y1="31" x2="54" y2="25" stroke="#94a3b8" strokeWidth="1.5" markerEnd={arr} />
        <line x1="70" y1="23" x2="104" y2="23" stroke="#94a3b8" strokeWidth="1.5" markerEnd={arr} />
        <text x="7"   y="17" textAnchor="middle" {...N} fill="#2563eb">A</text>
        <text x="7"   y="34" textAnchor="middle" {...N} fill="#0d9488">B</text>
        <text x="62"  y="27" textAnchor="middle" {...N} fill="#7c3aed">R</text>
        <text x="114" y="27" textAnchor="middle" {...N} fill="#ea580c">S</text>
      </svg>
    );
  }

  if (mode === 'denbigh') {
    return (
      <svg viewBox="0 0 120 44" style={{ width: '100%', height: 40 }}>
        <Arr id={mid} />
        <line x1="17" y1="20" x2="52" y2="13" stroke="#94a3b8" strokeWidth="1.5" markerEnd={arr} />
        <line x1="17" y1="24" x2="52" y2="33" stroke="#94a3b8" strokeWidth="1.5" markerEnd={arr} />
        <line x1="67" y1="11" x2="100" y2="7" stroke="#94a3b8" strokeWidth="1.5" markerEnd={arr} />
        <line x1="67" y1="14" x2="100" y2="20" stroke="#94a3b8" strokeWidth="1.5" markerEnd={arr} />
        <text x="9"   y="25" textAnchor="middle" {...N} fill="#2563eb">A</text>
        <text x="60"  y="14" textAnchor="middle" {...N} fill="#0d9488">R</text>
        <text x="60"  y="38" textAnchor="middle" {...N} fill="#0d9488">T</text>
        <text x="109" y="10" textAnchor="middle" {...N} fill="#7c3aed">S</text>
        <text x="109" y="24" textAnchor="middle" {...N} fill="#7c3aed">U</text>
      </svg>
    );
  }

  return null;
}

export default function ReactionModeCards() {
  const params       = useSimulatorStore((s) => s.params);
  const updateParams = useSimulatorStore((s) => s.updateParams);
  const [showBuilder, setShowBuilder] = useState(false);

  const handleSelect = (mode: ReactionMode) => {
    if (mode === 'custom') {
      setShowBuilder(true);
      return;
    }
    updateParams({ reactionMode: mode });
  };

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 6,
        padding: '8px 10px',
      }}>
        {MODES.map(({ mode, label }) => {
          const isSelected = params.reactionMode === mode;
          return (
            <button
              key={mode}
              onClick={() => handleSelect(mode)}
              style={{
                height: 76,
                padding: '4px 6px 5px',
                borderRadius: 6,
                border: `1.5px solid ${isSelected ? '#2563eb' : '#dde3f0'}`,
                background: isSelected ? '#eff6ff' : 'var(--surface)',
                cursor: 'pointer',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'border-color 0.12s, background 0.12s',
              }}
            >
              <ModeSvg mode={mode} />
              <span style={{
                fontSize: 9,
                fontWeight: 600,
                color: isSelected ? '#2563eb' : '#374151',
                lineHeight: 1.2,
                marginTop: 2,
              }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {params.reactionMode === 'single' && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: '0 10px 8px',
        }}>
          {KINETICS_CHIPS.map(({ value, label }) => {
            const active = params.kinetics === value;
            return (
              <button
                key={value}
                onClick={() => updateParams({ kinetics: value })}
                style={{
                  fontSize: 9,
                  fontWeight: active ? 700 : 500,
                  padding: '2px 7px',
                  borderRadius: 10,
                  border: `1px solid ${active ? '#2563eb' : '#dde3f0'}`,
                  background: active ? '#dbeafe' : 'transparent',
                  color: active ? '#1d4ed8' : '#6b7280',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {showBuilder && (
        <Suspense fallback={null}>
          <ReactionBuilderModal onClose={() => setShowBuilder(false)} />
        </Suspense>
      )}
    </div>
  );
}
