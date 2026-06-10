import { useState, useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';

const LS_KEY = 'rsi-tour-done';

const STEPS = [
  {
    title: 'Reactor Toolbar',
    body: 'Drag a CSTR or PFR onto the canvas. Connect nodes with arrows to build a network.',
    anchor: { left: 80, top: 80 },
    arrowDir: 'left' as const,
  },
  {
    title: 'Parameter Panel',
    body: 'Set kinetics, feed concentration, and temperature here. Changes re-run the simulation instantly.',
    anchor: { left: 200, top: 55 },
    arrowDir: 'up' as const,
  },
  {
    title: 'Canvas',
    body: 'Connect Feed → Reactors → Product to start. Scroll to zoom, middle-click drag to pan.',
    anchor: { left: '50%' as unknown as number, top: '40%' as unknown as number },
    arrowDir: 'up' as const,
  },
  {
    title: 'Plot & Analysis Panel',
    body: 'Levenspiel, conversion profiles, thermal analysis, sweep engine — all live here.',
    anchor: { right: 430, top: 80 },
    arrowDir: 'right' as const,
  },
  {
    title: 'Status Bar',
    body: 'Final conversion, sizing mode (V = τ·Q), mode toggle, and dark mode switch live here.',
    anchor: { left: 200, bottom: 55 },
    arrowDir: 'down' as const,
  },
];

interface Props {
  onDone: () => void;
}

export default function OnboardingTour({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;

  function advance() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }

  function finish() {
    localStorage.setItem(LS_KEY, '1');
    onDone();
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'Enter' || e.key === 'ArrowRight') advance();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Position tooltip relative to anchor
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 60,
    width: 260,
    borderRadius: 10,
    padding: '14px 16px',
    background: 'var(--surface)',
    border: '2px solid #2563eb',
    boxShadow: '0 8px 32px rgba(37,99,235,0.18)',
    color: 'var(--text-primary)',
  };

  if (typeof current.anchor.left === 'number') style.left = current.anchor.left;
  if ('right' in current.anchor) style.right = (current.anchor as { right: number }).right;
  if (typeof current.anchor.top === 'number') style.top = current.anchor.top;
  if ('bottom' in current.anchor) style.bottom = (current.anchor as { bottom: number }).bottom;

  return (
    <>
      {/* Dim overlay with click-through holes */}
      <div
        className="fixed inset-0 z-50 pointer-events-none"
        style={{ background: 'rgba(15,23,48,0.35)' }}
      />

      <div style={style}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-[#2563eb]">
            {step + 1}/{STEPS.length} — {current.title}
          </span>
          <button onClick={finish} className="text-[#94a3b8] hover:text-[#374151]">
            <X size={12} />
          </button>
        </div>
        <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
          {current.body}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === step ? 16 : 6,
                  height: 6,
                  background: i === step ? '#2563eb' : '#b0bcd4',
                }}
              />
            ))}
          </div>
          <button
            onClick={advance}
            className="flex items-center gap-0.5 text-[11px] font-medium text-white rounded px-2.5 py-1"
            style={{ background: '#2563eb' }}
          >
            {step === STEPS.length - 1 ? 'Done' : 'Next'}
            {step < STEPS.length - 1 && <ChevronRight size={11} />}
          </button>
        </div>
      </div>
    </>
  );
}

export function shouldShowTour(): boolean {
  return !localStorage.getItem(LS_KEY);
}
