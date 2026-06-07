import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { SimulationParams, SimulationResult, ReactorType } from '../types/reactor';

interface SimulatorStore {
  nodes: Node[];
  edges: Edge[];
  params: SimulationParams;
  result: SimulationResult | null;
  cstrCount: number;
  pfrCount: number;

  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateParams: (partial: Partial<SimulationParams>) => void;
  updateReactorTau: (nodeId: string, tau: number) => void;
  addReactor: (type: ReactorType, position: { x: number; y: number }) => void;
  setResult: (result: SimulationResult | null) => void;
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
  },
  result: null,
  cstrCount: 1,
  pfrCount: 1,

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
  addReactor: (type, position) => {
    const state = get();
    const id =
      type === 'CSTR'
        ? `cstr-${state.cstrCount + 1}`
        : `pfr-${state.pfrCount + 1}`;
    const count = type === 'CSTR' ? state.cstrCount + 1 : state.cstrCount;
    const pfrCount = type === 'PFR' ? state.pfrCount + 1 : state.pfrCount;

    const label = `${type}-${type === 'CSTR' ? count : pfrCount}`;

    const newNode: Node = {
      id,
      type: type.toLowerCase(),
      position,
      data: {
        reactorType: type,
        label,
        tau: 2.0,
      },
    };

    set({
      nodes: [...state.nodes, newNode],
      cstrCount: type === 'CSTR' ? count : state.cstrCount,
      pfrCount: type === 'PFR' ? pfrCount : state.pfrCount,
    });
  },
  setResult: (result) => set({ result }),
}));
