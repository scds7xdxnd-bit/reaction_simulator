/**
 * F24 — Cantera YAML kinetics exporter (pure I/O, zero React/Zustand imports)
 *
 * Formats the app's current reaction parameters as a Cantera YAML file
 * compatible with Cantera ≥ 2.6.
 *
 * - Ea is stored internally in J/mol; exported as cal/mol (Cantera default).
 * - k (rate constant at reference temperature) is exported as `A` with b=0
 *   when no Modified-Arrhenius data is present.
 * - CustomReaction species are exported; generic species (A, R, S, T, U)
 *   use placeholder compositions.
 */

const R_gas = 8.314; // J/(mol·K)

export interface ExportReaction {
  equation: string;
  A:        number;  // pre-exponential [same units as in-app]
  b:        number;  // temperature exponent
  Ea:       number;  // activation energy [J/mol]
}

export interface ExportSpecies {
  name:        string;
  composition: Record<string, number>;  // element → count
}

/**
 * Generate a Cantera YAML string for a set of species and reactions.
 *
 * @param species    list of species with elemental composition
 * @param reactions  list of Arrhenius reactions
 * @param meta       optional header metadata
 */
export function toCanteraYaml(
  species:   ExportSpecies[],
  reactions: ExportReaction[],
  meta: { description?: string; generator?: string } = {},
): string {
  const header = [
    `description: ${meta.description ?? 'Exported from Reaction Simulator'}`,
    `generator: ${meta.generator ?? 'reaction-simulator'}`,
    `cantera-version: '2.6'`,
    '',
    'units: {length: m, time: s, quantity: mol, energy: cal/mol}',
  ].join('\n');

  const speciesBlock = species.length > 0
    ? [
        '',
        'species:',
        ...species.map(s => {
          const comp = Object.entries(s.composition)
            .map(([el, n]) => `${el}: ${n}`)
            .join(', ');
          return `- name: ${s.name}\n  composition: {${comp}}`;
        }),
      ].join('\n')
    : '';

  const rxnBlock = reactions.length > 0
    ? [
        '',
        'reactions:',
        ...reactions.map(r => {
          const Ea_cal = (r.Ea / 4.184).toFixed(2);  // J/mol → cal/mol
          return [
            `- equation: ${r.equation}`,
            `  rate-constant:`,
            `    A: ${r.A.toExponential(4)}`,
            `    b: ${r.b.toFixed(3)}`,
            `    Ea: ${Ea_cal}`,
          ].join('\n');
        }),
      ].join('\n')
    : '';

  return [header, speciesBlock, rxnBlock].filter(Boolean).join('\n') + '\n';
}

/**
 * Build a Cantera YAML export from the app's SimulationParams.
 *
 * For standard (built-in) kinetics, generates a single reaction "A => B"
 * with k at T_ref as the pre-exponential. For custom reactions, uses the
 * species and equations from customReaction.
 *
 * @param params  current SimulationParams from the store
 */
export function paramsToCanteraYaml(params: {
  k:         number;
  Ea:        number;
  T_ref:     number;
  kinetics:  string;
  customReaction: {
    reactions: { reactants: { species: string; coeff: number }[]; products: { species: string; coeff: number }[]; rateParams: Record<string, number> }[];
    speciesMeta?: Record<string, { boundLibraryId?: string; feedConc?: number; phase?: string }>;
    keyReactantId?: string;
  } | null;
}): string {
  const GENERIC_COMP: Record<string, Record<string, number>> = {
    A: { A: 1 }, B: { B: 1 }, R: { R: 1 }, S: { S: 1 }, T: { T: 1 }, U: { U: 1 },
  };

  if (params.customReaction) {
    const net = params.customReaction;
    const speciesSet = new Set<string>();
    for (const rxn of net.reactions) {
      for (const r of rxn.reactants) speciesSet.add(r.species);
      for (const p of rxn.products) speciesSet.add(p.species);
    }
    const speciesOut: ExportSpecies[] = [...speciesSet].map(sym => ({
      name: sym,
      composition: GENERIC_COMP[sym] ?? { X: 1 },
    }));

    const reactionsOut: ExportReaction[] = net.reactions.map(rxn => {
      const lhs = rxn.reactants.map(t => t.coeff === 1 ? t.species : `${t.coeff} ${t.species}`).join(' + ');
      const rhs = rxn.products.map(t => t.coeff === 1 ? t.species : `${t.coeff} ${t.species}`).join(' + ');
      const rp = rxn.rateParams;
      return {
        equation: `${lhs} => ${rhs}`,
        A:  rp.A ?? rp.k ?? params.k,
        b:  rp.n ?? 0,
        Ea: rp.Ea ?? params.Ea,
      };
    });

    return toCanteraYaml(speciesOut, reactionsOut, { description: 'Custom network exported from Reaction Simulator' });
  }

  // Standard kinetics — single A => B step
  // Back-calculate A from k(T_ref) = A·exp(-Ea/R/T_ref) → A = k·exp(Ea/R/T_ref)
  const A = params.Ea > 0
    ? params.k * Math.exp(params.Ea / (R_gas * Math.max(params.T_ref, 1)))
    : params.k;

  const sp: ExportSpecies[] = [
    { name: 'A', composition: { A: 1 } },
    { name: 'B', composition: { B: 1 } },
  ];
  const rxn: ExportReaction = {
    equation: 'A => B',
    A,
    b:  0,
    Ea: params.Ea,
  };

  return toCanteraYaml(sp, [rxn], {
    description: `${params.kinetics} kinetics exported from Reaction Simulator`,
  });
}
