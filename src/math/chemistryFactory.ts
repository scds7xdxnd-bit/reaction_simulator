import type { SimulationParams } from '../types/reactor';
import type { ChemistryModel } from '../types/chemistry';
import { getPreset } from './reactionRegistry';
import { buildThermoModel } from './thermoModel';

export function buildChemistry(params: SimulationParams): ChemistryModel {
  const preset = getPreset(params);
  const initialConcentrations: Record<string, number> | undefined =
    params.reactionMode === 'series-parallel'
      ? { B: params.Cb0 ?? 1.0 }
      : undefined;
  return {
    species:       preset.buildSpecies(params),
    reactions:     preset.buildReactions(params),
    thermo:        buildThermoModel(params),
    keyReactantId: 'A',
    initialConcentrations,
  };
}
