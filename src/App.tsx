import ReactorToolbar from './components/controls/ReactorToolbar';
import ParameterPanel from './components/controls/ParameterPanel';
import ReactorCanvas from './components/canvas/ReactorCanvas';
import LevenspielPlot from './components/plots/LevenspielPlot';
import ConversionProfile from './components/plots/ConversionProfile';
import SpeciesProfile from './components/plots/SpeciesProfile';
import StatusBar from './components/StatusBar';
import { useSimulatorStore } from './store/simulatorStore';

export default function App() {
  const reactionMode = useSimulatorStore((s) => s.params.reactionMode);

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

        <div className="w-[420px] flex flex-col shrink-0 border-l border-[#dde3f0] bg-[#f0f4ff]">
          <div className="h-[50%] border-b border-[#dde3f0]">
            <LevenspielPlot />
          </div>
          <div className="h-[50%]">
            {reactionMode === 'single'
              ? <ConversionProfile />
              : <SpeciesProfile />
            }
          </div>
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
