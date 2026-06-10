import { useSimulatorStore } from '../store/simulatorStore';
import { serializeState, deserializeState } from '../io/serializer';
import type { SavedState } from '../io/serializer';

const LS_KEY = 'rsi-scenarios';
const MAX_SCENARIOS = 10;

export interface Scenario {
  id: string;
  name: string;
  state: SavedState;
  Xa: number;
  yieldR: number;
  selectivity: number;
  kinetics: string;
  savedAt: string;
}

function loadFromStorage(): Scenario[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Scenario[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(scenarios: Scenario[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(scenarios));
}

export function useScenarios() {
  const nodes           = useSimulatorStore((s) => s.nodes);
  const edges           = useSimulatorStore((s) => s.edges);
  const params          = useSimulatorStore((s) => s.params);
  const simulationMode  = useSimulatorStore((s) => s.simulationMode);
  const result          = useSimulatorStore((s) => s.result);
  const setNodes        = useSimulatorStore((s) => s.setNodes);
  const setEdges        = useSimulatorStore((s) => s.setEdges);
  const updateParams    = useSimulatorStore((s) => s.updateParams);
  const setMode         = useSimulatorStore((s) => s.setSimulationMode);

  function getScenarios(): Scenario[] {
    return loadFromStorage();
  }

  function save(name: string): boolean {
    const scenarios = loadFromStorage();
    if (scenarios.length >= MAX_SCENARIOS) return false;
    const json = serializeState(nodes, edges, params, simulationMode);
    const state = deserializeState(json);
    if (!state) return false;
    const scenario: Scenario = {
      id: `sc-${Date.now()}`,
      name: name.trim() || `Scenario ${scenarios.length + 1}`,
      state,
      Xa: result?.finalConversion ?? 0,
      yieldR: result?.finalYield ?? 0,
      selectivity: result?.finalSelectivity ?? 0,
      kinetics: params.kinetics,
      savedAt: new Date().toLocaleString(),
    };
    saveToStorage([...scenarios, scenario]);
    return true;
  }

  function remove(id: string): void {
    saveToStorage(loadFromStorage().filter((s) => s.id !== id));
  }

  function restore(scenario: Scenario): void {
    setNodes(scenario.state.nodes);
    setEdges(scenario.state.edges);
    updateParams(scenario.state.params);
    setMode(scenario.state.mode);
  }

  return {
    getScenarios,
    save,
    remove,
    restore,
    canSave: loadFromStorage().length < MAX_SCENARIOS,
  };
}
