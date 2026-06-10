import { useCallback, useState } from 'react';
import { Save, FolderOpen, BookOpen, Download, Settings } from 'lucide-react';
import { useSaveFile, useLoadFile, useLoadExample } from '../../hooks/useFileIO';
import { useExport } from '../../hooks/useExport';
import { EXAMPLES } from '../../io/examples';
import { Divider } from '../ui';
import { useSimulatorStore } from '../../store/simulatorStore';

function CstrIcon() {
  return (
    <svg width="26" height="28" viewBox="0 0 26 28" fill="none">
      <path d="M2 2 H24 V18 Q13 27 2 18 Z"
        stroke="#2563eb" strokeWidth="1.5" fill="#eff6ff" strokeLinejoin="round" />
      <line x1="13" y1="2" x2="13" y2="16" stroke="#2563eb" strokeWidth="1.3" />
      <line x1="7" y1="16" x2="19" y2="16" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
      <line x1="7" y1="13" x2="19" y2="13" stroke="#2563eb" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function PfrIcon() {
  return (
    <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
      <path d="M5 1 H23 Q28 1 28 8 Q28 15 23 15 H5 Q0 15 0 8 Q0 1 5 1 Z"
        stroke="#d97706" strokeWidth="1.5" fill="#fffbeb" />
      <path d="M5 5 L10 8 L5 11 Z" fill="#d97706" />
      <path d="M13 5 L18 8 L13 11 Z" fill="#d97706" />
    </svg>
  );
}

function BatchIcon() {
  return (
    <svg width="22" height="28" viewBox="0 0 22 28" fill="none">
      <path d="M8 2 H14 V10 L20 22 Q22 28 11 28 Q0 28 2 22 L8 10 Z"
        stroke="#be123c" strokeWidth="1.5" fill="#fff1f2" strokeLinejoin="round" />
      <path d="M4 22 Q11 20 18 22"
        stroke="#be123c" strokeWidth="1.2" strokeDasharray="2 1.5" />
    </svg>
  );
}

function SemibatchIcon() {
  return (
    <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
      <path d="M8 2 H14 V10 L20 22 Q22 28 12 28 Q2 28 4 22 L10 10 Z"
        stroke="#0369a1" strokeWidth="1.5" fill="#e0f2fe" strokeLinejoin="round" />
      <path d="M4 22 Q12 20 20 22"
        stroke="#0369a1" strokeWidth="1.2" strokeDasharray="2 1.5" />
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

export default function ReactorToolbar() {
  const addReactor     = useSimulatorStore((s) => s.addReactor);
  const addUnit        = useSimulatorStore((s) => s.addUnit);
  const addFeedNode    = useSimulatorStore((s) => s.addFeedNode);
  const addProductNode = useSimulatorStore((s) => s.addProductNode);
  const paramsOpen     = useSimulatorStore((s) => s.paramsOpen);
  const setParamsOpen  = useSimulatorStore((s) => s.setParamsOpen);

  const onDragStart = useCallback(
    (event: React.DragEvent, nodeType: string) => {
      event.dataTransfer.setData('application/reactflow', nodeType);
      event.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  const getClickPosition = useCallback((typeKey: string) => {
    const { nodes } = useSimulatorStore.getState();
    const sameType = nodes.filter(n => n.type === typeKey);
    const n = sameType.length;
    return { x: 260 + (n % 5) * 45, y: 340 + Math.floor(n / 5) * 80 };
  }, []);

  const handleSave        = useSaveFile();
  const handleLoad        = useLoadFile();
  const handleLoadExample = useLoadExample();
  const { exportPng, exportCsv, exportReport, hasResult } = useExport();
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="w-[72px] h-full bg-[#ffffff] border-r border-[#dde3f0] flex flex-col items-center pt-2 gap-2 pb-2">
      <div
        className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(e) => onDragStart(e, 'CSTR')}
        onClick={() => addReactor('CSTR', getClickPosition('cstr'))}
        title="CSTR — click to add, or drag to position"
        style={{ width: 48 }}
      >
        <div
          className="flex items-center justify-center rounded-md border"
          style={{
            width: 44,
            height: 44,
            borderColor: '#2563eb',
            background: '#eff6ff',
          }}
        >
          <CstrIcon />
        </div>
        <span className="text-[10px] font-medium text-[#2563eb] uppercase tracking-wider">
          CSTR
        </span>
      </div>

      <div
        className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(e) => onDragStart(e, 'PFR')}
        onClick={() => addReactor('PFR', getClickPosition('pfr'))}
        title="PFR — click to add, or drag to position"
        style={{ width: 48 }}
      >
        <div
          className="flex items-center justify-center rounded-md border"
          style={{
            width: 44,
            height: 44,
            borderColor: '#d97706',
            background: '#fffbeb',
          }}
        >
          <PfrIcon />
        </div>
        <span className="text-[10px] font-medium text-[#d97706] uppercase tracking-wider">
          PFR
        </span>
      </div>

      <div
        className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(e) => onDragStart(e, 'Batch')}
        onClick={() => addReactor('Batch', getClickPosition('batch'))}
        title="Batch — click to add, or drag to position"
        style={{ width: 48 }}
      >
        <div
          className="flex items-center justify-center rounded-md border"
          style={{ width: 44, height: 44, borderColor: '#be123c', background: '#fff1f2' }}
        >
          <BatchIcon />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#be123c' }}>
          Batch
        </span>
      </div>

      <div
        className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(e) => onDragStart(e, 'Semibatch')}
        onClick={() => addReactor('Semibatch', getClickPosition('semibatch'))}
        title="Semi-batch — click to add, or drag to position"
        style={{ width: 48 }}
      >
        <div
          className="flex items-center justify-center rounded-md border"
          style={{ width: 44, height: 44, borderColor: '#0369a1', background: '#e0f2fe' }}
        >
          <SemibatchIcon />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#0369a1' }}>
          S-Batch
        </span>
      </div>

      <div
        className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(e) => onDragStart(e, 'FixedBed')}
        onClick={() => addReactor('FixedBed', getClickPosition('fixedbed'))}
        title="Fixed-bed — click to add, or drag to position"
        style={{ width: 48 }}
      >
        <div
          className="flex items-center justify-center rounded-md border"
          style={{ width: 44, height: 44, borderColor: '#7c2d12', background: '#fef3e2' }}
        >
          <FixedBedIcon />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#7c2d12' }}>
          F-Bed
        </span>
      </div>

      <div
        className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(e) => onDragStart(e, 'Mixer')}
        onClick={() => addUnit('Mixer', getClickPosition('mixer'))}
        title="Mixer — click to add, or drag to position"
        style={{ width: 48 }}
      >
        <div
          className="flex items-center justify-center rounded-md border"
          style={{
            width: 44,
            height: 44,
            borderColor: '#059669',
            background: '#ecfdf5',
          }}
        >
          <MixerIcon />
        </div>
        <span className="text-[10px] font-medium text-[#059669] uppercase tracking-wider">
          Mixer
        </span>
      </div>

      <div
        className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(e) => onDragStart(e, 'Splitter')}
        onClick={() => addUnit('Splitter', getClickPosition('splitter'))}
        title="Splitter — click to add, or drag to position"
        style={{ width: 48 }}
      >
        <div
          className="flex items-center justify-center rounded-md border"
          style={{
            width: 44,
            height: 44,
            borderColor: '#7c3aed',
            background: '#f5f3ff',
          }}
        >
          <SplitterIcon />
        </div>
        <span className="text-[10px] font-medium text-[#7c3aed] uppercase tracking-wider">
          Split
        </span>
      </div>

      <Divider className="w-12" />

      <button
        data-params-trigger
        onClick={() => setParamsOpen(!paramsOpen)}
        title="Parameters"
        className="flex flex-col items-center gap-0.5 w-12 py-1 rounded-md transition-colors"
        style={{ background: paramsOpen ? '#eff6ff' : 'transparent' }}
      >
        <div className="flex items-center justify-center rounded-md border"
          style={{ width: 44, height: 36, borderColor: paramsOpen ? '#2563eb' : '#dde3f0', background: paramsOpen ? '#eff6ff' : 'var(--surface)' }}>
          <Settings size={18} color={paramsOpen ? '#2563eb' : '#374151'} />
        </div>
        <span style={{ fontSize: 9, color: paramsOpen ? '#2563eb' : '#6b7280', fontWeight: 500 }}>Params</span>
      </button>

      <Divider className="w-12" />

      <div
        className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(e) => onDragStart(e, 'Feed')}
        onClick={() => addFeedNode(getClickPosition('feed'))}
        title="Feed — click to add, or drag to position"
        style={{ width: 48 }}
      >
        <div
          className="flex items-center justify-center rounded-md border"
          style={{ width: 44, height: 44, borderColor: '#6b7280', background: '#f9fafb' }}
        >
          <FeedIcon />
        </div>
        <span className="text-[10px] font-medium text-[#6b7280] uppercase tracking-wider">
          Feed
        </span>
      </div>

      <div
        className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(e) => onDragStart(e, 'Product')}
        onClick={() => addProductNode(getClickPosition('product'))}
        title="Product — click to add, or drag to position"
        style={{ width: 48 }}
      >
        <div
          className="flex items-center justify-center rounded-md border"
          style={{ width: 44, height: 44, borderColor: '#16a34a', background: '#f0fdf4' }}
        >
          <ProductIcon />
        </div>
        <span className="text-[10px] font-medium text-[#16a34a] uppercase tracking-wider">
          Product
        </span>
      </div>

      <div className="mt-auto" />
      <Divider className="w-12 mb-1" />

      <button
        onClick={handleSave}
        title="Save flowsheet"
        className="flex flex-col items-center gap-0.5 w-16 py-1.5 rounded-md
                   hover:bg-[#f1f5f9] transition-colors"
      >
        <Save size={16} color="#374151" />
        <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 500 }}>Save</span>
      </button>

      <button
        onClick={handleLoad}
        title="Load flowsheet"
        className="flex flex-col items-center gap-0.5 w-16 py-1.5 rounded-md
                   hover:bg-[#f1f5f9] transition-colors"
      >
        <FolderOpen size={16} color="#374151" />
        <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 500 }}>Load</span>
      </button>

      <div style={{ position: 'relative' }} className="mb-4">
        <button
          onClick={() => setExamplesOpen((v) => !v)}
          title="Load example"
          className="flex flex-col items-center gap-0.5 w-16 py-1.5 rounded-md
                     hover:bg-[#f1f5f9] transition-colors"
          style={examplesOpen ? { background: '#eff6ff' } : {}}
        >
          <BookOpen size={16} color="#374151" />
          <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 500 }}>Examples</span>
        </button>

        {examplesOpen && (
          <div
            style={{
              position: 'absolute',
              left: 52,
              bottom: 0,
              background: '#fff',
              border: '1px solid #dde3f0',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              padding: 8,
              minWidth: 210,
              zIndex: 100,
            }}
          >
            <div className="text-[11px] font-semibold text-[#374151] mb-2 px-1">Examples</div>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                onClick={() => { handleLoadExample(ex); setExamplesOpen(false); }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-[#eff6ff]"
              >
                <div className="text-[12px] font-medium text-[#0f1730]">{ex.name}</div>
                <div className="text-[10px] text-[#6b7280]">{ex.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }} className="mb-2">
        <button
          onClick={() => setExportOpen((v) => !v)}
          title="Export"
          disabled={!hasResult}
          className="flex flex-col items-center gap-0.5 w-16 py-1.5 rounded-md
                     hover:bg-[#f1f5f9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={exportOpen ? { background: '#f0fdf4' } : {}}
        >
          <Download size={16} color="#374151" />
          <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 500 }}>Export</span>
        </button>

        {exportOpen && hasResult && (
          <div
            style={{
              position: 'absolute',
              left: 52,
              bottom: 0,
              zIndex: 50,
              background: '#ffffff',
              border: '1px solid #dde3f0',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              minWidth: 140,
              padding: '4px 0',
            }}
          >
            {[
              { label: 'PNG — Flowsheet', action: () => { exportPng(); setExportOpen(false); } },
              { label: 'CSV — Streams', action: () => { exportCsv(); setExportOpen(false); } },
              { label: 'Report (PDF)', action: () => { exportReport(); setExportOpen(false); } },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f0fdf4] text-[12px] text-[#0f1730]"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
