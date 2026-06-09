import type { Node, Edge } from '@xyflow/react';
import type { SimulationParams } from '../types/reactor';
import type { SweepVariable } from './sweepEngine';
import { solveNetwork } from './networkSolver';
import { bisect } from './numerics';

export interface TargetConfig {
  variable: SweepVariable;
  targetNodeId: string | null;
  targetXa: number;
  lo: number;
  hi: number;
}

export interface TargetResult {
  solvedValue: number;
  achievedXa: number;
  bracketValid: boolean;
}

export function solveTarget(
  nodes: Node[],
  edges: Edge[],
  params: SimulationParams,
  config: TargetConfig,
): TargetResult | null {
  const { variable, targetNodeId, targetXa, lo, hi } = config;

  if (lo >= hi) return null;
  if (targetXa <= 0 || targetXa >= 1) return null;

  const evaluate = (paramValue: number): number => {
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
    return (result?.finalConversion ?? 0) - targetXa;
  };

  const fLo = evaluate(lo);
  const fHi = evaluate(hi);
  const bracketValid = fLo * fHi <= 0;

  const solvedValue = bisect(evaluate, lo, hi);
  const achievedXa = evaluate(solvedValue) + targetXa;

  return { solvedValue, achievedXa, bracketValid };
}
