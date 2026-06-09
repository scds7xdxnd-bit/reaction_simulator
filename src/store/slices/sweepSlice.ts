import type { StateCreator } from 'zustand';
import type { SweepConfig, SweepPoint } from '../../math/sweepEngine';

export interface SweepSlice {
  sweepConfig: SweepConfig;
  sweepResults: SweepPoint[] | null;
  setSweepConfig: (partial: Partial<SweepConfig>) => void;
  setSweepResults: (results: SweepPoint[] | null) => void;
}

export const createSweepSlice: StateCreator<SweepSlice, [], [], SweepSlice> = (set) => ({
  sweepConfig: {
    variable: 'k',
    targetNodeId: null,
    from: 0.1,
    to: 5.0,
    steps: 40,
  },
  sweepResults: null,
  setSweepConfig: (partial) =>
    set((s) => ({ sweepConfig: { ...s.sweepConfig, ...partial } })),
  setSweepResults: (results) => set({ sweepResults: results }),
});
