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
import SelectivityPanel from './components/panels/SelectivityPanel';
import DesignSpecsPanel from './components/panels/DesignSpecsPanel';
import RTDPanel from './components/plots/RTDPanel';
import { useSimulatorStore } from './store/simulatorStore';
import { useClipboardActions } from './hooks/useClipboardActions';
import { useDynamicSimulation } from './hooks/useDynamicSimulation';
import { useTheme } from './hooks/useTheme';
import { serializeState, deserializeState } from './io/serializer';
import Toaster from './components/Toaster';

const LS_KEY = 'reaction-simulator-v1';

// 4 primary tabs (collapsed from 7)
type RightTab = 'results' | 'dynamic' | 'analysis' | 'design';
type ResultsView = 'levenspiel' | 'profiles' | 'thermal';
type DesignView  = 'specs' | 'scenarios';

function normalizeRightTab(s: string): RightTab {
  if (s === 'dynamic' || s === 'analysis') return s as RightTab;
  if (s === 'results' || s === 'levenspiel' || s === 'profiles' || s === 'thermal') return 'results';
  if (s === 'design' || s === 'scenarios') return 'design';
  return 'results';
}

function initialResultsView(stored: string): ResultsView {
  if (stored === 'profiles') return 'profiles';
  if (stored === 'thermal')  return 'thermal';
  return 'levenspiel';
}

export default function App() {
  useTheme();
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
  const storeRightTab        = useSimulatorStore((s) => s.rightTab);
  const setStoreRightTab     = useSimulatorStore((s) => s.setRightTab);
  const { copySelected, paste, cut, duplicate } = useClipboardActions();
  const dynamic = useDynamicSimulation();

  const rightTab    = normalizeRightTab(storeRightTab);
  const setRightTab = (t: RightTab) => setStoreRightTab(t);

  // Sub-view state within tabs
  const [resultsView, setResultsView] = useState<ResultsView>(() => initialResultsView(storeRightTab));
  const [designView,  setDesignView]  = useState<DesignView>('specs');

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mainTabs: { id: RightTab; label: string }[] = [
    { id: 'results',  label: 'Results'  },
    { id: 'dynamic',  label: 'Dynamic'  },
    { id: 'analysis', label: 'Analysis' },
    { id: 'design',   label: 'Design'   },
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
      // localStorage unavailable
    }
  }, [setNodes, setEdges, updateParams, setSimulationMode, addToast]);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, serializeState(nodes, edges, params, simulationMode));
      } catch { /* quota exceeded */ }
    }, 300);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [nodes, edges, params, simulationMode]);

  // ── Tab bar shared style ──────────────────────────────────────────────────────
  const tabStyle = (id: RightTab): React.CSSProperties => ({
    flex: 1,
    padding: '7px 4px',
    fontSize: 11,
    fontWeight: 500,
    color: rightTab === id ? 'var(--text-primary)' : 'var(--text-secondary)',
    borderBottom: rightTab === id ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'none',
    border: 'none',
    borderBottomStyle: 'solid',
    borderBottomWidth: 2,
    borderBottomColor: rightTab === id ? 'var(--accent)' : 'transparent',
    cursor: 'pointer',
    transition: 'color .12s',
    whiteSpace: 'nowrap',
  });

  return (
    <div className="h-full min-w-[1280px] flex flex-col" style={{ background: 'var(--bg-app)' }}>
      <div className="flex flex-1 min-h-0">
        <ReactorToolbar />

        <div className="flex-1 flex flex-col min-w-0">
          <ParameterPanel />
          <div className="flex-1 min-h-0">
            <ReactorCanvas />
          </div>
        </div>

        {/* ── Right panel ───────────────────────────────────────────────────── */}
        <div
          className="w-[420px] flex flex-col shrink-0 overflow-hidden"
          style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg-surface)' }}
        >
          {/* Tab bar — 4 primary tabs (hidden when node inspector is open) */}
          {!propertiesNodeId && (
            <div
              className="flex shrink-0 rsi-tab-bar"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
            >
              {mainTabs.map((tab) => (
                <button key={tab.id} onClick={() => setRightTab(tab.id)} style={tabStyle(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Tab content area ─────────────────────────────────────────────── */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

            {/* Node inspector (takes over the panel) */}
            {propertiesNodeId && (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <PropertiesPanel onClose={() => setPropertiesNodeId(null)} />
              </div>
            )}

            {/* ── Results tab ──────────────────────────────────────────────── */}
            {!propertiesNodeId && rightTab === 'results' && (
              <div className="flex flex-col flex-1 min-h-0">
                {/* Sub-view segmented control */}
                <div
                  className="flex items-center px-3 py-2 shrink-0"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <div className="seg-ctrl">
                    {(['levenspiel', 'profiles', 'thermal'] as ResultsView[]).map((v) => (
                      <button
                        key={v}
                        className={resultsView === v ? 'active' : ''}
                        onClick={() => setResultsView(v)}
                      >
                        {v === 'levenspiel' ? 'Levenspiel' : v === 'profiles' ? 'Profiles' : 'Thermal'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Plot area */}
                <div className="flex-1 min-h-0">
                  {resultsView === 'levenspiel' && <LevenspielPlot />}
                  {resultsView === 'thermal'    && <OperatingDiagram />}
                  {resultsView === 'profiles' && (
                    reactionMode === 'single' ? (
                      <div className="flex flex-col h-full">
                        <div className="h-1/2 border-b" style={{ borderColor: 'var(--border)' }}>
                          <ConversionProfile />
                        </div>
                        <div className="h-1/2">
                          <TemperatureProfile />
                        </div>
                      </div>
                    ) : (
                      <SpeciesProfile />
                    )
                  )}
                </div>
              </div>
            )}

            {/* ── Dynamic tab ──────────────────────────────────────────────── */}
            {!propertiesNodeId && rightTab === 'dynamic' && (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="h-[55%] border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
                  <DynamicResponse
                    history={dynamic.history}
                    tCurrent={dynamic.t}
                    disturbanceLog={dynamic.disturbanceLog}
                  />
                </div>
                <div className="flex-1">
                  <PhasePortrait selectedNodeId={selectedNodeId} cstrHistory={dynamic.cstrHistory} />
                </div>
              </div>
            )}

            {/* ── Analysis tab ─────────────────────────────────────────────── */}
            {!propertiesNodeId && rightTab === 'analysis' && (
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <RecyclePanel />
                <SelectivityPanel />
                <RTDPanel />
                <div className="flex-1 min-h-0 overflow-hidden">
                  <SweepPanel />
                </div>
              </div>
            )}

            {/* ── Design tab — Specs / Scenarios sub-tabs ───────────────────── */}
            {!propertiesNodeId && rightTab === 'design' && (
              <div className="flex flex-col flex-1 min-h-0">
                {/* Sub-view segmented control */}
                <div
                  className="flex items-center px-3 py-2 shrink-0"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <div className="seg-ctrl">
                    {(['specs', 'scenarios'] as DesignView[]).map((v) => (
                      <button
                        key={v}
                        className={designView === v ? 'active' : ''}
                        onClick={() => setDesignView(v)}
                      >
                        {v === 'specs' ? 'Design Specs' : 'Scenarios'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  {designView === 'specs'      && <DesignSpecsPanel />}
                  {designView === 'scenarios'  && <ScenariosPanel />}
                </div>
              </div>
            )}
          </div>

          {/* ── Stream table — always docked at panel bottom ─────────────────── */}
          {!propertiesNodeId && rightTab !== 'dynamic' && (
            <div className="shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              <StreamTablePanel />
            </div>
          )}
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
