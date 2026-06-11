export interface ReactionTerm {
  species: string;
  coeff: number;
}

export interface ParsedReaction {
  reactants: ReactionTerm[];
  products: ReactionTerm[];
  reversible: boolean;
  raw: string;
}

function parseSide(side: string): ReactionTerm[] {
  return side
    .split('+')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .flatMap((term): ReactionTerm[] => {
      const withCoeff = term.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]\w*)$/);
      if (withCoeff) return [{ coeff: parseFloat(withCoeff[1]), species: withCoeff[2] }];
      const plain = term.match(/^([A-Za-z]\w*)$/);
      if (plain) return [{ coeff: 1, species: plain[1] }];
      return [];
    });
}

export function parseEquations(text: string): ParsedReaction[] {
  const results: ParsedReaction[] = [];

  const segments = text.split('\n').flatMap((line) => line.split(','));

  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;

    if (trimmed.includes('<->')) {
      const idx = trimmed.indexOf('<->');
      const lhs = trimmed.slice(0, idx).trim();
      const rhs = trimmed.slice(idx + 3).trim();
      results.push({
        reactants: parseSide(lhs),
        products: parseSide(rhs),
        reversible: true,
        raw: trimmed,
      });
      continue;
    }

    const parts = trimmed.split('->').map((p) => p.trim());
    if (parts.length >= 2) {
      for (let i = 0; i < parts.length - 1; i++) {
        const raw = `${parts[i]} -> ${parts[i + 1]}`;
        results.push({
          reactants: parseSide(parts[i]),
          products: parseSide(parts[i + 1]),
          reversible: false,
          raw,
        });
      }
    }
  }

  return results;
}
