import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSimulatorStore } from '../store/simulatorStore';
import { getPreset } from '../math/reactionRegistry';
import type { ReactionPreset } from '../math/reactionRegistry';
import type { ReactorNodeData, SimulationParams, ReactorSegmentResult } from '../types/reactor';
import type { ThermalMode } from '../types/simulation';

export interface ReactorNodeDerived {
  segment: ReactorSegmentResult | undefined;
  Da: number;
  Xa: number | undefined;
  T_out: number | undefined;
  preset: ReactionPreset;
  params: SimulationParams;
  isSingle: boolean;
  thermalMode: ThermalMode;
  simulationMode: 'steady-state' | 'dynamic';
  sizingMode: boolean;
  conversionColor: string;
}

export function useReactorNode(id: string, data: ReactorNodeData): ReactorNodeDerived {
  const { result, params, simulationMode, sizingMode } = useSimulatorStore(
    useShallow((s) => ({
      result: s.result,
      params: s.params,
      simulationMode: s.simulationMode,
      sizingMode: s.sizingMode,
    }))
  );

  const segment = result?.segments.find((s) => s.reactorId === id);
  const preset = getPreset(params);

  return useMemo(() => {
    const Da = segment
      ? segment.Da
      : preset.computeDa(params.k, data.tau, params.Ca0);
    const Xa = segment?.Xa_out;
    const T_out = segment?.T_out;
    const isSingle = params.reactionMode === 'single';
    const thermalMode: ThermalMode = data.thermalMode ?? 'isothermal';
    const conversionColor = segment
      ? segment.Xa_out > 0.7
        ? '#16a34a'
        : segment.Xa_out > 0.4
          ? '#d97706'
          : '#dc2626'
      : '#94a3b8';

    return { segment, Da, Xa, T_out, preset, params, isSingle, thermalMode, simulationMode, sizingMode, conversionColor };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, params, data.tau, data.thermalMode, simulationMode, sizingMode]);
}
