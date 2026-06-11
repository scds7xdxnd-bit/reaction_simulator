import type { StateCreator } from 'zustand';
import type { SimulationParams } from '../../types/reactor';
import type { SimulatorStore } from '../simulatorStore';

export interface ParamsSlice {
  params: SimulationParams;
  updateParams: (partial: Partial<SimulationParams>) => void;
}

export const createParamsSlice: StateCreator<SimulatorStore, [], [], ParamsSlice> =
  (set, get) => ({
    params: {
      reactionMode: 'single',
      kinetics: 'first-order',
      k: 0.5,
      k2: 0.3,
      k3: 0.1,
      Keq_ref: 4.0,
      Ca0: 1.0,
      Cr0_fraction: 0.01,
      T_ref: 300,
      Ea: 0,
      delta_H: -50,
      rho_Cp: 4.18,
      T_feed: 300,
      epsilon: 0,
      Q_feed: 0,
      customReaction: null,
    },

    updateParams: (partial) =>
      set((state) => ({ params: { ...state.params, ...partial } })),
  });
