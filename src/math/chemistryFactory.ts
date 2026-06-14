import type { SimulationParams } from '../types/reactor';
import type { ChemistryModel } from '../types/chemistry';
import { getPreset } from './reactionRegistry';
import { buildThermoModel } from './thermoModel';

export function buildChemistry(params: SimulationParams): ChemistryModel {
  const preset = getPreset(params);

  let keyReactantId = 'A';
  let initialConcentrations: Record<string, number> | undefined;

  if (params.reactionMode === 'series-parallel') {
    initialConcentrations = { B: params.Cb0 ?? 1.0 };
  } else if (params.reactionMode === 'custom' && params.customReaction) {
    const net = params.customReaction;
    keyReactantId = net.keyReactantId ?? net.reactions[0]?.reactants[0]?.species ?? 'A';
    initialConcentrations = {};
    for (const [sym, meta] of Object.entries(net.speciesMeta)) {
      if (meta.feedConc && meta.feedConc > 0) initialConcentrations[sym] = meta.feedConc;
    }
    if (Object.keys(initialConcentrations).length === 0) {
      initialConcentrations = undefined;
    }
  }

  return {
    species:       preset.buildSpecies(params),
    reactions:     preset.buildReactions(params),
    thermo:        buildThermoModel(params),
    keyReactantId: preset.keyReactantId ?? keyReactantId,
    initialConcentrations,
  };
}
