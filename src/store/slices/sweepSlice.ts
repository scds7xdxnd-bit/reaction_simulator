import type { StateCreator } from 'zustand';
import type { SweepConfig, SweepPoint } from '../../math/sweepEngine';
import type { TargetResult } from '../../math/targetSolver';

export type AnalysisMode = 'sweep' | 'target';

export interface SweepSlice {
  sweepConfig: SweepConfig;
  sweepResults: SweepPoint[] | null;
  setSweepConfig: (partial: Partial<SweepConfig>) => void;
  setSweepResults: (results: SweepPoint[] | null) => void;
  analysisMode: AnalysisMode;
  targetXa: number;
  targetResult: TargetResult | null;
  setAnalysisMode: (mode: AnalysisMode) => void;
  setTargetXa: (xa: number) => void;
  setTargetResult: (result: TargetResult | null) => void;
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

  analysisMode: 'sweep',
  targetXa: 0.9,
  targetResult: null,
  setAnalysisMode: (mode) => set({ analysisMode: mode }),
  setTargetXa: (xa) => set({ targetXa: xa }),
  setTargetResult: (result) => set({ targetResult: result }),
});
