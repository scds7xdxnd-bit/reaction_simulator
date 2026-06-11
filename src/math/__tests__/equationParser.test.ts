import { describe, it, expect } from 'vitest';
import { parseEquations } from '../equationParser';

describe('parseEquations', () => {
  it('chain shorthand A -> R -> S produces 2 reactions', () => {
    const result = parseEquations('A -> R -> S');
    expect(result).toHaveLength(2);
    expect(result[0].reactants).toEqual([{ species: 'A', coeff: 1 }]);
    expect(result[0].products).toEqual([{ species: 'R', coeff: 1 }]);
    expect(result[0].reversible).toBe(false);
    expect(result[1].reactants).toEqual([{ species: 'R', coeff: 1 }]);
    expect(result[1].products).toEqual([{ species: 'S', coeff: 1 }]);
    expect(result[1].reversible).toBe(false);
  });

  it('comma separation A + B -> R, A -> S produces 2 reactions', () => {
    const result = parseEquations('A + B -> R, A -> S');
    expect(result).toHaveLength(2);
    expect(result[0].reactants).toEqual([
      { species: 'A', coeff: 1 },
      { species: 'B', coeff: 1 },
    ]);
    expect(result[0].products).toEqual([{ species: 'R', coeff: 1 }]);
    expect(result[1].reactants).toEqual([{ species: 'A', coeff: 1 }]);
    expect(result[1].products).toEqual([{ species: 'S', coeff: 1 }]);
  });

  it('reversible A <-> R sets reversible flag', () => {
    const result = parseEquations('A <-> R');
    expect(result).toHaveLength(1);
    expect(result[0].reversible).toBe(true);
    expect(result[0].reactants).toEqual([{ species: 'A', coeff: 1 }]);
    expect(result[0].products).toEqual([{ species: 'R', coeff: 1 }]);
  });

  it('stoichiometric coefficient 2A -> R parses correctly', () => {
    const result = parseEquations('2A -> R');
    expect(result).toHaveLength(1);
    expect(result[0].reactants).toEqual([{ species: 'A', coeff: 2 }]);
    expect(result[0].products).toEqual([{ species: 'R', coeff: 1 }]);
  });

  it('multi-line input parses each line independently', () => {
    const result = parseEquations('A -> R\nB -> S');
    expect(result).toHaveLength(2);
    expect(result[0].reactants[0].species).toBe('A');
    expect(result[1].reactants[0].species).toBe('B');
  });

  it('empty and whitespace-only segments are skipped', () => {
    expect(parseEquations('  ')).toHaveLength(0);
    expect(parseEquations('')).toHaveLength(0);
  });
});
