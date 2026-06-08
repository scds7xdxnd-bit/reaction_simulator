import { useCallback } from 'react';
import { useSimulatorStore } from '../store/simulatorStore';
import { serializeState, deserializeState } from '../io/serializer';
import type { Example } from '../io/examples';

export function useSaveFile() {
  const nodes  = useSimulatorStore((s) => s.nodes);
  const edges  = useSimulatorStore((s) => s.edges);
  const params = useSimulatorStore((s) => s.params);
  const mode   = useSimulatorStore((s) => s.simulationMode);

  return useCallback(() => {
    const json = serializeState(nodes, edges, params, mode);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'reactor-simulation.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, params, mode]);
}

export function useLoadFile() {
  const setNodes        = useSimulatorStore((s) => s.setNodes);
  const setEdges        = useSimulatorStore((s) => s.setEdges);
  const updateParams    = useSimulatorStore((s) => s.updateParams);
  const setMode         = useSimulatorStore((s) => s.setSimulationMode);

  return useCallback(() => {
    const input    = document.createElement('input');
    input.type     = 'file';
    input.accept   = '.json';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const state = deserializeState(await file.text());
      if (!state) { alert('Invalid or incompatible save file.'); return; }
      setNodes(state.nodes);
      setEdges(state.edges);
      updateParams(state.params);
      setMode(state.mode);
    };
    input.click();
  }, [setNodes, setEdges, updateParams, setMode]);
}

export function useLoadExample() {
  const setNodes     = useSimulatorStore((s) => s.setNodes);
  const setEdges     = useSimulatorStore((s) => s.setEdges);
  const updateParams = useSimulatorStore((s) => s.updateParams);
  const setMode      = useSimulatorStore((s) => s.setSimulationMode);

  return useCallback((ex: Example) => {
    setNodes(ex.state.nodes);
    setEdges(ex.state.edges);
    updateParams(ex.state.params);
    setMode(ex.state.mode);
  }, [setNodes, setEdges, updateParams, setMode]);
}
