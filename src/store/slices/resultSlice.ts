import type { StateCreator } from 'zustand';
import type { SimulationResult } from '../../types/reactor';
import type { SimulatorStore } from '../simulatorStore';

export interface ResultSlice {
  result: SimulationResult | null;
  setResult: (result: SimulationResult | null) => void;
}

export const createResultSlice: StateCreator<SimulatorStore, [], [], ResultSlice> =
  (set) => ({
    result: null,

    setResult: (result) => set({ result }),
  });
