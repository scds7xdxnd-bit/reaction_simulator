import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { SimulationParams, SimulationResult, ReactorType, UnitType, ThermalMode } from '../types/reactor';

interface SimulatorStore {
  nodes: Node[];
  edges: Edge[];
  params: SimulationParams;
  result: SimulationResult | null;
  cstrCount: number;
  pfrCount: number;
  mixerCount: number;
  splitterCount: number;
  simulationMode: 'steady-state' | 'dynamic';
  selectedNodeId: string | null;
  _history: { nodes: Node[]; edges: Edge[] }[];
  _historyIndex: number;

  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateParams: (partial: Partial<SimulationParams>) => void;
  updateReactorTau: (nodeId: string, tau: number) => void;
  updateNodeThermal: (nodeId: string, data: { thermalMode?: ThermalMode; Tc?: number; kappa_v?: number }) => void;
  addReactor: (type: ReactorType, position: { x: number; y: number }) => void;
  addUnit: (unitType: UnitType, position: { x: number; y: number }) => void;
  setResult: (result: SimulationResult | null) => void;
  setSimulationMode: (mode: 'steady-state' | 'dynamic') => void;
  setSelectedNodeId: (id: string | null) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useSimulatorStore = create<SimulatorStore>((set, get) => ({
  nodes: [],
  edges: [],
  params: {
    reactionMode: 'single',
    kinetics: 'first-order',
    k: 0.5,
    k2: 0.3,
    Ca0: 1.0,
    Cr0_fraction: 0.01,
    T_ref: 300,
    Ea: 0,
    delta_H: -50,
    rho_Cp: 4.18,
    T_feed: 300,
  },
  result: null,
  cstrCount: 1,
  pfrCount: 1,
  mixerCount: 0,
  splitterCount: 0,
  simulationMode: 'steady-state',
  selectedNodeId: null,
  _history: [],
  _historyIndex: -1,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  updateParams: (partial) =>
    set((state) => ({ params: { ...state.params, ...partial } })),
  updateReactorTau: (nodeId, tau) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, tau: Math.max(0.01, Math.min(100, tau)) } }
          : n
      ),
    })),
  updateNodeThermal: (nodeId, thermal) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, ...thermal } }
          : n
      ),
    })),
  addReactor: (type, position) => {
    const state = get();
    const id =
      type === 'CSTR'
        ? `cstr-${state.cstrCount + 1}`
        : `pfr-${state.pfrCount + 1}`;
    const count = type === 'CSTR' ? state.cstrCount + 1 : state.cstrCount;
    const pfrCount = type === 'PFR' ? state.pfrCount + 1 : state.pfrCount;

    const label = `${type}-${type === 'CSTR' ? count : pfrCount}`;

    const snapshot = {
      nodes: state.nodes.map(n => ({ ...n, data: { ...n.data } })),
      edges: state.edges.map(e => ({ ...e })),
    };
    const trimmed = state._history.slice(0, state._historyIndex + 1);
    trimmed.push(snapshot);
    if (trimmed.length > 50) trimmed.shift();

    const newNode: Node = {
      id,
      type: type.toLowerCase(),
      position,
      data: {
        reactorType: type,
        label,
        tau: 2.0,
        thermalMode: 'isothermal' as ThermalMode,
        Tc: 300,
        kappa_v: 0.5,
        ic_Ca: state.params.Ca0,
        ic_T: state.params.T_feed,
      },
    };

    set({
      nodes: [...state.nodes, newNode],
      cstrCount: type === 'CSTR' ? count : state.cstrCount,
      pfrCount: type === 'PFR' ? pfrCount : state.pfrCount,
      _history: trimmed,
      _historyIndex: trimmed.length - 1,
    });
  },
  addUnit: (unitType, position) => {
    const state = get();

    const snapshot = {
      nodes: state.nodes.map(n => ({ ...n, data: { ...n.data } })),
      edges: state.edges.map(e => ({ ...e })),
    };
    const trimmed = state._history.slice(0, state._historyIndex + 1);
    trimmed.push(snapshot);
    if (trimmed.length > 50) trimmed.shift();

    if (unitType === 'Mixer') {
      const count = state.mixerCount + 1;
      const id = `mixer-${count}`;
      const newNode: Node = {
        id,
        type: 'mixer',
        position,
        data: { label: `Mixer-${count}` },
      };
      set({ nodes: [...state.nodes, newNode], mixerCount: count, _history: trimmed, _historyIndex: trimmed.length - 1 });
    } else if (unitType === 'Splitter') {
      const count = state.splitterCount + 1;
      const id = `splitter-${count}`;
      const newNode: Node = {
        id,
        type: 'splitter',
        position,
        data: { label: `Split-${count}`, alpha: 0.5 },
      };
      set({ nodes: [...state.nodes, newNode], splitterCount: count, _history: trimmed, _historyIndex: trimmed.length - 1 });
    }
  },
  setResult: (result) => set({ result }),
  setSimulationMode: (mode) => set({ simulationMode: mode }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  pushHistory: () => {
    const s = get();
    const snapshot = {
      nodes: s.nodes.map(n => ({ ...n, data: { ...n.data } })),
      edges: s.edges.map(e => ({ ...e })),
    };
    const trimmed = s._history.slice(0, s._historyIndex + 1);
    trimmed.push(snapshot);
    if (trimmed.length > 50) trimmed.shift();
    set({ _history: trimmed, _historyIndex: trimmed.length - 1 });
  },

  undo: () => {
    const s = get();
    if (s._historyIndex <= 0) return;
    const idx = s._historyIndex - 1;
    const snap = s._history[idx];
    set({ nodes: snap.nodes, edges: snap.edges, _historyIndex: idx });
  },

  redo: () => {
    const s = get();
    if (s._historyIndex >= s._history.length - 1) return;
    const idx = s._historyIndex + 1;
    const snap = s._history[idx];
    set({ nodes: snap.nodes, edges: snap.edges, _historyIndex: idx });
  },

  canUndo: () => get()._historyIndex > 0,
  canRedo: () => get()._historyIndex < get()._history.length - 1,
}));
