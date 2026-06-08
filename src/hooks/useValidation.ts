import { useMemo } from 'react';
import { useSimulatorStore } from '../store/simulatorStore';
import { validateParams, validateTopology, type ValidationIssue } from '../math/validation';

export function useValidation(): ValidationIssue[] {
  const params = useSimulatorStore((s) => s.params);
  const nodes  = useSimulatorStore((s) => s.nodes);
  const edges  = useSimulatorStore((s) => s.edges);

  return useMemo(
    () => [...validateParams(params), ...validateTopology(nodes, edges)],
    [params, nodes, edges],
  );
}
