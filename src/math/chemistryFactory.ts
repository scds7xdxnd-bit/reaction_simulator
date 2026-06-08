import type { SimulationParams } from '../types/reactor';
import type { ChemistryModel, ThermoModel } from '../types/chemistry';
import { getPreset } from './reactionRegistry';

export function buildChemistry(params: SimulationParams): ChemistryModel {
  const preset = getPreset(params);
  return {
    species:       preset.buildSpecies(params),
    reactions:     preset.buildReactions(params),
    thermo:        buildThermoModel(params),
    keyReactantId: 'A',
  };
}

function buildThermoModel(params: SimulationParams): ThermoModel {
  return {
    deltaH: (_rxnId, _T) => params.delta_H,
    rhoCp:  (_C, _T)     => params.rho_Cp,
  };
}
