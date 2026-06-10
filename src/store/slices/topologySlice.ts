import type { StateCreator } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { ReactorType, UnitType, ThermalMode } from '../../types/simulation';
import type { SimulatorStore } from '../simulatorStore';

const dedup = <T extends { id: string }>(arr: T[]): T[] => {
  const seen = new Set<string>();
  return arr.filter(n => seen.has(n.id) ? false : (seen.add(n.id), true));
};

const findLowestAvailable = (nodes: Node[], prefix: string): number => {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  const used = new Set<number>();
  for (const n of nodes) {
    const label = (n.data as any)?.label as string | undefined;
    if (label) { const m = label.match(re); if (m) used.add(parseInt(m[1], 10)); }
  }
  let num = 1;
  while (used.has(num)) num++;
  return num;
};

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
  interactionWidth: 20,
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
  batchCount: number;
  mixerCount: number;
  splitterCount: number;
  feedCount: number;
  productCount: number;
  _history: { nodes: Node[]; edges: Edge[] }[];
  _historyIndex: number;

  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addReactor: (type: ReactorType, position: { x: number; y: number }) => void;
  addUnit: (unitType: UnitType, position: { x: number; y: number }) => void;
  addFeedNode: (position: { x: number; y: number }) => void;
  addProductNode: (position: { x: number; y: number }) => void;
  updateReactorTau: (nodeId: string, tau: number) => void;
  updateNodeThermal: (nodeId: string, data: { thermalMode?: ThermalMode; Tc?: number; kappa_v?: number }) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
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
    batchCount: 0,
    mixerCount: 0,
    splitterCount: 0,
    feedCount: 1,
    productCount: 1,
    _history: [],
    _historyIndex: -1,

    setNodes: (incomingNodes) => {
      const state = get();
      const existingIds = new Set(state.nodes.map((n) => n.id));

      const newNodes = incomingNodes.filter((n) => !existingIds.has(n.id));

      if (newNodes.length === 0) {
        set({ nodes: dedup(incomingNodes) });
        return;
      }

      const occupiedLabels = new Set<string>();
      const addLabels = (ns: Node[]) => {
        for (const n of ns) {
          const label = (n.data as any)?.label;
          if (label) occupiedLabels.add(label);
        }
      };
      addLabels(state.nodes);

      const usedLabels = new Set(occupiedLabels);

      const getMaxNum = (prefix: string) => {
        let max = 0;
        const re = new RegExp(`^${prefix}-(\\d+)$`);
        for (const l of usedLabels) {
          const m = l.match(re);
          if (m) max = Math.max(max, parseInt(m[1]));
        }
        return max;
      };

      const LABEL_PREFIX: Record<string, string> = {
        cstr: 'CSTR',
        pfr: 'PFR',
        batch: 'Batch',
        mixer: 'Mixer',
        splitter: 'Split',
        feed: 'Feed',
        product: 'Product',
      };

      let cstrCount = getMaxNum('CSTR');
      let pfrCount = getMaxNum('PFR');
      let batchCount = getMaxNum('Batch');
      let mixerCount = getMaxNum('Mixer');
      let splitterCount = getMaxNum('Split');
      let feedCount = getMaxNum('Feed');
      let productCount = getMaxNum('Product');

      const bump = (type: string): number => {
        const prefix = LABEL_PREFIX[type] ?? type;
        let count: number;
        switch (type) {
          case 'cstr':     cstrCount++;     count = cstrCount; break;
          case 'pfr':      pfrCount++;      count = pfrCount; break;
          case 'batch':    batchCount++;    count = batchCount; break;
          case 'mixer':    mixerCount++;    count = mixerCount; break;
          case 'splitter': splitterCount++; count = splitterCount; break;
          case 'feed':     feedCount++;     count = feedCount; break;
          case 'product':  productCount++;  count = productCount; break;
          default:         /* fallback */    count = 1;          break;
        }
        let label = `${prefix}-${count}`;
        while (usedLabels.has(label)) {
          count++;
          label = `${prefix}-${count}`;
        }
        switch (type) {
          case 'cstr':     cstrCount     = count; break;
          case 'pfr':      pfrCount      = count; break;
          case 'batch':    batchCount    = count; break;
          case 'mixer':    mixerCount    = count; break;
          case 'splitter': splitterCount = count; break;
          case 'feed':     feedCount     = count; break;
          case 'product':  productCount  = count; break;
        }
        usedLabels.add(label);
        return count;
      };

      const renamed = incomingNodes.map((n) => {
        const isNewPasted = !existingIds.has(n.id);
        if (!isNewPasted) return n;

        const label = (n.data as any)?.label as string | undefined;
        if (!label) return n;

        if (!occupiedLabels.has(label)) {
          usedLabels.add(label);
          return n;
        }

        const type = (n.type ?? 'cstr') as string;
        const prefix = LABEL_PREFIX[type] ?? type;
        const num = bump(type);
        const newLabel = `${prefix}-${num}`;
        return { ...n, data: { ...n.data, label: newLabel } };
      });

      set({
        nodes: dedup(renamed),
        cstrCount,
        pfrCount,
        batchCount,
        mixerCount,
        splitterCount,
        feedCount,
        productCount,
      });
    },
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

    updateNodeLabel: (nodeId, label) =>
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, label } }
            : n
        ),
      })),

    addReactor: (type, position) => {
      const state = get();
      const prefix = type === 'CSTR' ? 'CSTR' : type === 'PFR' ? 'PFR' : type === 'Semibatch' ? 'SB' : type === 'FixedBed' ? 'FB' : 'Batch';
      const typeKey = type.toLowerCase() as string;
      const num = findLowestAvailable(state.nodes, prefix);
      const id = `${typeKey}-${num}`;
      const label = `${prefix}-${num}`;

      const snapshot = {
        nodes: state.nodes.map(n => ({ ...n, data: { ...n.data } })),
        edges: state.edges.map(e => ({ ...e })),
      };
      const trimmed = state._history.slice(0, state._historyIndex + 1);
      trimmed.push(snapshot);
      if (trimmed.length > 50) trimmed.shift();

      const baseData = {
        reactorType: type,
        label,
        tau: type === 'Semibatch' ? 30.0 : 2.0,
        thermalMode: 'isothermal' as ThermalMode,
        Tc: 300,
        kappa_v: 0.5,
        ic_Ca: state.params.Ca0,
        ic_T: state.params.T_feed,
        ...(type === 'Semibatch' ? { FB0: 0.1, CB_feed: 1.0 } : {}),
        ...(type === 'FixedBed' ? { W_cat: 5.0, rho_bulk: 1200, epsilon_bed: 0.4 } : {}),
      };

      const newNode: Node = { id, type: typeKey, position, data: baseData };

      set({
        nodes: [...state.nodes.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }],
        cstrCount:      type === 'CSTR'      ? Math.max(state.cstrCount,  num) : state.cstrCount,
        pfrCount:       type === 'PFR'       ? Math.max(state.pfrCount,   num) : state.pfrCount,
        batchCount:     type === 'Batch'     ? Math.max(state.batchCount, num) : state.batchCount,
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
        const num = findLowestAvailable(state.nodes, 'Mixer');
        const newNode: Node = {
          id: `mixer-${num}`,
          type: 'mixer',
          position,
          data: { label: `Mixer-${num}` },
        };
        set({ nodes: [...state.nodes.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }], mixerCount: Math.max(state.mixerCount, num), _history: trimmed, _historyIndex: trimmed.length - 1 });
      } else if (unitType === 'Splitter') {
        const num = findLowestAvailable(state.nodes, 'Split');
        const newNode: Node = {
          id: `splitter-${num}`,
          type: 'splitter',
          position,
          data: { label: `Split-${num}`, alpha: 0.5 },
        };
        set({ nodes: [...state.nodes.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }], splitterCount: Math.max(state.splitterCount, num), _history: trimmed, _historyIndex: trimmed.length - 1 });
      }
    },

    addFeedNode: (position) => {
      const state = get();
      const snapshot = {
        nodes: state.nodes.map(n => ({ ...n, data: { ...n.data } })),
        edges: state.edges.map(e => ({ ...e })),
      };
      const trimmed = state._history.slice(0, state._historyIndex + 1);
      trimmed.push(snapshot);
      if (trimmed.length > 50) trimmed.shift();

      const num = findLowestAvailable(state.nodes, 'Feed');
      const newNode: Node = {
        id: `feed-${num}`,
        type: 'feed',
        position,
        data: { label: `Feed-${num}` },
        draggable: true,
        deletable: true,
      };
      set({
        nodes: [...state.nodes.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }],
        feedCount: Math.max(state.feedCount, num),
        _history: trimmed,
        _historyIndex: trimmed.length - 1,
      });
    },

    addProductNode: (position) => {
      const state = get();
      const snapshot = {
        nodes: state.nodes.map(n => ({ ...n, data: { ...n.data } })),
        edges: state.edges.map(e => ({ ...e })),
      };
      const trimmed = state._history.slice(0, state._historyIndex + 1);
      trimmed.push(snapshot);
      if (trimmed.length > 50) trimmed.shift();

      const num = findLowestAvailable(state.nodes, 'Product');
      const newNode: Node = {
        id: `product-${num}`,
        type: 'product',
        position,
        data: { label: `Product-${num}` },
        draggable: true,
        deletable: true,
      };
      set({
        nodes: [...state.nodes.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }],
        productCount: Math.max(state.productCount, num),
        _history: trimmed,
        _historyIndex: trimmed.length - 1,
      });
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

    resetCanvas: () => set({ nodes: initialNodes, edges: initialEdges, cstrCount: 1, pfrCount: 1, batchCount: 0, mixerCount: 0, splitterCount: 0, feedCount: 1, productCount: 1 }),
  });
