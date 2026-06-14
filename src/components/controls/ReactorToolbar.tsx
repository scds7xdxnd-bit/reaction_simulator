import { useCallback, useState } from 'react';
import { Settings } from 'lucide-react';
import { Tooltip } from '../ui';
import { useSimulatorStore } from '../../store/simulatorStore';

// ─── Icon components ──────────────────────────────────────────────────────────

function CstrIcon() {
  return (
    <svg width="26" height="28" viewBox="0 0 26 28" fill="none">
      <path d="M2 2 H24 V18 Q13 27 2 18 Z"
        stroke="#2563eb" strokeWidth="1.5" fill="#eff6ff" strokeLinejoin="round" />
      <line x1="13" y1="2"  x2="13" y2="16" stroke="#2563eb" strokeWidth="1.3" />
      <line x1="7"  y1="16" x2="19" y2="16" stroke="#2563eb" strokeWidth="2"   strokeLinecap="round" />
      <line x1="7"  y1="13" x2="19" y2="13" stroke="#2563eb" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function PfrIcon() {
  return (
    <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
      <path d="M5 1 H23 Q28 1 28 8 Q28 15 23 15 H5 Q0 15 0 8 Q0 1 5 1 Z"
        stroke="#d97706" strokeWidth="1.5" fill="#fffbeb" />
      <path d="M5 5 L10 8 L5 11 Z"  fill="#d97706" />
      <path d="M13 5 L18 8 L13 11 Z" fill="#d97706" />
    </svg>
  );
}

function BatchIcon() {
  return (
    <svg width="22" height="28" viewBox="0 0 22 28" fill="none">
      <path d="M8 2 H14 V10 L20 22 Q22 28 11 28 Q0 28 2 22 L8 10 Z"
        stroke="#be123c" strokeWidth="1.5" fill="#fff1f2" strokeLinejoin="round" />
      <path d="M4 22 Q11 20 18 22" stroke="#be123c" strokeWidth="1.2" strokeDasharray="2 1.5" />
    </svg>
  );
}

function SemibatchIcon() {
  return (
    <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
      <path d="M8 2 H14 V10 L20 22 Q22 28 12 28 Q2 28 4 22 L10 10 Z"
        stroke="#0369a1" strokeWidth="1.5" fill="#e0f2fe" strokeLinejoin="round" />
      <path d="M4 22 Q12 20 20 22" stroke="#0369a1" strokeWidth="1.2" strokeDasharray="2 1.5" />
      <line x1="20" y1="13" x2="24" y2="13" stroke="#0369a1" strokeWidth="1.5" strokeLinecap="round" />
      <polygon points="21,10 24,13 21,16" fill="#0369a1" />
    </svg>
  );
}

function FixedBedIcon() {
  return (
    <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
      <rect x="3" y="2"  width="18" height="5"  rx="1.5" fill="#fed7aa" stroke="#7c2d12" strokeWidth="1.2" />
      <rect x="3" y="10" width="18" height="5"  rx="1.5" fill="#fed7aa" stroke="#7c2d12" strokeWidth="1.2" />
      <rect x="3" y="18" width="18" height="5"  rx="1.5" fill="#fed7aa" stroke="#7c2d12" strokeWidth="1.2" />
      <line x1="2" y1="26" x2="22" y2="26" stroke="#7c2d12" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MixerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <line x1="12" y1="3"  x2="12" y2="12" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="12" y1="21" x2="12" y2="12" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="12" y1="12" x2="21" y2="12" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" fill="#059669" />
    </svg>
  );
}

function SplitterIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <line x1="3"  y1="12" x2="12" y2="12" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="12" y1="12" x2="22" y2="6"  stroke="#7c3aed" strokeWidth="2"   strokeLinecap="round" />
      <line x1="12" y1="12" x2="22" y2="18" stroke="#7c3aed" strokeWidth="2"   strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" fill="#7c3aed" />
    </svg>
  );
}

function FeedIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#6b7280" strokeWidth="1.5" fill="#f9fafb" />
      <line x1="12" y1="7"  x2="12" y2="17" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="7"  y1="12" x2="17" y2="12" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ProductIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#16a34a" strokeWidth="1.5" fill="#f0fdf4" />
      <polyline points="9,9 15,12 9,15"
        stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// ─── Category icons (simplified representatives) ──────────────────────────────

function ReactorsCatIcon({ open }: { open: boolean }) {
  const c = '#2563eb';
  return (
    <svg width="24" height="22" viewBox="0 0 24 22" fill="none">
      <path d="M2 2 H22 V14 Q12 22 2 14 Z" stroke={c} strokeWidth="1.4" fill={open ? '#eff6ff' : '#f8fafc'} strokeLinejoin="round" />
      <line x1="12" y1="2" x2="12" y2="12" stroke={c} strokeWidth="1.2" />
      <line x1="7"  y1="12" x2="17" y2="12" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SeparationCatIcon({ open }: { open: boolean }) {
  const c = '#0d9488';
  return (
    <svg width="24" height="22" viewBox="0 0 24 22" fill="none">
      <rect x="2" y="4" width="20" height="14" rx="2.5" stroke={c} strokeWidth="1.4" fill={open ? '#f0fdfa' : '#f8fafc'} />
      <line x1="2" y1="13" x2="22" y2="13" stroke={c} strokeWidth="1.1" strokeDasharray="2 1" />
      <line x1="22" y1="7"  x2="24" y2="7"  stroke={c} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="22" y1="17" x2="24" y2="17" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PressureCatIcon({ open }: { open: boolean }) {
  const c = '#4f46e5';
  return (
    <svg width="24" height="22" viewBox="0 0 24 22" fill="none">
      <circle cx="12" cy="12" r="8" stroke={c} strokeWidth="1.4" fill={open ? '#eef2ff' : '#f8fafc'} />
      <path d="M8 12 L16 12 M13 8 L16 12 L13 16" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="4"  x2="12" y2="2"  stroke={c} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="12" y1="20" x2="12" y2="22" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function FlowCatIcon({ open }: { open: boolean }) {
  const c = '#059669';
  return (
    <svg width="24" height="22" viewBox="0 0 24 22" fill="none">
      <line x1="2"  y1="11" x2="11" y2="11" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <line x1="11" y1="11" x2="22" y2="5"  stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="11" y1="11" x2="22" y2="17" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="11" cy="11" r="2.5" fill={c} />
    </svg>
  );
}

// ─── CategoryGroup ─────────────────────────────────────────────────────────────

function CategoryGroup({ label, color, icon, children }: {
  label: string;
  color: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative w-full flex justify-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Trigger button */}
      <div
        className="flex flex-col items-center gap-[2px] w-[54px] py-1.5 px-1 rounded-lg
                   cursor-default select-none transition-colors"
        style={{ background: open ? color + '14' : 'transparent' }}
      >
        <div
          className="flex items-center justify-center rounded-md border"
          style={{
            width: 34, height: 28,
            borderColor: color,
            background: open ? color + '18' : '#f8fafc',
          }}
        >
          {icon}
        </div>
        <span style={{ fontSize: 8, color, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {label}
        </span>
        {/* Right-pointing indicator */}
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M1.5 1 L4 3 L1.5 5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 1 L6.5 3 L4 5"   stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.4" />
        </svg>
      </div>

      {/* Flyout panel + gap bridge */}
      {open && (
        <>
        <div style={{ position: 'absolute', left: '100%', top: 0, width: 6, height: 200 }} />
        <div
          style={{
            position: 'absolute',
            left: 'calc(100% + 6px)',
            top: 0,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
            padding: '10px 8px 8px',
            zIndex: 200,
            minWidth: 170,
          }}
        >
          <div style={{
            fontSize: 9,
            fontWeight: 800,
            color: color,
            marginBottom: 8,
            paddingBottom: 5,
            borderBottom: `1px solid ${color}22`,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            {label}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {children}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

// ─── NodeItem (inside flyout) ──────────────────────────────────────────────────

function NodeItem({ label, color, bg, icon, dragType, tooltip, onDragStart, onClick }: {
  label: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
  dragType: string;
  tooltip: string;
  onDragStart: (e: React.DragEvent, type: string) => void;
  onClick: () => void;
}) {
  return (
    <Tooltip content={tooltip}>
      <div
        className="flex flex-col items-center gap-0.5 rounded-md py-1.5 px-1 cursor-grab
                   active:cursor-grabbing hover:bg-[#f1f5f9] transition-colors"
        style={{ width: 50 }}
        draggable
        onDragStart={(e) => onDragStart(e, dragType)}
        onClick={onClick}
      >
        <div
          className="flex items-center justify-center rounded border"
          style={{ width: 32, height: 28, borderColor: color, background: bg }}
        >
          {icon}
        </div>
        <span style={{ fontSize: 8, color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {label}
        </span>
      </div>
    </Tooltip>
  );
}

// ─── Main toolbar ─────────────────────────────────────────────────────────────

export default function ReactorToolbar() {
  const addReactor     = useSimulatorStore((s) => s.addReactor);
  const addUnit        = useSimulatorStore((s) => s.addUnit);
  const addFeedNode    = useSimulatorStore((s) => s.addFeedNode);
  const addProductNode = useSimulatorStore((s) => s.addProductNode);
  const paramsOpen     = useSimulatorStore((s) => s.paramsOpen);
  const setParamsOpen  = useSimulatorStore((s) => s.setParamsOpen);

  const onDragStart = useCallback((event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const getClickPosition = useCallback((typeKey: string) => {
    const { nodes } = useSimulatorStore.getState();
    const sameType = nodes.filter(n => n.type === typeKey);
    const n = sameType.length;
    return { x: 260 + (n % 5) * 45, y: 340 + Math.floor(n / 5) * 80 };
  }, []);


  return (
    <div className="w-[68px] h-full bg-[#ffffff] border-r border-[#dde3f0]
                    flex flex-col items-center pt-3 pb-2 gap-1.5">

      {/* ── Reactors ──────────────────────────────── */}
      <CategoryGroup label="Reactors" color="#2563eb"
        icon={<ReactorsCatIcon open={false} />}>
        <NodeItem label="CSTR"  color="#2563eb" bg="#eff6ff" icon={<CstrIcon />}
          dragType="CSTR"     tooltip="CSTR · Continuous Stirred Tank Reactor · well-mixed, steady-state"
          onDragStart={onDragStart} onClick={() => addReactor('CSTR', getClickPosition('cstr'))} />
        <NodeItem label="PFR"  color="#d97706" bg="#fffbeb" icon={<PfrIcon />}
          dragType="PFR"      tooltip="PFR · Plug Flow Reactor · tubular, no axial mixing"
          onDragStart={onDragStart} onClick={() => addReactor('PFR', getClickPosition('pfr'))} />
        <NodeItem label="Batch" color="#be123c" bg="#fff1f2" icon={<BatchIcon />}
          dragType="Batch"    tooltip="Batch · Batch Reactor · closed vessel, time-based"
          onDragStart={onDragStart} onClick={() => addReactor('Batch', getClickPosition('batch'))} />
        <NodeItem label="SB"   color="#0369a1" bg="#e0f2fe" icon={<SemibatchIcon />}
          dragType="Semibatch" tooltip="SB · Semi-batch · continuous B feed into batch vessel"
          onDragStart={onDragStart} onClick={() => addReactor('Semibatch', getClickPosition('semibatch'))} />
        <NodeItem label="FB"   color="#7c2d12" bg="#fef3e2" icon={<FixedBedIcon />}
          dragType="FixedBed" tooltip="FB · Fixed-Bed Catalytic · W_cat basis, Ergun ΔP"
          onDragStart={onDragStart} onClick={() => addReactor('FixedBed', getClickPosition('fixedbed'))} />
      </CategoryGroup>

      {/* ── Separation ────────────────────────────── */}
      <CategoryGroup label="Separate" color="#0d9488"
        icon={<SeparationCatIcon open={false} />}>
        <NodeItem label="Flash"  color="#0d9488" bg="#f0fdfa" icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="6" width="16" height="12" rx="3" stroke="#0d9488" strokeWidth="1.5" fill="#f0fdfa" />
            <line x1="2"  y1="12" x2="4"  y2="12" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="20" y1="9"  x2="22" y2="9"  stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="20" y1="15" x2="22" y2="15" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M7 12 Q12 8 17 12" stroke="#0d9488" strokeWidth="1.2" fill="none" />
            <text x="7.5" y="17" fontSize="4.5" fill="#0d9488" fontFamily="monospace">V L</text>
          </svg>}
          dragType="Flash"  tooltip="Flash · VLE Flash Separator · Rachford-Rice, Antoine Psat"
          onDragStart={onDragStart} onClick={() => addUnit('Flash', getClickPosition('flash'))} />
        <NodeItem label="Purge"  color="#ea580c" bg="#fff7ed" icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <line x1="3"  y1="12" x2="10" y2="12" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="10" y1="12" x2="21" y2="6"  stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 1.5" />
            <line x1="10" y1="12" x2="21" y2="18" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="12" r="3" fill="#ea580c" />
            <text x="14" y="8" fontSize="4.5" fill="#ea580c" fontFamily="monospace">β</text>
          </svg>}
          dragType="Purge"  tooltip="Purge · β fraction vented, (1-β) to process"
          onDragStart={onDragStart} onClick={() => addUnit('Purge', getClickPosition('purge'))} />
        <NodeItem label="CSplit" color="#0891b2" bg="#ecfeff" icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <line x1="3"  y1="12" x2="10" y2="12" stroke="#0891b2" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="10" y1="12" x2="21" y2="6"  stroke="#0891b2" strokeWidth="2" strokeLinecap="round" />
            <line x1="10" y1="12" x2="21" y2="18" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="12" r="3" fill="#0891b2" />
            <text x="14" y="8"  fontSize="5" fill="#0891b2" fontFamily="monospace">A</text>
            <text x="14" y="20" fontSize="5" fill="#0891b2" fontFamily="monospace">B</text>
          </svg>}
          dragType="CSplit"  tooltip="CSplit · Component Splitter · per-species split fractions ξ_i"
          onDragStart={onDragStart} onClick={() => addUnit('CSplit', getClickPosition('csplit'))} />
        <NodeItem label="HX"     color="#dc2626" bg="#fff1f2" icon={
          <svg width="26" height="20" viewBox="0 0 26 20" fill="none">
            <rect x="1" y="5" width="24" height="10" rx="3" stroke="#dc2626" strokeWidth="1.5" fill="#fff1f2" />
            <path d="M7 0 L7 5 M7 15 L7 20"   stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M13 0 L13 5 M13 15 L13 20" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M19 0 L19 5 M19 15 L19 20" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 10 L8 10"  stroke="#dc2626" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M18 10 L23 10" stroke="#dc2626" strokeWidth="1.3" strokeLinecap="round" />
          </svg>}
          dragType="HX"      tooltip="HX · Heat Exchanger / Heater-Cooler · sets T_out or Q̇"
          onDragStart={onDragStart} onClick={() => addUnit('HX', getClickPosition('hx'))} />
      </CategoryGroup>

      {/* ── Pressure changers ─────────────────────── */}
      <CategoryGroup label="Pressure" color="#4f46e5"
        icon={<PressureCatIcon open={false} />}>
        <NodeItem label="Pump"  color="#1d4ed8" bg="#eff6ff" icon={
          <svg width="24" height="20" viewBox="0 0 24 20" fill="none">
            <circle cx="12" cy="10" r="8" stroke="#1d4ed8" strokeWidth="1.5" fill="#eff6ff" />
            <path d="M8 10 L16 10 M13 7 L16 10 L13 13" stroke="#1d4ed8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>}
          dragType="Pump"  tooltip="Pump · Liquid pump · W = Q_vol·ΔP/η"
          onDragStart={onDragStart} onClick={() => addUnit('Pump', getClickPosition('pump'))} />
        <NodeItem label="Comp"  color="#7c3aed" bg="#f5f3ff" icon={
          <svg width="24" height="20" viewBox="0 0 24 20" fill="none">
            <path d="M4 16 L12 4 L20 16 Z" stroke="#7c3aed" strokeWidth="1.5" fill="#f5f3ff" strokeLinejoin="round" />
            <line x1="12" y1="4" x2="12" y2="1" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="4"  y1="16" x2="2"  y2="16" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="20" y1="16" x2="22" y2="16" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" />
          </svg>}
          dragType="Comp"  tooltip="Comp · Gas compressor · isentropic work, raises P and T"
          onDragStart={onDragStart} onClick={() => addUnit('Comp', getClickPosition('comp'))} />
        <NodeItem label="Valve" color="#b45309" bg="#fffbeb" icon={
          <svg width="24" height="20" viewBox="0 0 24 20" fill="none">
            <polygon points="3,4 3,16 12,10" fill="#b45309" />
            <polygon points="21,4 21,16 12,10" fill="#b45309" />
            <line x1="1"  y1="10" x2="3"  y2="10" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="21" y1="10" x2="23" y2="10" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="12" y1="2"  x2="12" y2="10" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round" />
          </svg>}
          dragType="Valve" tooltip="Valve · Control valve · isenthalpic, drops P"
          onDragStart={onDragStart} onClick={() => addUnit('Valve', getClickPosition('valve'))} />
      </CategoryGroup>

      {/* ── Flow & I/O ────────────────────────────── */}
      <CategoryGroup label="Flow" color="#059669"
        icon={<FlowCatIcon open={false} />}>
        <NodeItem label="Mixer"  color="#059669" bg="#ecfdf5" icon={<MixerIcon />}
          dragType="Mixer"    tooltip="Mixer · Flow combiner · merges 2+ streams"
          onDragStart={onDragStart} onClick={() => addUnit('Mixer', getClickPosition('mixer'))} />
        <NodeItem label="Split"  color="#7c3aed" bg="#f5f3ff" icon={<SplitterIcon />}
          dragType="Splitter" tooltip="Split · Flow splitter · splits by fraction α"
          onDragStart={onDragStart} onClick={() => addUnit('Splitter', getClickPosition('splitter'))} />
        <NodeItem label="Feed"   color="#6b7280" bg="#f9fafb" icon={<FeedIcon />}
          dragType="Feed"     tooltip="Feed · Feed node · additional inlet stream"
          onDragStart={onDragStart} onClick={() => addFeedNode(getClickPosition('feed'))} />
        <NodeItem label="Product" color="#16a34a" bg="#f0fdf4" icon={<ProductIcon />}
          dragType="Product"  tooltip="Product · Product node · additional outlet stream"
          onDragStart={onDragStart} onClick={() => addProductNode(getClickPosition('product'))} />
      </CategoryGroup>

      {/* ── Spacer ────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Settings ──────────────────────────────── */}
      <div className="flex flex-col items-center w-full gap-0.5 px-1 pb-2">
        <button
          data-params-trigger
          onClick={() => setParamsOpen(!paramsOpen)}
          title="Global parameters"
          className="flex flex-col items-center gap-0.5 w-full py-1.5 rounded-md transition-colors"
          style={{ background: paramsOpen ? '#eff6ff' : 'transparent' }}
        >
          <Settings size={14} color={paramsOpen ? '#2563eb' : '#374151'} />
          <span style={{ fontSize: 7.5, color: paramsOpen ? '#2563eb' : '#6b7280', fontWeight: 500 }}>
            Params
          </span>
        </button>
      </div>
    </div>
  );
}
