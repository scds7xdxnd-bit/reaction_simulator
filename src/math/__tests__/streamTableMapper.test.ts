import { describe, it, expect } from 'vitest';
import {
  buildHMBTable,
  hmbTableToCSV,
  hmbTableToMarkdown,
} from '../streamTableMapper';
import type { AnnotatedStream } from '../../types/stream';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeStream(
  F: Record<string, number>,
  T: number,
  P: number,
  label?: string,
  desc?: string,
): AnnotatedStream {
  return { F, T, P, streamLabel: label, streamDesc: desc };
}

// ─── F20.1: HMBStreamRow properties ──────────────────────────────────────────

describe('F20 — buildHMBTable row properties', () => {
  // Simple single-stream case: generic species A, F_A=2 mol/s, T=373.15K, P=2e5 Pa
  // T_C = 373.15 − 273.15 = 100 °C
  // P_bar = 2e5 / 1e5 = 2 bar
  // F_total = 2 mol/s
  // mass_total = 2 × 100 g/mol (FALLBACK_MW for 'A') = 200 g/s
  // x_mol_A = 1.0
  it('converts T, P, flow, mass correctly for generic species', () => {
    const streams: Record<string, AnnotatedStream> = {
      'e1': makeStream({ A: 2 }, 373.15, 2e5, 'S01', 'Feed → Rxr'),
    };
    const table = buildHMBTable(streams, [], ['e1'], []);
    const row = table.streams[0];

    expect(row.T_C).toBeCloseTo(100, 4);
    expect(row.P_bar).toBeCloseTo(2, 6);
    expect(row.F_total_mol_s).toBeCloseTo(2, 6);
    // mass = 2 mol/s × 100 g/mol = 200 g/s  (FALLBACK_MW for 'A')
    expect(row.mass_total_g_s).toBeCloseTo(200, 4);
    expect(row.x_mol['A']).toBeCloseTo(1.0, 6);
    expect(row.isRecycle).toBe(false);
  });

  // Two-species stream: F_A=1, F_R=1 mol/s → x_A=0.5, x_R=0.5
  it('computes mole fractions for binary stream', () => {
    const streams: Record<string, AnnotatedStream> = {
      'e1': makeStream({ A: 1, R: 1 }, 300, 101325, 'S01', 'Rxr → Product'),
    };
    const table = buildHMBTable(streams, [], [], ['e1']);
    const row = table.streams[0];

    expect(row.F_total_mol_s).toBeCloseTo(2, 6);
    expect(row.x_mol['A']).toBeCloseTo(0.5, 6);
    expect(row.x_mol['R']).toBeCloseTo(0.5, 6);
    // mass = (1+1) × 100 = 200 g/s
    expect(row.mass_total_g_s).toBeCloseTo(200, 4);
  });

  // Real species: F_H2=1 mol/s, T=298.15K → molar mass H2 = 2.016 g/mol
  // mass = 1 × 2.016 = 2.016 g/s
  it('uses library molar mass for real species (H2)', () => {
    const streams: Record<string, AnnotatedStream> = {
      'e1': makeStream({ H2: 1 }, 298.15, 101325, 'S01', 'Feed'),
    };
    const table = buildHMBTable(streams, [], ['e1'], []);
    const row = table.streams[0];
    // MW(H2) = 2.016 g/mol
    expect(row.mass_g_s['H2']).toBeCloseTo(2.016, 3);
    expect(row.mass_total_g_s).toBeCloseTo(2.016, 3);
  });

  // Enthalpy at reference temperature (T=298.15K):
  // H = ΔHf° + ∫(298.15→298.15) Cp dT = ΔHf°
  // For generic 'A': dHf=0, hSens=0 → H = 0 kJ/mol
  it('molar enthalpy = dHf° at reference temperature', () => {
    const streams: Record<string, AnnotatedStream> = {
      'e1': makeStream({ A: 1 }, 298.15, 101325, 'S01'),
    };
    const table = buildHMBTable(streams, [], ['e1'], []);
    expect(table.streams[0].H_kJ_mol).toBeCloseTo(0, 4);
  });

  // Enthalpy above reference: for generic 'A', Cp_fallback=30 J/(mol·K)
  // H = 30 × (350 − 298.15) / 1000 = 30 × 51.85 / 1000 = 1.5555 kJ/mol
  it('molar enthalpy above reference: H = 30×(T−298.15)/1000 for generic species', () => {
    const T = 350;
    const streams: Record<string, AnnotatedStream> = {
      'e1': makeStream({ A: 1 }, T, 101325, 'S01'),
    };
    const table = buildHMBTable(streams, [], ['e1'], []);
    const expected = 30 * (T - 298.15) / 1000; // kJ/mol
    expect(table.streams[0].H_kJ_mol).toBeCloseTo(expected, 4);
  });

  // Recycle flag
  it('marks recycle streams', () => {
    const streams: Record<string, AnnotatedStream> = {
      'e1': makeStream({ A: 1 }, 300, 101325, 'S01'),
      'e2': makeStream({ A: 0.5 }, 300, 101325, 'S02'),
    };
    const table = buildHMBTable(streams, ['e2'], [], []);
    const s1 = table.streams.find(r => r.edgeId === 'e1')!;
    const s2 = table.streams.find(r => r.edgeId === 'e2')!;
    expect(s1.isRecycle).toBe(false);
    expect(s2.isRecycle).toBe(true);
  });
});

