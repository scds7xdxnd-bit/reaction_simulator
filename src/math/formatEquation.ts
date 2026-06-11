import type { CustomSpecies } from '../types/simulation';

export function formatEquation(species: CustomSpecies[], reversible?: boolean): string {
  const fmt = (s: CustomSpecies) => s.stoich === 1 ? s.label : `${s.stoich}${s.label}`;
  const reactants = species.filter((s) => s.role === 'reactant').map(fmt).join(' + ');
  const products  = species.filter((s) => s.role === 'product').map(fmt).join(' + ');
  const arrow = reversible ? '⇌' : '→';
  return reactants && products ? `${reactants} ${arrow} ${products}` : '?';
}
