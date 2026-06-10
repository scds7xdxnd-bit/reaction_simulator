import { useState, useEffect, useRef } from 'react';
import ReactorToolbar from './components/controls/ReactorToolbar';
import ParameterPanel from './components/controls/ParameterPanel';
import ReactorCanvas from './components/canvas/ReactorCanvas';
import LevenspielPlot from './components/plots/LevenspielPlot';
import ConversionProfile from './components/plots/ConversionProfile';
import SpeciesProfile from './components/plots/SpeciesProfile';
import TemperatureProfile from './components/plots/TemperatureProfile';
import OperatingDiagram from './components/plots/OperatingDiagram';
import DynamicResponse from './components/plots/DynamicResponse';
import PhasePortrait from './components/plots/PhasePortrait';
import SweepPanel from './components/plots/SweepPanel';
import RecyclePanel from './components/plots/RecyclePanel';
import StreamTablePanel from './components/panels/StreamTablePanel';
import ScenariosPanel from './components/panels/ScenariosPanel';
import StatusBar from './components/StatusBar';
import DynamicControls from './components/controls/DynamicControls';
import ShortcutsModal from './components/ShortcutsModal';
import OnboardingTour, { shouldShowTour } from './components/OnboardingTour';
import ParameterPopover from './components/controls/ParameterPopover';
import PropertiesPanel from './components/panels/PropertiesPanel';
import { useSimulatorStore } from './store/simulatorStore';
import { useClipboardActions } from './hooks/useClipboardActions';
import { useDynamicSimulation } from './hooks/useDynamicSimulation';
import { useTheme } from './hooks/useTheme';
import { serializeState, deserializeState } from './io/serializer';
import Toaster from './components/Toaster';

const LS_KEY = 'reaction-simulator-v1';

type RightTab = 'levenspiel' | 'profiles' | 'thermal' | 'dynamic' | 'analysis' | 'scenarios';

