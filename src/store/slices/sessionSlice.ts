import type { StateCreator } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { SimulatorStore } from '../simulatorStore';

export interface SessionSlice {
  simulationMode: 'steady-state' | 'dynamic';
  selectedNodeId: string | null;
  setSimulationMode: (mode: 'steady-state' | 'dynamic') => void;
  setSelectedNodeId: (id: string | null) => void;

  clipboard: { nodes: Node[]; edges: Edge[] } | null;
  setClipboard: (c: { nodes: Node[]; edges: Edge[] } | null) => void;

  menuVisible: boolean;
  menuX: number;
  menuY: number;
  menuTargetId: string | null;
  openMenu: (x: number, y: number, targetId: string) => void;
  closeMenu: () => void;
}

export const createSessionSlice: StateCreator<SimulatorStore, [], [], SessionSlice> =
  (set) => ({
    simulationMode: 'steady-state',
    selectedNodeId: null,

    setSimulationMode: (mode) => set({ simulationMode: mode }),
    setSelectedNodeId: (id)  => set({ selectedNodeId: id }),

    clipboard: null,
    setClipboard: (c) => set({ clipboard: c }),

    menuVisible:  false,
    menuX:        0,
    menuY:        0,
    menuTargetId: null,
    openMenu:  (x, y, targetId) => set({ menuVisible: true,  menuX: x, menuY: y, menuTargetId: targetId }),
    closeMenu: ()               => set({ menuVisible: false, menuTargetId: null }),
  });
