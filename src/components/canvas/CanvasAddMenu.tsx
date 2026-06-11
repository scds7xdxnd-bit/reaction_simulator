import { useEffect, useRef } from 'react';

interface Props {
  screenX: number;
  screenY: number;
  flowPos: { x: number; y: number };
  clipboard: { nodes: unknown[]; edges: unknown[] } | null;
  onClose: () => void;
  onAddReactor: (type: string, pos: { x: number; y: number }) => void;
  onAddUnit: (type: string, pos: { x: number; y: number }) => void;
  onAddFeed: (pos: { x: number; y: number }) => void;
  onAddProduct: (pos: { x: number; y: number }) => void;
  onPasteAt: (flowX: number, flowY: number) => void;
}

const REACTORS = [
  { label: 'CSTR', color: '#2563eb', bg: '#eff6ff', kind: 'reactor' as const },
  { label: 'PFR',  color: '#d97706', bg: '#fffbeb', kind: 'reactor' as const },
  { label: 'Batch',color: '#be123c', bg: '#fff1f2', kind: 'reactor' as const },
  { label: 'SB',   color: '#0369a1', bg: '#e0f2fe', kind: 'reactor' as const, type: 'Semibatch' },
  { label: 'FB',   color: '#7c2d12', bg: '#fef3e2', kind: 'reactor' as const, type: 'FixedBed' },
  { label: 'Mixer',color: '#059669', bg: '#ecfdf5', kind: 'unit'    as const },
  { label: 'Split',color: '#7c3aed', bg: '#f5f3ff', kind: 'unit'    as const, type: 'Splitter' },
  { label: 'HX',   color: '#dc2626', bg: '#fff1f2', kind: 'unit'    as const },
];

export default function CanvasAddMenu({
  screenX, screenY, flowPos, clipboard, onClose,
  onAddReactor, onAddUnit, onAddFeed, onAddProduct, onPasteAt,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const handleItem = (item: typeof REACTORS[0]) => {
    const type = item.type ?? item.label;
    if (item.kind === 'reactor') onAddReactor(type, flowPos);
    else onAddUnit(type, flowPos);
    onClose();
  };

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: screenY,
        left: screenX,
        background: '#ffffff',
        border: '1px solid #dde3f0',
        borderRadius: 10,
        boxShadow: '0 6px 24px rgba(0,0,0,0.14)',
        padding: 8,
        zIndex: 300,
        minWidth: 180,
      }}
    >
      {clipboard && clipboard.nodes.length > 0 && (
        <button
          onClick={() => { onPasteAt(flowPos.x, flowPos.y); onClose(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            padding: '5px 8px',
            borderRadius: 6,
            border: 'none',
            background: '#f0fdf4',
            color: '#059669',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
            marginBottom: 6,
            textAlign: 'left',
          }}
        >
          📋 Paste here
        </button>
      )}
      <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginBottom: 4, paddingLeft: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Add element
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {REACTORS.map((item) => (
          <button
            key={item.label}
            onClick={() => handleItem(item)}
            style={{
              padding: '4px 2px',
              borderRadius: 5,
              border: `1px solid ${item.color}40`,
              background: item.bg,
              color: item.color,
              fontSize: 9,
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            {item.label}
          </button>
        ))}
        <button
          onClick={() => { onAddFeed(flowPos); onClose(); }}
          style={{ padding: '4px 2px', borderRadius: 5, border: '1px solid #6b728040', background: '#f9fafb', color: '#6b7280', fontSize: 9, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}
        >
          Feed
        </button>
        <button
          onClick={() => { onAddProduct(flowPos); onClose(); }}
          style={{ padding: '4px 2px', borderRadius: 5, border: '1px solid #16a34a40', background: '#f0fdf4', color: '#16a34a', fontSize: 9, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}
        >
          Product
        </button>
      </div>
    </div>
  );
}
