import { create } from 'zustand';
import { createTopologySlice, type TopologySlice } from './slices/topologySlice';
import { createParamsSlice,   type ParamsSlice   } from './slices/paramsSlice';
import { createResultSlice,   type ResultSlice   } from './slices/resultSlice';
import { createSessionSlice,  type SessionSlice  } from './slices/sessionSlice';

export type SimulatorStore = TopologySlice & ParamsSlice & ResultSlice & SessionSlice;

export const useSimulatorStore = create<SimulatorStore>()((...a) => ({
  ...createTopologySlice(...a),
  ...createParamsSlice(...a),
  ...createResultSlice(...a),
  ...createSessionSlice(...a),
}));
