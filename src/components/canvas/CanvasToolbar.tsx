import { memo, useState } from 'react';
import { Save, FolderOpen, BookOpen, Download, Undo2, Redo2, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useSaveFile, useLoadFile, useLoadExample } from '../../hooks/useFileIO';
import { useExport } from '../../hooks/useExport';
import { useExportCantera, useImportCantera } from '../../hooks/useInterop';
import { EXAMPLES } from '../../io/examples';
import { useSimulatorStore } from '../../store/simulatorStore';

function ToolBtn({
  onClick,
  title,
  disabled,
  active,
  children,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
        borderRadius: 5, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 11, color: disabled ? '#b0b7c3' : '#374151',
        background: active ? '#eff6ff' : 'none', opacity: disabled ? 0.45 : 1,
        fontWeight: 500, transition: 'background 0.1s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { if (!disabled && !active) e.currentTarget.style.background = '#f1f5f9'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'none'; }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: '#dde3f0', flexShrink: 0 }} />;
}

function CanvasToolbar() {
  const { isDark, toggle: toggleTheme } = useTheme();
  const undo        = useSimulatorStore((s) => s.undo);
  const redo        = useSimulatorStore((s) => s.redo);
  const viewMode    = useSimulatorStore((s) => s.viewMode);
  const setViewMode = useSimulatorStore((s) => s.setViewMode);
  const handleSave        = useSaveFile();
  const handleLoad        = useLoadFile();
  const handleLoadExample = useLoadExample();
  const { exportPng, exportCsv, exportReport, hasResult } = useExport();
  const exportCantera = useExportCantera();
  const importCantera = useImportCantera();
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [exportOpen,   setExportOpen]   = useState(false);

  return (
    <div
      style={{
        height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2,
        padding: '0 6px', background: '#ffffff', borderBottom: '1px solid #dde3f0',
      }}
    >
      <ToolBtn onClick={handleSave} title="Save flowsheet (Ctrl+S)">
        <Save size={12} /> Save
      </ToolBtn>

      <ToolBtn onClick={handleLoad} title="Load flowsheet">
        <FolderOpen size={12} /> Load
      </ToolBtn>

      {/* Examples dropdown */}
      <div style={{ position: 'relative' }}>
        <ToolBtn onClick={() => setExamplesOpen(v => !v)} title="Load example" active={examplesOpen}>
          <BookOpen size={12} /> Examples
        </ToolBtn>
        {examplesOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 199 }}
              onClick={() => setExamplesOpen(false)}
            />
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
              background: '#ffffff', border: '1px solid #dde3f0', borderRadius: 8,
              boxShadow: '0 6px 20px rgba(0,0,0,0.13)', padding: 8, minWidth: 230,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6, paddingLeft: 4 }}>
                Examples
              </div>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => { handleLoadExample(ex); setExamplesOpen(false); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '5px 8px', borderRadius: 5,
                    border: 'none', background: 'none', cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#0f1730' }}>{ex.name}</div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>{ex.description}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Export dropdown */}
      <div style={{ position: 'relative' }}>
        <ToolBtn onClick={() => setExportOpen(v => !v)} title="Export" disabled={!hasResult} active={exportOpen}>
          <Download size={12} /> Export
        </ToolBtn>
        {exportOpen && hasResult && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 199 }}
              onClick={() => setExportOpen(false)}
            />
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
              background: '#ffffff', border: '1px solid #dde3f0', borderRadius: 8,
              boxShadow: '0 6px 20px rgba(0,0,0,0.13)', padding: '4px 0', minWidth: 165,
            }}>
              {([
                { label: 'PNG — Flowsheet',       action: () => { exportPng();      setExportOpen(false); } },
                { label: 'CSV — Streams',         action: () => { exportCsv();      setExportOpen(false); } },
                { label: 'Report (PDF)',           action: () => { exportReport();   setExportOpen(false); } },
                { label: 'Cantera YAML — Export',  action: () => { exportCantera();  setExportOpen(false); } },
                { label: 'Cantera YAML — Import',  action: () => { importCantera();  setExportOpen(false); } },
              ] as { label: string; action: () => void }[]).map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    width: '100%', textAlign: 'left', padding: '6px 12px',
                    border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: 12, color: '#0f1730',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdf4'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <Divider />

      <ToolBtn onClick={undo} title="Undo (Ctrl+Z)">
        <Undo2 size={12} /> Undo
      </ToolBtn>

      <ToolBtn onClick={redo} title="Redo (Ctrl+Shift+Z)">
        <Redo2 size={12} /> Redo
      </ToolBtn>

      <Divider />

      <ToolBtn
        onClick={() => setViewMode(viewMode === 'pfd' ? 'schematic' : 'pfd')}
        title={viewMode === 'pfd' ? 'Switch to Schematic view' : 'Switch to PFD view'}
        active={viewMode === 'pfd'}
      >
        {viewMode === 'pfd' ? '← Schematic' : 'PFD Mode →'}
      </ToolBtn>

      {/* Push dark mode toggle to the right */}
      <div style={{ flex: 1 }} />

      <ToolBtn onClick={toggleTheme} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
        {isDark ? <Sun size={12} /> : <Moon size={12} />}
        {isDark ? 'Light' : 'Dark'}
      </ToolBtn>
    </div>
  );
}

export default memo(CanvasToolbar);
