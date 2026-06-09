import type { Node, Edge } from '@xyflow/react';
import type { SimulationParams } from '../types/reactor';
import { solveNetwork } from './networkSolver';

export type SweepVariable = 'k' | 'Ca0' | 'T_feed' | 'tau';

export interface SweepConfig {
  variable: SweepVariable;
  targetNodeId: string | null;
  from: number;
  to: number;
  steps: number;
}

export interface SweepPoint {
  paramValue: number;
  Xa: number;
  yieldR: number;
  converged: boolean;
}

export function runSweep(
  nodes: Node[],
  edges: Edge[],
  params: SimulationParams,
  config: SweepConfig
): SweepPoint[] {
  const { variable, from, to, steps, targetNodeId } = config;
  if (steps < 2 || from >= to) return [];

  const points: SweepPoint[] = [];

  for (let i = 0; i < steps; i++) {
    const paramValue = from + (i / (steps - 1)) * (to - from);

    let result: ReturnType<typeof solveNetwork>;
    if (variable === 'tau' && targetNodeId) {
      const sweepNodes = nodes.map((n) =>
        n.id === targetNodeId
          ? { ...n, data: { ...n.data, tau: paramValue } }
          : n
      );
      result = solveNetwork(sweepNodes, edges, params);
    } else {
      result = solveNetwork(nodes, edges, { ...params, [variable]: paramValue });
    }

    points.push({
      paramValue,
      Xa: result?.finalConversion ?? 0,
      yieldR: result?.finalYield ?? 0,
      converged: result?.converged ?? false,
    });
  }

  return points;
}
