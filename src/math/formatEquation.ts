import type { CustomSpecies } from '../types/simulation';

export function formatEquation(species: CustomSpecies[], reversible?: boolean): string {
  const fmt = (s: CustomSpecies) => s.stoich === 1 ? s.label : `${s.stoich}${s.label}`;
  const reactants = species.filter((s) => s.role === 'reactant').map(fmt).join(' + ');
  const products  = species.filter((s) => s.role === 'product').map(fmt).join(' + ');
  const arrow = reversible ? '⇌' : '→';
  return reactants && products ? `${reactants} ${arrow} ${products}` : '?';
}

export function formatNetworkLabel(
  reactions: { reactants?: { species: string }[]; products?: { species: string }[] }[],
): string {
  if (reactions.length === 0) return '';
  const r = reactions[0];
  const lhs = (r.reactants ?? []).map((x) => x.species).join('+');
  const rhs = (r.products ?? []).map((x) => x.species).join('+');
  const extra = reactions.length > 1 ? ` +${reactions.length - 1}` : '';
  return lhs && rhs ? `${lhs}→${rhs}${extra}` : '';
}
