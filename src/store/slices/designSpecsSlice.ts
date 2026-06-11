import type { StateCreator } from 'zustand';
import type { SimulatorStore } from '../simulatorStore';
import type { DesignSpec } from '../../types/simulation';

export interface DesignSpecsSlice {
  designSpecs: DesignSpec[];
  addDesignSpec: (spec: DesignSpec) => void;
  removeDesignSpec: (id: string) => void;
  updateDesignSpec: (id: string, patch: Partial<DesignSpec>) => void;
}

export const createDesignSpecsSlice: StateCreator<SimulatorStore, [], [], DesignSpecsSlice> =
  (set) => ({
    designSpecs: [],
    addDesignSpec: (spec) =>
      set((s) => ({ designSpecs: [...s.designSpecs, spec] })),
    removeDesignSpec: (id) =>
      set((s) => ({ designSpecs: s.designSpecs.filter((d) => d.id !== id) })),
    updateDesignSpec: (id, patch) =>
      set((s) => ({
        designSpecs: s.designSpecs.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      })),
  });
