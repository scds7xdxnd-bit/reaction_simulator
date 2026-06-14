import type { SimulationParams } from '../types/reactor';
import type { ThermoModel } from '../types/chemistry';

/**
 * Build a ThermoModel from simulation parameters.
 *
 * Currently returns constant-valued functions that ignore reactionId and T.
 * The signature and interface are structured so per-reaction ΔH values and
 * T-dependent Cp polynomials can be added here without touching any caller.
 */
export function buildThermoModel(params: SimulationParams): ThermoModel {
  const dHMap: Record<string, number> = {};
  if (params.reactionMode === 'custom' && params.customReaction) {
    for (const rxn of params.customReaction.reactions) {
      if (typeof rxn.deltaH === 'number') dHMap[rxn.id] = rxn.deltaH;
    }
  }
  return {
    deltaH: (reactionId: string, _T: number): number => dHMap[reactionId] ?? params.delta_H,
    rhoCp:  (_C, _T): number => params.rho_Cp,
  };
}

/**
 * Convenience factory for tests or static configurations.
 */
export function buildConstantThermo(deltaH: number, rhoCp: number): ThermoModel {
  return {
    deltaH: () => deltaH,
    rhoCp:  () => rhoCp,
  };
}