// ─── F20.2: Atom balance closure ─────────────────────────────────────────────

describe('F20 — atom balance closure', () => {
  // 2H2 + O2 → 2H2O  (stoichiometric, no by-products)
  // Feed: F_H2=2, F_O2=1  |  Product: F_H2O=2
  // H atoms: in = 2×2 = 4, out = 2×2 = 4  → error = 0 %
  // O atoms: in = 2×1 = 2, out = 1×2 = 2  → error = 0 %
  // Mass in:  2×2.016 + 1×31.999 = 36.031 g/s
  // Mass out: 2×18.015 = 36.030 g/s  → error < 0.01 % → closed = true
  it('2H2 + O2 → 2H2O: atom balance closes within 0.1 %', () => {
    const streams: Record<string, AnnotatedStream> = {
      'feed': makeStream({ H2: 2, O2: 1 }, 300, 101325, 'S01', 'Feed'),
      'prod': makeStream({ H2O: 2 }, 373.15, 101325, 'S02', 'Product'),
    };
    const table = buildHMBTable(streams, [], ['feed'], ['prod']);

    expect(table.elements['H'].inlet_mol_s).toBeCloseTo(4, 6);
    expect(table.elements['H'].outlet_mol_s).toBeCloseTo(4, 6);
    expect(table.elements['H'].errorPct).toBeCloseTo(0, 4);

    expect(table.elements['O'].inlet_mol_s).toBeCloseTo(2, 6);
    expect(table.elements['O'].outlet_mol_s).toBeCloseTo(2, 6);
    expect(table.elements['O'].errorPct).toBeCloseTo(0, 4);

    // mass balance within MW rounding
    expect(table.massBalance.errorPct).toBeLessThan(0.1);
    expect(table.closed).toBe(true);
  });

  // Imbalanced case: feed H2=1, product H2O=1 → O missing from feed
  // O atoms: in = 0, out = 1 → error = 100 %
  it('imbalanced case: closed = false, large O error', () => {
    const streams: Record<string, AnnotatedStream> = {
      'feed': makeStream({ H2: 1 }, 300, 101325, 'S01'),
      'prod': makeStream({ H2O: 1 }, 373.15, 101325, 'S02'),
    };
    const table = buildHMBTable(streams, [], ['feed'], ['prod']);
    expect(table.elements['O'].errorPct).toBeCloseTo(100, 2);
    expect(table.closed).toBe(false);
  });

  // No feed/product edges → balance undefined, closed = false
  it('no feed/product edges → closed = false, empty elements', () => {
    const streams: Record<string, AnnotatedStream> = {
      'e1': makeStream({ A: 1 }, 300, 101325, 'S01'),
    };
    const table = buildHMBTable(streams, [], [], []);
    expect(table.closed).toBe(false);
    expect(Object.keys(table.elements)).toHaveLength(0);
  });

  // Generic species (A, R) excluded from atom balance — only mass balance checked
  it('generic species (A, R) excluded from atom balance (no formula)', () => {
    const streams: Record<string, AnnotatedStream> = {
      'feed': makeStream({ A: 1 }, 300, 101325, 'S01'),
      'prod': makeStream({ R: 1 }, 300, 101325, 'S02'),
    };
    const table = buildHMBTable(streams, [], ['feed'], ['prod']);
    // No element entries since A and R have no formula
    expect(Object.keys(table.elements)).toHaveLength(0);
    // Mass balance: 1×100 vs 1×100 = exact
    expect(table.massBalance.errorPct).toBeCloseTo(0, 6);
    expect(table.closed).toBe(true);
  });
});

// ─── F20.3: Export functions ──────────────────────────────────────────────────

describe('F20 — export functions', () => {
  const streams: Record<string, AnnotatedStream> = {
    'e1': makeStream({ A: 1, R: 0.5 }, 373.15, 2e5, 'S01', 'Feed → Rxr'),
  };
  const table = buildHMBTable(streams, [], ['e1'], []);

  it('CSV has correct header with stream label', () => {
    const csv = hmbTableToCSV(table);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Stream');
    expect(lines[0]).toContain('T (C)');
    expect(lines[0]).toContain('F_A (mol/s)');
    expect(lines[1]).toContain('S01');
  });

  it('Markdown has pipe-delimited header', () => {
    const md = hmbTableToMarkdown(table);
    expect(md).toContain('| Stream |');
    expect(md).toContain('| --- |');
    expect(md).toContain('S01');
  });
});

// ─── F20.4: speciesIds order & stream ordering ────────────────────────────────

describe('F20 — table structure', () => {
  it('speciesIds is sorted alphabetically', () => {
    const streams: Record<string, AnnotatedStream> = {
      'e1': makeStream({ R: 1, A: 2, S: 0.5 }, 300, 101325, 'S01'),
    };
    const { speciesIds } = buildHMBTable(streams, [], [], []);
    expect(speciesIds).toEqual([...speciesIds].sort());
  });

  it('streams sorted by label (S01 before S02)', () => {
    const annotated: Record<string, AnnotatedStream> = {
      'e2': makeStream({ A: 0.5 }, 300, 101325, 'S02'),
      'e1': makeStream({ A: 1   }, 300, 101325, 'S01'),
    };
    const table = buildHMBTable(annotated, [], [], []);
    expect(table.streams[0].label).toBe('S01');
    expect(table.streams[1].label).toBe('S02');
  });
});
