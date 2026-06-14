/**
 * F24 — Interoperability tests
 *
 * Covers Cantera YAML import/export round-trip and schema validation.
 */
import { describe, it, expect } from 'vitest';
import { parseCantYaml } from '../../io/canteraImporter';
import { toCanteraYaml, paramsToCanteraYaml } from '../../io/canteraExporter';

// ─── Cantera YAML importer ────────────────────────────────────────────────────

const SIMPLE_CANTERA = `
description: test mechanism
generator: test
units: {length: m, time: s, quantity: mol, energy: cal/mol}

species:
- name: H2
  composition: {H: 2}
- name: O2
  composition: {O: 2}
- name: H2O
  composition: {H: 2, O: 1}

reactions:
- equation: H2 + O2 => H2O
  rate-constant:
    A: 1.0e10
    b: 0.0
    Ea: 8000
`;

const SKIPPABLE_CANTERA = `
units: {energy: cal/mol}

reactions:
- equation: A => B
  rate-constant:
    A: 5.0e8
    b: 0.5
    Ea: 12000
- equation: B + M => C + M
  type: three-body
  rate-constant:
    A: 1.0e12
    b: 0.0
    Ea: 0
- equation: A => D
  type: falloff
  rate-constant:
    A: 2.0e9
    b: 0.0
    Ea: 5000
`;

describe('parseCantYaml — species', () => {
  it('extracts 3 species from simple mechanism', () => {
    const r = parseCantYaml(SIMPLE_CANTERA);
    expect(r.species.map(s => s.name)).toEqual(['H2', 'O2', 'H2O']);
  });

  it('parses elemental composition on H2O', () => {
    const r = parseCantYaml(SIMPLE_CANTERA);
    const h2o = r.species.find(s => s.name === 'H2O');
    expect(h2o?.composition).toEqual({ H: 2, O: 1 });
  });
});

describe('parseCantYaml — reactions', () => {
  it('imports 1 Arrhenius reaction from simple mechanism', () => {
    const r = parseCantYaml(SIMPLE_CANTERA);
    expect(r.reactions).toHaveLength(1);
    expect(r.reactions[0].equation).toBe('H2 + O2 => H2O');
  });

  it('converts Ea from cal/mol to J/mol (×4.184)', () => {
    // Ea_input = 8000 cal/mol → Ea_J = 8000 × 4.184 = 33472 J/mol
    const r = parseCantYaml(SIMPLE_CANTERA);
    expect(r.reactions[0].Ea).toBeCloseTo(8000 * 4.184, 0);
  });

  it('reads A and b coefficients', () => {
    const r = parseCantYaml(SIMPLE_CANTERA);
    expect(r.reactions[0].A).toBeCloseTo(1.0e10, 0);
    expect(r.reactions[0].b).toBeCloseTo(0.0, 5);
  });

  it('skips three-body and falloff reactions, keeps elementary', () => {
    const r = parseCantYaml(SKIPPABLE_CANTERA);
    // Only A=>B should be imported; B+M=>C+M and A=>D should be skipped
    expect(r.reactions).toHaveLength(1);
    expect(r.reactions[0].equation).toBe('A => B');
    expect(r.skipped).toHaveLength(2);
    expect(r.skipped[0]).toContain('three-body');
    expect(r.skipped[1]).toContain('falloff');
  });

  it('reads b = 0.5 for modified Arrhenius', () => {
    const r = parseCantYaml(SKIPPABLE_CANTERA);
    expect(r.reactions[0].b).toBeCloseTo(0.5, 5);
  });
});

describe('parseCantYaml — J/mol units', () => {
  it('does NOT multiply by 4.184 when units block says J/mol', () => {
    const yaml = `
units: {energy: J/mol}
reactions:
- equation: A => B
  rate-constant:
    A: 1.0e8
    b: 0.0
    Ea: 50000
`;
    const r = parseCantYaml(yaml);
    // Ea should be 50000 J/mol (no conversion)
    expect(r.reactions[0].Ea).toBeCloseTo(50000, 0);
  });
});

// ─── Cantera YAML exporter ────────────────────────────────────────────────────

describe('toCanteraYaml', () => {
  it('produces valid YAML header with cantera-version', () => {
    const yaml = toCanteraYaml(
      [{ name: 'A', composition: { A: 1 } }],
      [{ equation: 'A => B', A: 1e10, b: 0.5, Ea: 50000 }],
    );
    expect(yaml).toContain("cantera-version: '2.6'");
    expect(yaml).toContain('energy: cal/mol');
  });

  it('converts Ea from J/mol to cal/mol in export (÷ 4.184)', () => {
    // Ea = 50000 J/mol → 50000/4.184 = 11952.9 cal/mol
    const yaml = toCanteraYaml([], [{ equation: 'A => B', A: 1e10, b: 0, Ea: 50000 }]);
    const eaLine = yaml.split('\n').find(l => l.trim().startsWith('Ea:'));
    const val = parseFloat(eaLine!.replace('Ea:', '').trim());
    expect(val).toBeCloseTo(50000 / 4.184, 0);
  });

  it('includes species and reactions blocks when non-empty', () => {
    const yaml = toCanteraYaml(
      [{ name: 'A', composition: { A: 1 } }],
      [{ equation: 'A => B', A: 1e10, b: 0, Ea: 0 }],
    );
    expect(yaml).toContain('species:');
    expect(yaml).toContain('- name: A');
    expect(yaml).toContain('reactions:');
    expect(yaml).toContain('equation: A => B');
  });
});

describe('paramsToCanteraYaml — round-trip', () => {
  it('exports single A=>B reaction from standard kinetics', () => {
    const yaml = paramsToCanteraYaml({
      k: 1.0, Ea: 50000, T_ref: 350, kinetics: 'first-order', customReaction: null,
    });
    expect(yaml).toContain('equation: A => B');
    const r = parseCantYaml(yaml);
    expect(r.reactions).toHaveLength(1);
    // Ea round-trip: exported in cal/mol, re-imported as J/mol → should match ±0.5 J/mol
    expect(r.reactions[0].Ea).toBeCloseTo(50000, -1); // within 1 J/mol
  });

  it('back-calculates A from k(T_ref) and Ea when Ea > 0', () => {
    // k(T_ref) = A × exp(-Ea / R / T_ref)
    // → A = k × exp(Ea / R / T_ref)
    const k = 0.5, Ea = 40000, T = 350;
    const yaml = paramsToCanteraYaml({ k, Ea, T_ref: T, kinetics: 'first-order', customReaction: null });
    const r = parseCantYaml(yaml);
    // Verify that A × exp(-Ea/R/T) ≈ k (round-trip)
    const A_calc = r.reactions[0].A;
    const k_reconstructed = A_calc * Math.exp(-Ea / (8.314 * T));
    expect(k_reconstructed).toBeCloseTo(k, 2);
  });
});
