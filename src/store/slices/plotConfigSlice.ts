import type { StateCreator } from 'zustand';

export type PlotId = 'levenspiel' | 'conversion' | 'temperature' | 'species';

export interface PlotAxisConfig {
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  yLog?: boolean;
}

const emptyConfig = (): PlotAxisConfig => ({});

export interface PlotConfigSlice {
  plotConfig: Record<PlotId, PlotAxisConfig>;
  setPlotAxisConfig: (plotId: PlotId, partial: Partial<PlotAxisConfig>) => void;
  resetPlotAxisConfig: (plotId: PlotId) => void;
}

export const createPlotConfigSlice: StateCreator<PlotConfigSlice, [], [], PlotConfigSlice> =
  (set) => ({
    plotConfig: {
      levenspiel:  emptyConfig(),
      conversion:  emptyConfig(),
      temperature: emptyConfig(),
      species:     emptyConfig(),
    },
    setPlotAxisConfig: (plotId, partial) =>
      set((s) => ({
        plotConfig: {
          ...s.plotConfig,
          [plotId]: { ...s.plotConfig[plotId], ...partial },
        },
      })),
    resetPlotAxisConfig: (plotId) =>
      set((s) => ({
        plotConfig: { ...s.plotConfig, [plotId]: emptyConfig() },
      })),
  });
