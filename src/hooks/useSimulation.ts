import { useEffect, useRef } from 'react';
import { useSimulatorStore } from '../store/simulatorStore';
import { solveNetwork } from '../math/networkSolver';

export function useSimulation() {
  const nodes = useSimulatorStore((s) => s.nodes);
  const edges = useSimulatorStore((s) => s.edges);
  const params = useSimulatorStore((s) => s.params);
  const setResult = useSimulatorStore((s) => s.setResult);
  const simulationMode = useSimulatorStore((s) => s.simulationMode);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (simulationMode !== 'steady-state') return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      const result = solveNetwork(nodes, edges, params);
      setResult(result);
    }, 50);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [nodes, edges, params, setResult, simulationMode]);
}
