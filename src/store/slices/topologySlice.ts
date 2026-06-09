import type { StateCreator } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { ReactorType, UnitType, ThermalMode } from '../../types/reactor';
import type { SimulatorStore } from '../simulatorStore';

const initialNodes: Node[] = [
  { id: 'feed',    type: 'feed',    position: { x: 60,  y: 230 }, data: {},                                                                                      draggable: false, deletable: false },
  { id: 'cstr-0',  type: 'cstr',    position: { x: 230, y: 220 }, data: { reactorType: 'CSTR', label: 'CSTR-1', tau: 2.0, thermalMode: 'isothermal', Tc: 300, kappa_v: 0.5, ic_Ca: 1.0, ic_T: 300 } },
  { id: 'pfr-0',   type: 'pfr',     position: { x: 470, y: 220 }, data: { reactorType: 'PFR',  label: 'PFR-1',  tau: 2.0, thermalMode: 'isothermal', Tc: 300, kappa_v: 0.5, ic_Ca: 1.0, ic_T: 300 } },
  { id: 'product', type: 'product', position: { x: 720, y: 230 }, data: {},                                                                                      draggable: false, deletable: false },
];

const edgeDefaults = {
  type: 'smoothstep',
  style: { stroke: '#94a3b8', strokeWidth: 2 },
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
};

const initialEdges: Edge[] = [
  { id: 'feed-cstr-0',  source: 'feed',   target: 'cstr-0', sourceHandle: 'out', targetHandle: 'in', ...edgeDefaults },
  { id: 'cstr-0-pfr-0', source: 'cstr-0', target: 'pfr-0',  sourceHandle: 'out', targetHandle: 'in', ...edgeDefaults },
  { id: 'pfr-0-product', source: 'pfr-0', target: 'product', sourceHandle: 'out', targetHandle: 'in', ...edgeDefaults },
];

export interface TopologySlice {
  nodes: Node[];
  edges: Edge[];
  cstrCount: number;
  pfrCount: number;
  mixerCount: number;
  splitterCount: number;
  _history: { nodes: Node[]; edges: Edge[] }[];
  _historyIndex: number;

  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addReactor: (type: ReactorType, position: { x: number; y: number }) => void;
  addUnit: (unitType: UnitType, position: { x: number; y: number }) => void;
  updateReactorTau: (nodeId: string, tau: number) => void;
  updateNodeThermal: (nodeId: string, data: { thermalMode?: ThermalMode; Tc?: number; kappa_v?: number }) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  resetCanvas: () => void;
}

export const createTopologySlice: StateCreator<SimulatorStore, [], [], TopologySlice> =
  (set, get) => ({
    nodes: initialNodes,
    edges: initialEdges,
    cstrCount: 1,
    pfrCount: 1,
    mixerCount: 0,
    splitterCount: 0,
    _history: [],
    _historyIndex: -1,

    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),

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

    resetCanvas: () => set({ nodes: initialNodes, edges: initialEdges, cstrCount: 1, pfrCount: 1, mixerCount: 0, splitterCount: 0 }),
  });
