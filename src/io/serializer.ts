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
    const s = raw as unknown as SavedState;
    // Back-compat: older saves lack Keq_ref — fill in the default
    if (!(typeof p.Keq_ref === 'number')) {
      s.params = { ...s.params, Keq_ref: 4.0 };
    }
    // Back-compat: older saves lack epsilon — fill in the default
    if (!(typeof p.epsilon === 'number')) {
      s.params = { ...s.params, epsilon: 0 };
    }
    // Back-compat: older saves lack Q_feed
    if (!(typeof p.Q_feed === 'number')) {
      s.params = { ...s.params, Q_feed: 0 };
    }
    // Back-compat: older saves lack customReaction
    if (!('customReaction' in p)) {
      s.params = { ...s.params, customReaction: null };
    }
    // Back-compat: older saves lack k3
    if (!(typeof p.k3 === 'number')) {
      s.params = { ...s.params, k3: 0.1 };
    }
    // Back-compat: older saves lack Cb0
    if (!(typeof p.Cb0 === 'number')) {
      s.params = { ...s.params, Cb0: 1.0 };
    }
    return s;
  } catch {
    return null;
  }
}
