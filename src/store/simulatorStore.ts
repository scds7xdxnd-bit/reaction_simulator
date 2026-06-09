import { create } from 'zustand';
import { createTopologySlice, type TopologySlice } from './slices/topologySlice';
import { createParamsSlice,   type ParamsSlice   } from './slices/paramsSlice';
import { createResultSlice,   type ResultSlice   } from './slices/resultSlice';
import { createSessionSlice,  type SessionSlice  } from './slices/sessionSlice';
import { createToastSlice,    type ToastSlice    } from './slices/toastSlice';
import { createSweepSlice,    type SweepSlice    } from './slices/sweepSlice';
import { createPlotConfigSlice, type PlotConfigSlice } from './slices/plotConfigSlice';

export type SimulatorStore =
  TopologySlice & ParamsSlice & ResultSlice & SessionSlice & ToastSlice &
  SweepSlice & PlotConfigSlice;

export const useSimulatorStore = create<SimulatorStore>()((...a) => ({
  ...createTopologySlice(...a),
  ...createParamsSlice(...a),
  ...createResultSlice(...a),
  ...createSessionSlice(...a),
  ...createToastSlice(...a),
  ...createSweepSlice(...a),
  ...createPlotConfigSlice(...a),
}));
