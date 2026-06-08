import type { SimulationParams } from '../types/reactor';
import type { ChemistryModel } from '../types/chemistry';
import { getPreset } from './reactionRegistry';
import { buildThermoModel } from './thermoModel';

export function buildChemistry(params: SimulationParams): ChemistryModel {
  const preset = getPreset(params);
  return {
    species:       preset.buildSpecies(params),
    reactions:     preset.buildReactions(params),
    thermo:        buildThermoModel(params),
    keyReactantId: 'A',
  };
}
