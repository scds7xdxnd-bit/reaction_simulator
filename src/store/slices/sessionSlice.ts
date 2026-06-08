import type { StateCreator } from 'zustand';
import type { SimulatorStore } from '../simulatorStore';

export interface SessionSlice {
  simulationMode: 'steady-state' | 'dynamic';
  selectedNodeId: string | null;
  setSimulationMode: (mode: 'steady-state' | 'dynamic') => void;
  setSelectedNodeId: (id: string | null) => void;
}

export const createSessionSlice: StateCreator<SimulatorStore, [], [], SessionSlice> =
  (set) => ({
    simulationMode: 'steady-state',
    selectedNodeId: null,

    setSimulationMode: (mode) => set({ simulationMode: mode }),
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  });
