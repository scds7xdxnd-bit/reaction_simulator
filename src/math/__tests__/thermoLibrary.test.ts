import { describe, it, expect } from 'vitest';
import {
  cpIntegral,
  deltaHrxn,
  keqFromThermo,
  elementMatrix,
  balanceStoich,
  getSpecies,
  allSpeciesIds,
} from '../thermoLibrary';

describe('thermoLibrary', () => {

  describe('cpIntegral', () => {
    it('generic species A — constant Cp = 30 J/mol/K', () => {
      const result = cpIntegral('A', 298, 500);
      expect(result).toBeCloseTo(30 * (500 - 298), 2);
    });

    it('zero integral when T1 === T2', () => {
      expect(cpIntegral('H2O', 400, 400)).toBeCloseTo(0, 8);
    });

    it('H2O from 298 K to 500 K is positive and physically reasonable', () => {
      const dH = cpIntegral('H2O', 298, 500);
      // ~33 J/mol/K average Cp over that range → ~6666 J/mol
      expect(dH).toBeGreaterThan(5000);
      expect(dH).toBeLessThan(10000);
    });

    it('falls back to 30 J/mol/K for unknown species', () => {
      const dH = cpIntegral('UnknownXYZ', 300, 400);
      expect(dH).toBeCloseTo(30 * 100, 5);
    });

    it('NH3 synthesis Cp correction is antisymmetric', () => {
      const fwd = cpIntegral('NH3', 300, 600);
      const rev = cpIntegral('NH3', 600, 300);
      expect(fwd + rev).toBeCloseTo(0, 8);
    });
  });

  describe('deltaHrxn', () => {
    it('water formation at 298 K ≈ −241 826 J/mol', () => {
      // H2 + 0.5 O2 → H2O  (gas phase)
      const dH = deltaHrxn({ H2: -1, O2: -0.5, H2O: 1 }, 298.15);
      expect(dH).toBeCloseTo(-241826, -2);  // within 100 J/mol
    });

    it('CO2 formation at 298 K ≈ −393 510 J/mol', () => {
      // C (not in library) – use a stoichiometry only over library species:
      // CO + 0.5 O2 → CO2  ΔH = −110527 − 0 − (−110527) ... no, use:
      // Direct: dHf298(CO2) − dHf298(CO) − 0.5*dHf298(O2) = −393510 − (−110527) = −282983 J/mol
      const dH = deltaHrxn({ CO: -1, O2: -0.5, CO2: 1 }, 298.15);
      expect(dH).toBeCloseTo(-282983, -2);
    });

    it('generic species ΔHrxn at 298 K uses dHf298 from library', () => {
      // A → R:  dHf298(R) − dHf298(A) = −50000 − 0 = −50000 J/mol
      const dH = deltaHrxn({ A: -1, R: 1 }, 298.15);
      expect(dH).toBeCloseTo(-50000, 0);
    });

    it('reaction enthalpy changes with temperature (non-zero ΔCp)', () => {
      const dH_298 = deltaHrxn({ H2: -1, O2: -0.5, H2O: 1 }, 298.15);
      const dH_800 = deltaHrxn({ H2: -1, O2: -0.5, H2O: 1 }, 800);
      // ΔCp for water formation ≈ 30 − 33 − 0.5*31 ≈ −18.5 J/mol/K (negative)
      // so dH becomes more negative with temperature
      expect(dH_800).toBeLessThan(dH_298);
    });
  });

  describe('keqFromThermo', () => {
    it('NH3 synthesis Keq at 298 K is large (thermodynamically favoured)', () => {
      // N2 + 3 H2 → 2 NH3
      const Keq = keqFromThermo({ N2: -1, H2: -3, NH3: 2 }, 298.15);
      expect(Keq).toBeGreaterThan(1e4);
    });

    it('NH3 synthesis Keq decreases strongly with temperature', () => {
      const Keq_low  = keqFromThermo({ N2: -1, H2: -3, NH3: 2 }, 300);
      const Keq_high = keqFromThermo({ N2: -1, H2: -3, NH3: 2 }, 700);
      expect(Keq_low).toBeGreaterThan(Keq_high);
    });

    it('SO3 synthesis Keq at 700 K is > 1 (contact process is feasible)', () => {
      // SO2 + 0.5 O2 → SO3
      const Keq = keqFromThermo({ SO2: -1, O2: -0.5, SO3: 1 }, 700);
      expect(Keq).toBeGreaterThan(1);
    });

    it('Keq > 0 always', () => {
      const K = keqFromThermo({ CO: -1, O2: -0.5, CO2: 1 }, 1000);
      expect(K).toBeGreaterThan(0);
    });
  });

  describe('elementMatrix', () => {
    it('CO combustion includes C and O', () => {
      const mat = elementMatrix({ CO: -1, O2: -0.5, CO2: 1 });
      expect(mat['C']).toBeDefined();
      expect(mat['O']).toBeDefined();
    });

    it('C count for CO is 1', () => {
      const mat = elementMatrix({ CO: -1, CO2: 1 });
      expect(mat['C']['CO']).toBe(1);
      expect(mat['C']['CO2']).toBe(1);
    });

    it('O count for O2 is 2', () => {
      const mat = elementMatrix({ O2: -0.5 });
      expect(mat['O']['O2']).toBe(2);
    });

    it('unknown species uses its id as a formula (parsed by regex)', () => {
      const mat = elementMatrix({ Foo: -1 });
      // Regex [A-Z][a-z]? matches 'Fo' as one element token, then 'o' is skipped
      expect(mat['Fo']).toBeDefined();
    });
  });

  describe('balanceStoich', () => {
    it('CO + 0.5 O2 → CO2 is balanced', () => {
      const { balanced } = balanceStoich({ CO: -1, O2: -0.5, CO2: 1 });
      expect(balanced).toBe(true);
    });

    it('H2 + 0.5 O2 → H2O is balanced', () => {
      const { balanced } = balanceStoich({ H2: -1, O2: -0.5, H2O: 1 });
      expect(balanced).toBe(true);
    });

    it('CO + O2 → CO2 is NOT balanced (excess O2)', () => {
      const { balanced, unbalanced } = balanceStoich({ CO: -1, O2: -1, CO2: 1 });
      expect(balanced).toBe(false);
      expect(unbalanced).toContain('O');
    });

    it('NH3 synthesis N2 + 3H2 → 2NH3 is balanced', () => {
      const { balanced } = balanceStoich({ N2: -1, H2: -3, NH3: 2 });
      expect(balanced).toBe(true);
    });

    it('generic species react atomically by their single-letter id', () => {
      // A → R: unbalanced (A ≠ R element)
      const { balanced } = balanceStoich({ A: -1, R: 1 });
      expect(balanced).toBe(false);
    });
  });

  describe('library metadata', () => {
    it('library has exactly 60 species', () => {
      expect(allSpeciesIds().length).toBe(60);
    });

    it('getSpecies returns correct mw for H2O', () => {
      const s = getSpecies('H2O');
      expect(s?.mw).toBeCloseTo(18.015, 2);
    });

    it('getSpecies returns undefined for unknown id', () => {
      expect(getSpecies('NoSuchSpecies')).toBeUndefined();
    });

    it('H2O has Antoine constants', () => {
      const s = getSpecies('H2O');
      expect(s?.antoine).toBeDefined();
    });

    it('N2 has correct dHf298 = 0', () => {
      const s = getSpecies('N2');
      expect(s?.dHf298).toBe(0);
    });
  });
});
