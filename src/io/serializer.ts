import type { Node, Edge } from '@xyflow/react';
import type { SimulationParams } from '../types/reactor';

export interface SavedState {
  version: 1;
  nodes: Node[];
  edges: Edge[];
  params: SimulationParams;
  mode: 'steady-state' | 'dynamic';
}

export function serializeState(
  nodes: Node[],
  edges: Edge[],
  params: SimulationParams,
  mode: 'steady-state' | 'dynamic',
): string {
  const state: SavedState = { version: 1, nodes, edges, params, mode };
  return JSON.stringify(state, null, 2);
}

export function deserializeState(json: string): SavedState | null {
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    if (
      raw.version !== 1 ||
      !Array.isArray(raw.nodes) ||
      !Array.isArray(raw.edges) ||
      typeof raw.params !== 'object' || raw.params === null ||
      (raw.mode !== 'steady-state' && raw.mode !== 'dynamic')
    ) return null;

    const p = raw.params as Record<string, unknown>;
    const required: (keyof SimulationParams)[] = [
      'reactionMode', 'kinetics', 'k', 'k2', 'Ca0', 'Cr0_fraction',
      'T_ref', 'Ea', 'delta_H', 'rho_Cp', 'T_feed',
    ];
    for (const key of required) {
      if (!(key in p)) return null;
    }
    return raw as unknown as SavedState;
  } catch {
    return null;
  }
}
