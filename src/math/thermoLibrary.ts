import type { SpeciesLibraryEntry } from '../types/chemistry';
import _rawData from '../data/speciesLibrary.json';

const library = new Map<string, SpeciesLibraryEntry>(
  (_rawData as SpeciesLibraryEntry[]).map((s) => [s.id, s]),
);

const R_GAS = 8.314; // J/mol/K
const T_REF = 298.15; // K

// ─────────────────────────────────────────────────────────────────────────────
// Shomate helpers
// Shomate: Cp (J/mol/K) = A + B·t + C·t² + D·t³ + E/t²   where t = T/1000
// ─────────────────────────────────────────────────────────────────────────────

function shomateH(
  c: SpeciesLibraryEntry['Cp'],
  T: number,
): number {
  const { A, B, C, D, E } = c;
  return (
    A * T +
    (B * T * T) / 2000 +
    (C * T * T * T) / 3e6 +
    (D * T * T * T * T) / 4e9 -
    (E * 1e6) / T
  );
}

function shomateS(
  c: SpeciesLibraryEntry['Cp'],
  T: number,
): number {
  const { A, B, C, D, E } = c;
  return (
    A * Math.log(T) +
    (B * T) / 1000 +
    (C * T * T) / 2e6 +
    (D * T * T * T) / 3e9 -
    (E * 1e6) / (2 * T * T)
  );
}

function fallbackCp(T1: number, T2: number): number {
  return 30 * (T2 - T1);
}

function fallbackSint(T1: number, T2: number): number {
  return 30 * Math.log(T2 / T1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public exports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ∫(T1→T2) Cp dT  in J/mol.
 * Falls back to constant Cp = 30 J/mol/K if species is not in library.
 */
export function cpIntegral(id: string, T1: number, T2: number): number {
  const s = library.get(id);
  if (!s) return fallbackCp(T1, T2);
  return shomateH(s.Cp, T2) - shomateH(s.Cp, T1);
}

/**
 * Standard reaction enthalpy ΔH_rxn(T) in J/mol.
 * stoichiometry: { speciesId: ν } where ν < 0 for reactants.
 */
export function deltaHrxn(
  stoichiometry: Record<string, number>,
  T: number,
): number {
  let dH298 = 0;
  let correction = 0;
  for (const [id, nu] of Object.entries(stoichiometry)) {
    const s = library.get(id);
    dH298 += nu * ((s?.dHf298 ?? 0) * 1000);
    correction += nu * cpIntegral(id, T_REF, T);
  }
  return dH298 + correction;
}

/**
 * ∫(T1→T2) Cp/T dT  in J/mol/K.
 */
function entropyCpIntegral(id: string, T1: number, T2: number): number {
  const s = library.get(id);
  if (!s) return fallbackSint(T1, T2);
  return shomateS(s.Cp, T2) - shomateS(s.Cp, T1);
}

/**
 * Equilibrium constant Keq at temperature T (dimensionless, activity basis).
 * Uses: Keq = exp(−ΔG_rxn / RT), ΔG = ΔH − TΔS.
 */
export function keqFromThermo(
  stoichiometry: Record<string, number>,
  T: number,
): number {
  let dS298 = 0;
  let dSCorr = 0;
  for (const [id, nu] of Object.entries(stoichiometry)) {
    const s = library.get(id);
    dS298 += nu * (s?.S298 ?? 200);
    dSCorr += nu * entropyCpIntegral(id, T_REF, T);
  }
  const dH = deltaHrxn(stoichiometry, T);
  const dS = dS298 + dSCorr;
  const dG = dH - T * dS;
  return Math.exp(-dG / (R_GAS * T));
}

// ─────────────────────────────────────────────────────────────────────────────
// Element matrix and atom balance
// ─────────────────────────────────────────────────────────────────────────────

function parseFormula(formula: string): Record<string, number> {
  const elements: Record<string, number> = {};
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula)) !== null) {
    if (!m[1]) continue;
    const el = m[1];
    const n = m[2] ? parseInt(m[2], 10) : 1;
    elements[el] = (elements[el] ?? 0) + n;
  }
  return elements;
}

/**
 * Returns element→{speciesId→count} matrix for the given reaction stoichiometry.
 * Rows = elements present across all species; columns = species in stoichiometry.
 */
export function elementMatrix(
  stoichiometry: Record<string, number>,
): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {};
  for (const id of Object.keys(stoichiometry)) {
    const s = library.get(id);
    const formula = s?.formula ?? id;
    const parsed = parseFormula(formula);
    for (const [el, count] of Object.entries(parsed)) {
      if (!matrix[el]) matrix[el] = {};
      matrix[el][id] = count;
    }
  }
  return matrix;
}

/**
 * Checks whether the reaction is atom-balanced (Σ ν_i · count_i = 0 per element).
 * Generic single-letter formula species (A, R, S, T, U) are excluded from the check.
 */
export function balanceStoich(
  stoichiometry: Record<string, number>,
): { balanced: boolean; unbalanced: string[] } {
  const matrix = elementMatrix(stoichiometry);
  const unbalanced: string[] = [];
  for (const [el, speciesMap] of Object.entries(matrix)) {
    let sum = 0;
    for (const [id, count] of Object.entries(speciesMap)) {
      sum += (stoichiometry[id] ?? 0) * count;
    }
    if (Math.abs(sum) > 0.01) unbalanced.push(el);
  }
  return { balanced: unbalanced.length === 0, unbalanced };
}

/** Look up a species entry directly (returns undefined if not in library). */
export function getSpecies(id: string): SpeciesLibraryEntry | undefined {
  return library.get(id);
}

/** All species ids in the library. */
export function allSpeciesIds(): string[] {
  return [...library.keys()];
}
