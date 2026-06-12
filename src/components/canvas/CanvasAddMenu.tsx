import { useEffect, useRef, useState } from 'react';

// ─── Mini icons (same SVG shapes as ReactorToolbar, scaled smaller) ────────────

function CstrIcon()     { return <svg width="22" height="24" viewBox="0 0 26 28" fill="none"><path d="M2 2 H24 V18 Q13 27 2 18 Z" stroke="#2563eb" strokeWidth="1.5" fill="#eff6ff" strokeLinejoin="round"/><line x1="13" y1="2" x2="13" y2="16" stroke="#2563eb" strokeWidth="1.3"/><line x1="7" y1="16" x2="19" y2="16" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/></svg>; }
function PfrIcon()      { return <svg width="24" height="14" viewBox="0 0 28 16" fill="none"><path d="M5 1 H23 Q28 1 28 8 Q28 15 23 15 H5 Q0 15 0 8 Q0 1 5 1 Z" stroke="#d97706" strokeWidth="1.5" fill="#fffbeb"/><path d="M5 5 L10 8 L5 11 Z" fill="#d97706"/><path d="M13 5 L18 8 L13 11 Z" fill="#d97706"/></svg>; }
function BatchIcon()    { return <svg width="18" height="24" viewBox="0 0 22 28" fill="none"><path d="M8 2 H14 V10 L20 22 Q22 28 11 28 Q0 28 2 22 L8 10 Z" stroke="#be123c" strokeWidth="1.5" fill="#fff1f2" strokeLinejoin="round"/></svg>; }
function SemibatchIcon(){ return <svg width="20" height="24" viewBox="0 0 24 28" fill="none"><path d="M8 2 H14 V10 L20 22 Q22 28 12 28 Q2 28 4 22 L10 10 Z" stroke="#0369a1" strokeWidth="1.5" fill="#e0f2fe" strokeLinejoin="round"/><line x1="20" y1="13" x2="24" y2="13" stroke="#0369a1" strokeWidth="1.5" strokeLinecap="round"/><polygon points="21,10 24,13 21,16" fill="#0369a1"/></svg>; }
function FixedBedIcon() { return <svg width="20" height="24" viewBox="0 0 24 28" fill="none"><rect x="3" y="2" width="18" height="5" rx="1.5" fill="#fed7aa" stroke="#7c2d12" strokeWidth="1.2"/><rect x="3" y="10" width="18" height="5" rx="1.5" fill="#fed7aa" stroke="#7c2d12" strokeWidth="1.2"/><rect x="3" y="18" width="18" height="5" rx="1.5" fill="#fed7aa" stroke="#7c2d12" strokeWidth="1.2"/></svg>; }
function FlashIcon()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="12" rx="3" stroke="#0d9488" strokeWidth="1.5" fill="#f0fdfa"/><line x1="2" y1="12" x2="4" y2="12" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round"/><line x1="20" y1="9" x2="22" y2="9" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round"/><line x1="20" y1="15" x2="22" y2="15" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function PurgeIcon()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><line x1="3" y1="12" x2="10" y2="12" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round"/><line x1="10" y1="12" x2="21" y2="6" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 1.5"/><line x1="10" y1="12" x2="21" y2="18" stroke="#ea580c" strokeWidth="2" strokeLinecap="round"/><circle cx="10" cy="12" r="3" fill="#ea580c"/></svg>; }
function CSplitIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><line x1="3" y1="12" x2="10" y2="12" stroke="#0891b2" strokeWidth="2.5" strokeLinecap="round"/><line x1="10" y1="12" x2="21" y2="6" stroke="#0891b2" strokeWidth="2" strokeLinecap="round"/><line x1="10" y1="12" x2="21" y2="18" stroke="#0891b2" strokeWidth="2" strokeLinecap="round"/><circle cx="10" cy="12" r="3" fill="#0891b2"/></svg>; }
function HXIcon()       { return <svg width="22" height="18" viewBox="0 0 26 20" fill="none"><rect x="1" y="5" width="24" height="10" rx="3" stroke="#dc2626" strokeWidth="1.5" fill="#fff1f2"/><path d="M7 0 L7 5 M7 15 L7 20" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/><path d="M13 0 L13 5 M13 15 L13 20" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function PumpIcon()     { return <svg width="20" height="18" viewBox="0 0 24 20" fill="none"><circle cx="12" cy="10" r="8" stroke="#1d4ed8" strokeWidth="1.5" fill="#eff6ff"/><path d="M8 10 L16 10 M13 7 L16 10 L13 13" stroke="#1d4ed8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function CompIcon()     { return <svg width="20" height="18" viewBox="0 0 24 20" fill="none"><path d="M4 16 L12 4 L20 16 Z" stroke="#7c3aed" strokeWidth="1.5" fill="#f5f3ff" strokeLinejoin="round"/><line x1="12" y1="4" x2="12" y2="1" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function ValveIcon()    { return <svg width="20" height="18" viewBox="0 0 24 20" fill="none"><polygon points="3,4 3,16 12,10" fill="#b45309"/><polygon points="21,4 21,16 12,10" fill="#b45309"/><line x1="1" y1="10" x2="3" y2="10" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round"/><line x1="21" y1="10" x2="23" y2="10" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function MixerIcon()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><line x1="12" y1="3" x2="12" y2="12" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"/><line x1="12" y1="21" x2="12" y2="12" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"/><line x1="12" y1="12" x2="21" y2="12" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"/><circle cx="12" cy="12" r="3" fill="#059669"/></svg>; }
function SplitterIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><line x1="3" y1="12" x2="12" y2="12" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round"/><line x1="12" y1="12" x2="22" y2="6" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="12" x2="22" y2="18" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="12" r="3" fill="#7c3aed"/></svg>; }
function FeedIcon()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#6b7280" strokeWidth="1.5" fill="#f9fafb"/><line x1="12" y1="7" x2="12" y2="17" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round"/><line x1="7" y1="12" x2="17" y2="12" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round"/></svg>; }
function ProductIcon()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#16a34a" strokeWidth="1.5" fill="#f0fdf4"/><polyline points="9,9 15,12 9,15" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>; }

// ─── Category definitions ─────────────────────────────────────────────────────

type ItemKind = 'reactor' | 'unit' | 'feed' | 'product';

interface NodeDef {
  label: string;
  color: string;
  bg: string;
  kind: ItemKind;
  type?: string;
  icon: React.ReactNode;
}

interface CategoryDef {
  id: string;
  label: string;
  color: string;
  items: NodeDef[];
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'reactors', label: 'Reactors', color: '#2563eb',
    items: [
      { label: 'CSTR',  color: '#2563eb', bg: '#eff6ff', kind: 'reactor', icon: <CstrIcon /> },
      { label: 'PFR',   color: '#d97706', bg: '#fffbeb', kind: 'reactor', icon: <PfrIcon /> },
      { label: 'Batch', color: '#be123c', bg: '#fff1f2', kind: 'reactor', icon: <BatchIcon /> },
      { label: 'SB',    color: '#0369a1', bg: '#e0f2fe', kind: 'reactor', type: 'Semibatch', icon: <SemibatchIcon /> },
      { label: 'FB',    color: '#7c2d12', bg: '#fef3e2', kind: 'reactor', type: 'FixedBed',  icon: <FixedBedIcon /> },
    ],
  },
  {
    id: 'separation', label: 'Separate', color: '#0d9488',
    items: [
      { label: 'Flash',  color: '#0d9488', bg: '#f0fdfa', kind: 'unit', icon: <FlashIcon /> },
      { label: 'Purge',  color: '#ea580c', bg: '#fff7ed', kind: 'unit', icon: <PurgeIcon /> },
      { label: 'CSplit', color: '#0891b2', bg: '#ecfeff', kind: 'unit', icon: <CSplitIcon /> },
      { label: 'HX',     color: '#dc2626', bg: '#fff1f2', kind: 'unit', icon: <HXIcon /> },
    ],
  },
  {
    id: 'pressure', label: 'Pressure', color: '#4f46e5',
    items: [
      { label: 'Pump',  color: '#1d4ed8', bg: '#eff6ff', kind: 'unit', icon: <PumpIcon /> },
      { label: 'Comp',  color: '#7c3aed', bg: '#f5f3ff', kind: 'unit', icon: <CompIcon /> },
      { label: 'Valve', color: '#b45309', bg: '#fffbeb', kind: 'unit', icon: <ValveIcon /> },
    ],
  },
  {
    id: 'flow', label: 'Flow & I/O', color: '#059669',
    items: [
      { label: 'Mixer',   color: '#059669', bg: '#ecfdf5', kind: 'unit',    icon: <MixerIcon /> },
      { label: 'Split',   color: '#7c3aed', bg: '#f5f3ff', kind: 'unit',    type: 'Splitter', icon: <SplitterIcon /> },
      { label: 'Feed',    color: '#6b7280', bg: '#f9fafb', kind: 'feed',    icon: <FeedIcon /> },
      { label: 'Product', color: '#16a34a', bg: '#f0fdf4', kind: 'product', icon: <ProductIcon /> },
    ],
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  screenX: number;
  screenY: number;
  flowPos: { x: number; y: number };
  clipboard: { nodes: unknown[]; edges: unknown[] } | null;
  onClose: () => void;
  onAddReactor: (type: string, pos: { x: number; y: number }) => void;
  onAddUnit:    (type: string, pos: { x: number; y: number }) => void;
  onAddFeed:    (pos: { x: number; y: number }) => void;
  onAddProduct: (pos: { x: number; y: number }) => void;
  onPasteAt:    (flowX: number, flowY: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const MENU_W = 340;
const MENU_H = 220;
const LEFT_W = 96;  // ≈30%

export default function CanvasAddMenu({
  screenX, screenY, flowPos, clipboard, onClose,
  onAddReactor, onAddUnit, onAddFeed, onAddProduct, onPasteAt,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [activeCat, setActiveCat] = useState<string>('reactors');

  // Clamp position so the menu stays inside the viewport
  const left = Math.min(screenX, window.innerWidth  - MENU_W - 12);
  const top  = Math.min(screenY, window.innerHeight - MENU_H - 12);

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

  const handleItem = (item: NodeDef) => {
    const type = item.type ?? item.label;
    if      (item.kind === 'reactor') onAddReactor(type, flowPos);
    else if (item.kind === 'feed')    onAddFeed(flowPos);
    else if (item.kind === 'product') onAddProduct(flowPos);
    else                              onAddUnit(type, flowPos);
    onClose();
  };

  const currentCat = CATEGORIES.find((c) => c.id === activeCat) ?? CATEGORIES[0];
  const hasPaste = clipboard && clipboard.nodes.length > 0;

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top,
        left,
        width: MENU_W,
        background: '#ffffff',
        border: '1px solid #dde3f0',
        borderRadius: 12,
        boxShadow: '0 8px 30px rgba(0,0,0,0.16)',
        zIndex: 300,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* header */}
      <div style={{
        padding: '7px 10px 6px',
        borderBottom: '1px solid #f1f5f9',
        fontSize: 10,
        fontWeight: 700,
        color: '#9ca3af',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        Add element
      </div>

      {/* two-column body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* ── Left column (30%): categories + paste ─────────────── */}
        <div style={{
          width: LEFT_W,
          borderRight: '1px solid #f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          padding: '6px 0',
          gap: 1,
          background: '#fafbfc',
        }}>
          {CATEGORIES.map((cat) => {
            const isActive = cat.id === activeCat;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '6px 10px',
                  border: 'none',
                  borderRadius: 0,
                  background: isActive ? cat.color + '12' : 'transparent',
                  color: isActive ? cat.color : '#6b7280',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 11,
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderLeft: `2px solid ${isActive ? cat.color : 'transparent'}`,
                  transition: 'all 0.12s',
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: isActive ? cat.color : '#d1d5db',
                  flexShrink: 0,
                  transition: 'background 0.12s',
                }} />
                {cat.label}
              </button>
            );
          })}

          {/* paste entry at the bottom */}
          {hasPaste && (
            <>
              <div style={{ borderTop: '1px solid #f1f5f9', margin: '4px 0 2px' }} />
              <button
                onClick={() => { onPasteAt(flowPos.x, flowPos.y); onClose(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '6px 10px',
                  border: 'none',
                  borderRadius: 0,
                  background: 'transparent',
                  color: '#059669',
                  fontWeight: 600,
                  fontSize: 11,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 12 }}>📋</span>
                Paste
              </button>
            </>
          )}
        </div>

        {/* ── Right column (70%): node items grid ────────────────── */}
        <div style={{
          flex: 1,
          padding: '8px 8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {/* category label */}
          <div style={{
            fontSize: 9,
            fontWeight: 800,
            color: currentCat.color,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            paddingBottom: 4,
            borderBottom: `1px solid ${currentCat.color}20`,
            marginBottom: 2,
          }}>
            {currentCat.label}
          </div>

          {/* node chips */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
          }}>
            {currentCat.items.map((item) => (
              <button
                key={item.label}
                onClick={() => handleItem(item)}
                title={item.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  padding: '8px 4px 6px',
                  border: `1px solid ${item.color}30`,
                  borderRadius: 8,
                  background: item.bg,
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = item.color + '80';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 2px 8px ${item.color}20`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = item.color + '30';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 26 }}>
                  {item.icon}
                </div>
                <span style={{
                  fontSize: 8.5,
                  fontWeight: 700,
                  color: item.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  lineHeight: 1,
                }}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
