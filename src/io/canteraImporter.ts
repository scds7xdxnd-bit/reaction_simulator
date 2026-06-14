/**
 * F24 — Cantera YAML kinetics importer (pure I/O, zero React/Zustand imports)
 *
 * Parses the Cantera YAML subset relevant to homogeneous gas/liquid kinetics:
 *   - species names (name: field)
 *   - elementary reactions (equation + Arrhenius rate-constant A, b, Ea)
 *
 * Unsupported blocks (falloff, three-body, surface, pressure-dependent) are
 * collected in `skipped` rather than failing the parse.
 *
 * Non-goal: thermo NASA7 polynomials are recognised but not imported (the app
 * uses its own species library). Composition is parsed and passed through.
 *
 * Ea unit: The parser honours the `units: { energy: }` block.
 * Default (no units block) = cal/mol (Cantera convention).
 * Output Ea is always in J/mol (SI — matches SimulationParams.Ea).
 */

export interface CanteraSpecies {
  name: string;
  composition?: Record<string, number>;
}

export interface CanteraReaction {
  equation: string;
  A:  number;   // pre-exponential [1/s or m³/(mol·s) depending on reaction order]
  b:  number;   // temperature exponent (Modified Arrhenius)
  Ea: number;   // activation energy [J/mol] — converted from input unit
}

export interface CanteraImportResult {
  species:   CanteraSpecies[];
  reactions: CanteraReaction[];
  skipped:   string[];   // description of skipped items
}

// Reaction types we skip (add to skipped list instead of importing)
const SKIP_TYPES = new Set([
  'falloff', 'three-body', 'pressure-dependent-Arrhenius',
  'Chebyshev', 'surface',
]);

function indent(line: string): number {
  return line.length - line.trimStart().length;
}

/**
 * Parse a Cantera YAML text and extract species names and Arrhenius reactions.
 *
 * @param text  raw Cantera YAML file contents
 */
export function parseCantYaml(text: string): CanteraImportResult {
  const lines    = text.split('\n');
  const species: CanteraSpecies[] = [];
  const reactions: CanteraReaction[] = [];
  const skipped: string[] = [];

  type Section = 'none' | 'species' | 'reactions';
  let section: Section = 'none';
  let eaUnit: 'cal/mol' | 'J/mol' = 'cal/mol';   // Cantera default

  let curSpecName: string | null = null;
  let curSpec: CanteraSpecies | null = null;
  let curRxn: { equation: string; A: number; b: number; Ea: number; type: string } | null = null;
  let inRateConst  = false;
  let rateConstLvl = -1;

  function flushSpec() {
    if (curSpec) { species.push(curSpec); }
    curSpec = null; curSpecName = null;
  }

  function flushRxn() {
    if (!curRxn) return;
    const { equation, A, b, Ea, type } = curRxn;
    if (type && SKIP_TYPES.has(type)) {
      skipped.push(`${equation} (type: ${type})`);
    } else {
      const Ea_J = eaUnit === 'cal/mol' ? Ea * 4.184 : Ea;
      reactions.push({ equation, A, b, Ea: Ea_J });
    }
    curRxn = null;
    inRateConst  = false;
    rateConstLvl = -1;
  }

  for (const rawLine of lines) {
    const line    = rawLine.trimEnd();
    const stripped = line.trim();
    if (!stripped || stripped.startsWith('#')) continue;

    const lvl = indent(line);

    // Detect Ea unit from the `units:` block
    if (stripped.includes('energy:')) {
      const m = stripped.match(/energy:\s*(\S+)/);
      if (m) eaUnit = m[1].toLowerCase().startsWith('j') ? 'J/mol' : 'cal/mol';
    }

    // Top-level (zero-indent) block headers change the active section
    if (lvl === 0 && !stripped.startsWith('-')) {
      if (stripped.startsWith('species:'))   { flushSpec(); flushRxn(); section = 'species';   continue; }
      if (stripped.startsWith('reactions:')) { flushSpec(); flushRxn(); section = 'reactions'; continue; }
      flushSpec(); flushRxn(); section = 'none'; continue;
    }

    // ── Species block ──────────────────────────────────────────────────────
    if (section === 'species') {
      // New list item
      const nameM = stripped.match(/^(?:- )?name:\s*(.+)/);
      if (nameM) {
        flushSpec();
        curSpecName = nameM[1].trim();
        curSpec = { name: curSpecName };
        continue;
      }
      // Inline composition: {C: 1, H: 4}
      if (curSpec) {
        const compM = stripped.match(/^composition:\s*\{([^}]+)\}/);
        if (compM) {
          const comp: Record<string, number> = {};
          for (const pair of compM[1].split(',')) {
            const [el, cnt] = pair.split(':').map(s => s.trim());
            if (el) comp[el] = parseFloat(cnt ?? '1');
          }
          curSpec.composition = comp;
        }
      }
    }

    // ── Reactions block ────────────────────────────────────────────────────
    if (section === 'reactions') {
      // Exit rate-constant sub-block if we return to same/lower indent
      if (inRateConst && lvl <= rateConstLvl) inRateConst = false;

      // New reaction list item
      const eqM = stripped.match(/^(?:- )?equation:\s*(.+)/);
      if (eqM) {
        flushRxn();
        curRxn = { equation: eqM[1].trim(), A: 1e10, b: 0, Ea: 0, type: '' };
        inRateConst = false;
        continue;
      }

      if (curRxn) {
        if (!inRateConst) {
          if (/^type:\s*/.test(stripped))
            curRxn.type = stripped.replace(/^type:\s*/, '').trim();
          if (/^rate-constant:/.test(stripped)) {
            inRateConst  = true;
            rateConstLvl = lvl;
          }
        } else {
          // Inside rate-constant block
          const aM  = stripped.match(/^A:\s*([0-9Ee+.+-]+)/);
          if (aM)  curRxn.A  = parseFloat(aM[1]);
          const bM  = stripped.match(/^b:\s*([0-9Ee+.+-]+)/);
          if (bM)  curRxn.b  = parseFloat(bM[1]);
          const eaM = stripped.match(/^Ea:\s*([0-9Ee+.+-]+)/);
          if (eaM) curRxn.Ea = parseFloat(eaM[1]);
        }
      }
    }
  }

  flushSpec();
  flushRxn();
  return { species, reactions, skipped };
}
