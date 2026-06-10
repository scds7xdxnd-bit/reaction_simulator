import { useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const SECTIONS = [
  {
    title: 'Canvas',
    items: [
      { key: '?',           desc: 'Show this shortcut help' },
      { key: 'Scroll',      desc: 'Zoom in / out' },
      { key: 'Middle drag', desc: 'Pan canvas' },
      { key: 'Drag node',   desc: 'Move reactor on canvas' },
    ],
  },
  {
    title: 'Edit',
    items: [
      { key: '⌘Z / Ctrl Z',   desc: 'Undo' },
      { key: '⌘⇧Z / Ctrl Y',  desc: 'Redo' },
      { key: '⌘C / Ctrl C',   desc: 'Copy selected nodes' },
      { key: '⌘V / Ctrl V',   desc: 'Paste nodes' },
      { key: 'Del / Backspace', desc: 'Delete selected node or edge' },
      { key: 'Esc',            desc: 'Close menus / deselect' },
    ],
  },
  {
    title: 'Simulation',
    items: [
      { key: 'Connect nodes', desc: 'Feed → Reactors → Product to run simulation' },
      { key: 'Sizing toggle', desc: 'Enable reactor volume mode (status bar)' },
      { key: 'Scenarios tab', desc: 'Save and compare simulation snapshots' },
    ],
  },
  {
    title: 'Export',
    items: [
      { key: 'Export button', desc: 'PNG flowsheet, CSV streams, print report (toolbar)' },
    ],
  },
];

export default function ShortcutsModal({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,23,48,0.55)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl p-5 w-[520px] max-h-[80vh] overflow-y-auto"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {SECTIONS.map((sec) => (
            <div key={sec.title}>
              <div
                className="text-[9px] font-bold uppercase tracking-wider mb-2"
                style={{ color: '#2563eb' }}
              >
                {sec.title}
              </div>
              <div className="flex flex-col gap-1.5">
                {sec.items.map((item) => (
                  <div key={item.key} className="flex items-start justify-between gap-2">
                    <kbd
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        background: 'var(--surface-raised)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.key}
                    </kbd>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {item.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
          Press <kbd className="text-[10px] font-mono px-1 rounded" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>?</kbd> or <kbd className="text-[10px] font-mono px-1 rounded" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
