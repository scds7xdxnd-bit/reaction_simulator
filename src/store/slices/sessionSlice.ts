import type { StateCreator } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { SimulatorStore } from '../simulatorStore';

export interface SessionSlice {
  simulationMode: 'steady-state' | 'dynamic';
  sizingMode: boolean;
  selectedNodeId: string | null;
  setSimulationMode: (mode: 'steady-state' | 'dynamic') => void;
  setSizingMode: (v: boolean) => void;
  setSelectedNodeId: (id: string | null) => void;

  clipboard: { nodes: Node[]; edges: Edge[] } | null;
  setClipboard: (c: { nodes: Node[]; edges: Edge[] } | null) => void;

  menuVisible: boolean;
  menuX: number;
  menuY: number;
  menuTargetId: string | null;
  openMenu: (x: number, y: number, targetId: string) => void;
  closeMenu: () => void;

  canvasMenuVisible: boolean;
  canvasMenuX: number;
  canvasMenuY: number;
  canvasMenuFlowX: number;
  canvasMenuFlowY: number;
  openCanvasMenu: (screenX: number, screenY: number, flowX: number, flowY: number) => void;
  closeCanvasMenu: () => void;

  paramsOpen: boolean;
  setParamsOpen: (v: boolean) => void;

  propertiesNodeId: string | null;
  setPropertiesNodeId: (id: string | null) => void;

  rightTab: string;
  setRightTab: (t: string) => void;

  pendingDesignTarget: { metric: string; value: number } | null;
  setPendingDesignTarget: (t: { metric: string; value: number } | null) => void;

  viewMode: 'schematic' | 'pfd';
  setViewMode: (m: 'schematic' | 'pfd') => void;

  // F28: resizable layout
  rightColWidth:    number;
  graphHeight:      number;
  graphCollapsed:   boolean;
  setRightColWidth:  (w: number) => void;
  setGraphHeight:    (h: number) => void;
  setGraphCollapsed: (v: boolean) => void;
}

export const createSessionSlice: StateCreator<SimulatorStore, [], [], SessionSlice> =
  (set) => ({
    simulationMode: 'steady-state',
    sizingMode: false,
    selectedNodeId: null,

    setSimulationMode: (mode) => set({ simulationMode: mode }),
    setSizingMode: (v) => set({ sizingMode: v }),
    setSelectedNodeId: (id)  => set({ selectedNodeId: id }),

    clipboard: null,
    setClipboard: (c) => set({ clipboard: c }),

    menuVisible:  false,
    menuX:        0,
    menuY:        0,
    menuTargetId: null,
  openMenu:  (x, y, targetId) => set({ menuVisible: true,  menuX: x, menuY: y, menuTargetId: targetId }),
  closeMenu: ()               => set({ menuVisible: false, menuTargetId: null }),

  canvasMenuVisible:  false,
  canvasMenuX:        0,
  canvasMenuY:        0,
  canvasMenuFlowX:    0,
  canvasMenuFlowY:    0,
  openCanvasMenu:  (screenX, screenY, flowX, flowY) =>
    set({ canvasMenuVisible: true, canvasMenuX: screenX, canvasMenuY: screenY, canvasMenuFlowX: flowX, canvasMenuFlowY: flowY }),
  closeCanvasMenu: () => set({ canvasMenuVisible: false }),

  paramsOpen: false,
  setParamsOpen: (v) => set({ paramsOpen: v }),

  propertiesNodeId: null,
  setPropertiesNodeId: (id) => set({ propertiesNodeId: id }),

  rightTab: 'levenspiel',
  setRightTab: (t) => set({ rightTab: t }),

  pendingDesignTarget: null,
  setPendingDesignTarget: (t) => set({ pendingDesignTarget: t }),

  viewMode: 'schematic',
  setViewMode: (m) => set({ viewMode: m }),

  rightColWidth:    420,
  graphHeight:      280,
  graphCollapsed:   false,
  setRightColWidth:  (w) => set({ rightColWidth: Math.max(220, Math.min(700, w)) }),
  setGraphHeight:    (h) => set({ graphHeight: Math.max(80, Math.min(550, h)) }),
  setGraphCollapsed: (v) => set({ graphCollapsed: v }),
});
