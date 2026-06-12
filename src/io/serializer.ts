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
    // Back-compat: older saves lack k4
    if (!(typeof p.k4 === 'number')) {
      s.params = { ...s.params, k4: 0.1 };
    }
    // Back-compat: older saves lack recycleMethod
    if (p.recycleMethod !== 'direct' && p.recycleMethod !== 'wegstein' && p.recycleMethod !== 'newton') {
      s.params = { ...s.params, recycleMethod: 'direct' };
    }
    // Back-compat: older saves lack speciesLabel on feed nodes
    s.nodes = (s.nodes as Node[]).map((n: Node) =>
      n.type === 'feed' && !(n.data as Record<string, unknown>).speciesLabel
        ? { ...n, data: { ...n.data, speciesLabel: 'A' } }
        : n
    );
    // Back-compat: HX nodes without mode field default to utility with T_out=350K
    s.nodes = (s.nodes as Node[]).map((n: Node) =>
      n.type === 'hx' && !(n.data as Record<string, unknown>).mode
        ? { ...n, data: { ...n.data, mode: 'utility', T_out: (n.data as Record<string, unknown>).T_out ?? 350 } }
        : n
    );
    // Back-compat: CSplit nodes without splitFractions default to empty (ξ=0.5 for all)
    s.nodes = (s.nodes as Node[]).map((n: Node) =>
      n.type === 'csplit' && !(n.data as Record<string, unknown>).splitFractions
        ? { ...n, data: { ...n.data, splitFractions: {} } }
        : n
    );
    // Back-compat: Flash nodes without T_flash/P_flash get defaults
    s.nodes = (s.nodes as Node[]).map((n: Node) => {
      if (n.type !== 'flash') return n;
      const d = n.data as Record<string, unknown>;
      return {
        ...n,
        data: {
          ...d,
          T_flash: typeof d.T_flash === 'number' ? d.T_flash : 365,
          P_flash: typeof d.P_flash === 'number' ? d.P_flash : 101325,
        },
      };
    });
    // Back-compat: Purge nodes without beta get default 5%
    s.nodes = (s.nodes as Node[]).map((n: Node) =>
      n.type === 'purge' && typeof (n.data as Record<string, unknown>).beta !== 'number'
        ? { ...n, data: { ...n.data, beta: 0.05 } }
        : n
    );
    // Back-compat: Pump nodes
    s.nodes = (s.nodes as Node[]).map((n: Node) => {
      if (n.type !== 'pump') return n;
      const d = n.data as Record<string, unknown>;
      return {
        ...n,
        data: {
          ...d,
          P_out: typeof d.P_out === 'number' ? d.P_out : 5e5,
          eta:   typeof d.eta   === 'number' ? d.eta   : 0.75,
          Q_vol: typeof d.Q_vol === 'number' ? d.Q_vol : 1e-3,
        },
      };
    });
    // Back-compat: Compressor nodes
    s.nodes = (s.nodes as Node[]).map((n: Node) => {
      if (n.type !== 'comp') return n;
      const d = n.data as Record<string, unknown>;
      return {
        ...n,
        data: {
          ...d,
          P_out: typeof d.P_out  === 'number' ? d.P_out  : 3e5,
          eta:   typeof d.eta    === 'number' ? d.eta    : 0.8,
          gamma: typeof d.gamma  === 'number' ? d.gamma  : 1.4,
        },
      };
    });
    // Back-compat: Valve nodes
    s.nodes = (s.nodes as Node[]).map((n: Node) =>
      n.type === 'valve' && typeof (n.data as Record<string, unknown>).P_out !== 'number'
        ? { ...n, data: { ...n.data, P_out: 101325 } }
        : n
    );
    // Back-compat: CSTR/PFR nodes in cooled-detailed mode missing F17 params
    s.nodes = (s.nodes as Node[]).map((n: Node) => {
      if (n.type !== 'cstr' && n.type !== 'pfr') return n;
      const d = n.data as Record<string, unknown>;
      if (d.thermalMode !== 'cooled-detailed') return n;
      return {
        ...n,
        data: {
          ...d,
          UA:          typeof d.UA          === 'number' ? d.UA          : 2.0,
          Ua:          typeof d.Ua          === 'number' ? d.Ua          : 1.0,
          mdot_c_Cp_c: typeof d.mdot_c_Cp_c === 'number' ? d.mdot_c_Cp_c : 4.18,
          Tc_in:       typeof d.Tc_in       === 'number' ? d.Tc_in       : 280,
          hx_flow:     d.hx_flow === 'counter-current' ? 'counter-current' : 'co-current',
        },
      };
    });
    // Back-compat: fixedbed nodes missing F19.3 effectiveness-factor params
    s.nodes = (s.nodes as Node[]).map((n: Node) => {
      if (n.type !== 'fixedbed') return n;
      const d = n.data as Record<string, unknown>;
      return {
        ...n,
        data: {
          ...d,
          R_p:            typeof d.R_p            === 'number' ? d.R_p            : 3e-3,
          D_e:            typeof d.D_e            === 'number' ? d.D_e            : 1e-9,
          rho_cat_particle: typeof d.rho_cat_particle === 'number' ? d.rho_cat_particle : 1500,
          catalyst_age:   typeof d.catalyst_age   === 'number' ? d.catalyst_age   : 1,
        },
      };
    });
    return s;
  } catch {
    return null;
  }
}