export default function App() {
  useTheme(); // initialize dark class on <html> from system/localStorage
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showTour, setShowTour] = useState(() => shouldShowTour());
  const reactionMode = useSimulatorStore((s) => s.params.reactionMode);
  const simulationMode = useSimulatorStore((s) => s.simulationMode);
  const setSimulationMode = useSimulatorStore((s) => s.setSimulationMode);
  const undo = useSimulatorStore((s) => s.undo);
  const redo = useSimulatorStore((s) => s.redo);
  const selectedNodeId = useSimulatorStore((s) => s.selectedNodeId);
  const nodes        = useSimulatorStore((s) => s.nodes);
  const edges        = useSimulatorStore((s) => s.edges);
  const params       = useSimulatorStore((s) => s.params);
  const setNodes     = useSimulatorStore((s) => s.setNodes);
  const setEdges     = useSimulatorStore((s) => s.setEdges);
  const updateParams = useSimulatorStore((s) => s.updateParams);
  const addToast     = useSimulatorStore((s) => s.addToast);
  const closeMenu       = useSimulatorStore((s) => s.closeMenu);
  const closeCanvasMenu = useSimulatorStore((s) => s.closeCanvasMenu);
  const setParamsOpen        = useSimulatorStore((s) => s.setParamsOpen);
  const propertiesNodeId     = useSimulatorStore((s) => s.propertiesNodeId);
  const setPropertiesNodeId  = useSimulatorStore((s) => s.setPropertiesNodeId);
  const { copySelected, paste, cut, duplicate } = useClipboardActions();
  const dynamic = useDynamicSimulation();

  const [rightTab, setRightTab] = useState<RightTab>('levenspiel');

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tabs: { id: RightTab; label: string }[] = [
    { id: 'levenspiel', label: 'Levenspiel' },
    { id: 'profiles', label: 'Profiles' },
    { id: 'thermal', label: 'Thermal' },
    { id: 'dynamic', label: 'Dynamic' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'scenarios', label: 'Scenarios' },
  ];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const inInput = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
      if (e.key === '?' && !inInput) { setShowShortcuts((v) => !v); return; }
      if (e.key === 'Escape') { closeMenu(); closeCanvasMenu(); setShowShortcuts(false); setParamsOpen(false); return; }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !inInput) {
        const { edges: cur, setEdges: se } = useSimulatorStore.getState();
        if (cur.some(ed => ed.selected)) {
          e.preventDefault();
          se(cur.filter(ed => !ed.selected));
          return;
        }
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const t = e.target as HTMLElement;
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
        const { nodes: cur, setNodes: sn } = useSimulatorStore.getState();
        if (!cur.some(n => n.selected)) return;
        e.preventDefault();
        const step = e.shiftKey ? 1 : 10;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0;
        sn(cur.map(n =>
          n.selected
            ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy }, data: { ...n.data } }
            : n
        ));
        return;
      }

      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo(); }
      if (key === 'c' && !e.shiftKey) { e.preventDefault(); copySelected(); }
      if (key === 'v') { e.preventDefault(); paste(); }
      if (key === 'x') { e.preventDefault(); cut(); }
      if (key === 'd') { e.preventDefault(); duplicate(); }
      if (key === 'a') {
        e.preventDefault();
        const { nodes: cur, setNodes: sn } = useSimulatorStore.getState();
        sn(cur.map(n => ({ ...n, selected: true, data: { ...n.data } })));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, copySelected, paste, cut, duplicate, closeMenu, closeCanvasMenu, setParamsOpen]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const state = deserializeState(raw);
      if (!state) return;
      setNodes(state.nodes);
      setEdges(state.edges);
      updateParams(state.params);
      setSimulationMode(state.mode);
      addToast('info', 'Session restored from last save.');
    } catch {
      // localStorage unavailable (private mode, storage errors)
    }
  }, [setNodes, setEdges, updateParams, setSimulationMode, addToast]);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, serializeState(nodes, edges, params, simulationMode));
      } catch {
        // storage quota exceeded or unavailable
      }
    }, 300);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [nodes, edges, params, simulationMode]);

  return (
    <div className="h-full min-w-[1280px] flex flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-1 min-h-0">
        <ReactorToolbar />

        <div className="flex-1 flex flex-col min-w-0">
          <ParameterPanel />
          <div className="flex-1 min-h-0">
            <ReactorCanvas />
          </div>
        </div>

        <div className="w-[420px] flex flex-col shrink-0 overflow-hidden" style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg)' }}>
          {!propertiesNodeId && (
            <div className="flex gap-0 shrink-0 rsi-tab-bar" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRightTab(tab.id)}
                  className="flex-1 text-[11px] font-medium py-2 transition-colors"
                  style={{
                    color: rightTab === tab.id ? '#2563eb' : 'var(--text-muted)',
                    borderBottom: rightTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                    background: rightTab === tab.id ? 'var(--surface-raised)' : 'var(--surface)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {propertiesNodeId && (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <PropertiesPanel onClose={() => setPropertiesNodeId(null)} />
              </div>
            )}
            {!propertiesNodeId && rightTab === 'levenspiel' && (
              <div className="h-[55%] border-b border-[#dde3f0] shrink-0">
                <div className="h-full">
                  <LevenspielPlot />
                </div>
              </div>
            )}
            {!propertiesNodeId && rightTab === 'profiles' && (
              <>
                {reactionMode === 'single' ? (
                  <>
                    <div className="h-[47%] border-b border-[#dde3f0] shrink-0">
                      <ConversionProfile />
                    </div>
                    <div className="h-[47%] shrink-0">
                      <TemperatureProfile />
                    </div>
                  </>
                ) : (
                  <div className="flex-1">
                    <SpeciesProfile />
                  </div>
                )}
              </>
            )}
            {!propertiesNodeId && rightTab === 'thermal' && (
              <div className="flex-1">
                <OperatingDiagram />
              </div>
            )}
            {!propertiesNodeId && rightTab === 'dynamic' && (
              <>
                <div className="h-[55%] border-b border-[#dde3f0] shrink-0">
                  <DynamicResponse
                    history={dynamic.history}
                    tCurrent={dynamic.t}
                    disturbanceLog={dynamic.disturbanceLog}
                  />
                </div>
                <div className="flex-1">
                  <PhasePortrait
                    selectedNodeId={selectedNodeId}
                    cstrHistory={dynamic.cstrHistory}
                  />
                </div>
              </>
            )}
            {!propertiesNodeId && rightTab === 'analysis' && (
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <RecyclePanel />
                <div className="flex-1 min-h-0 overflow-hidden">
                  <SweepPanel />
                </div>
              </div>
            )}
            {!propertiesNodeId && rightTab === 'scenarios' && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <ScenariosPanel />
              </div>
            )}
            {!propertiesNodeId && rightTab !== 'dynamic' && rightTab !== 'analysis' && rightTab !== 'scenarios' && (
              <div className="shrink-0">
                <StreamTablePanel />
              </div>
            )}
          </div>
        </div>
      </div>

      {simulationMode === 'dynamic' ? (
        <DynamicControls
          isRunning={dynamic.isRunning}
          t={dynamic.t}
          speed={dynamic.speed}
          onPlay={dynamic.play}
          onPause={dynamic.pause}
          onReset={dynamic.reset}
          onSetSpeed={dynamic.setSpeed}
          onApplyDisturbance={dynamic.applyDisturbance}
        />
      ) : (
        <StatusBar />
      )}
      <Toaster />
      <ParameterPopover />
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showTour && <OnboardingTour onDone={() => setShowTour(false)} />}
    </div>
  );
}
