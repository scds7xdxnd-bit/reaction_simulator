import { useState, useEffect } from 'react';
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
import StreamTable from './components/StreamTable';
import StatusBar from './components/StatusBar';
import DynamicControls from './components/controls/DynamicControls';
import { useSimulatorStore } from './store/simulatorStore';
import { useClipboardActions } from './hooks/useClipboardActions';
import { useDynamicSimulation } from './hooks/useDynamicSimulation';

type RightTab = 'levenspiel' | 'profiles' | 'thermal' | 'dynamic';

export default function App() {
  const reactionMode = useSimulatorStore((s) => s.params.reactionMode);
  const simulationMode = useSimulatorStore((s) => s.simulationMode);
  const setSimulationMode = useSimulatorStore((s) => s.setSimulationMode);
  const undo = useSimulatorStore((s) => s.undo);
  const redo = useSimulatorStore((s) => s.redo);
  const selectedNodeId = useSimulatorStore((s) => s.selectedNodeId);
  const { copySelected, paste, cut, duplicate } = useClipboardActions();
  const dynamic = useDynamicSimulation();

  const [rightTab, setRightTab] = useState<RightTab>('levenspiel');

  const tabs: { id: RightTab; label: string }[] = [
    { id: 'levenspiel', label: 'Levenspiel' },
    { id: 'profiles', label: 'Profiles' },
    { id: 'thermal', label: 'Thermal' },
    { id: 'dynamic', label: 'Dynamic' },
  ];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo(); }
      if (key === 'c' && !e.shiftKey) { e.preventDefault(); copySelected(); }
      if (key === 'v') { e.preventDefault(); paste(); }
      if (key === 'x') { e.preventDefault(); cut(); }
      if (key === 'd') { e.preventDefault(); duplicate(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, copySelected, paste, cut, duplicate]);

  return (
    <div className="h-full min-w-[1280px] flex flex-col bg-[#f0f4ff]">
      <div className="flex flex-1 min-h-0">
        <ReactorToolbar />

        <div className="flex-1 flex flex-col min-w-0">
          <ParameterPanel />
          <div className="flex-1 min-h-0">
            <ReactorCanvas />
          </div>
        </div>

        <div className="w-[420px] flex flex-col shrink-0 border-l border-[#dde3f0] bg-[#f0f4ff] overflow-hidden">
          <div className="flex gap-0 border-b border-[#dde3f0] bg-[#ffffff] shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRightTab(tab.id)}
                className="flex-1 text-[11px] font-medium py-2 transition-colors"
                style={{
                  color: rightTab === tab.id ? '#2563eb' : '#6b7280',
                  borderBottom: rightTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                  background: rightTab === tab.id ? '#f8faff' : '#ffffff',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {rightTab === 'levenspiel' && (
              <div className="h-[55%] border-b border-[#dde3f0] shrink-0">
                <div className="h-full">
                  <LevenspielPlot />
                </div>
              </div>
            )}
            {rightTab === 'profiles' && (
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
            {rightTab === 'thermal' && (
              <div className="flex-1">
                <OperatingDiagram />
              </div>
            )}
            {rightTab === 'dynamic' && (
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
            {rightTab !== 'dynamic' && (
              <div className="shrink-0">
                <StreamTable />
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
    </div>
  );
}
