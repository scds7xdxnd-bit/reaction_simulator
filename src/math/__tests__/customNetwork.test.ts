import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { solveNetwork } from '../networkSolver';
import { buildCustomNetworkPreset } from '../reactionRegistry';
import { buildThermoModel } from '../thermoModel';
import { migrateCustomReaction } from '../../io/serializer';
import type { SimulationParams } from '../../types/reactor';
import type { CustomReactionNetwork } from '../../types/simulation';

const baseParams: SimulationParams = {
  reactionMode: 'custom',
  kinetics: 'first-order',
  k: 0.5,
  k2: 0.3,
  k3: 0.1,
  Cb0: 1.0,
  k4: 0.1,
  Keq_ref: 4.0,
  Ca0: 1.0,
  Cr0_fraction: 0,
  T_ref: 300,
  Ea: 0,
  delta_H: 0,
  rho_Cp: 1,
  T_feed: 300,
  epsilon: 0,
  Q_feed: 0,
  recycleMethod: 'direct',
  customReaction: null,
};

const cstrNodes = [
  { id: 'feed-1', type: 'feed',    position: { x: 0, y: 0 },   data: {} },
  { id: 'cstr-1', type: 'cstr',    position: { x: 200, y: 0 }, data: { reactorType: 'CSTR', tau: 1, thermalMode: 'isothermal', label: 'R1' } },
  { id: 'prod-1', type: 'product', position: { x: 400, y: 0 }, data: {} },
] as unknown as Node[];

const cstrEdges = [
  { id: 'e1', source: 'feed-1', target: 'cstr-1' },
  { id: 'e2', source: 'cstr-1', target: 'prod-1' },
] as unknown as Edge[];

describe('F35 — Custom Network Golden Equivalence Tests', () => {
  it('Denbigh equivalence: custom network matches denbighPreset within 1e-6', () => {
    // Expected: same k1..k4 as used by the canned denbighPreset
    // CSTR isothermal, τ=1, Ca0=1:
    //   A→R (k1=1), A→T (k2=0.5), R→S (k3=2), R→U (k4=1)
    const denbighParams: SimulationParams = {
      ...baseParams,
      reactionMode: 'denbigh',
      k: 1.0,
      k2: 0.5,
      k3: 2.0,
      k4: 1.0,
      customReaction: null,
    };

    const network: CustomReactionNetwork = {
      reactions: [
        { id: 'cr-1', reactants: [{ species: 'A', coeff: 1 }], products: [{ species: 'R', coeff: 1 }], reversible: false, rateType: 'power-law', rateParams: { k: 1.0, Ea: 0, T_ref: 300 } },
        { id: 'cr-2', reactants: [{ species: 'A', coeff: 1 }], products: [{ species: 'T', coeff: 1 }], reversible: false, rateType: 'power-law', rateParams: { k: 0.5, Ea: 0, T_ref: 300 } },
        { id: 'cr-3', reactants: [{ species: 'R', coeff: 1 }], products: [{ species: 'S', coeff: 1 }], reversible: false, rateType: 'power-law', rateParams: { k: 2.0, Ea: 0, T_ref: 300 } },
        { id: 'cr-4', reactants: [{ species: 'R', coeff: 1 }], products: [{ species: 'U', coeff: 1 }], reversible: false, rateType: 'power-law', rateParams: { k: 1.0, Ea: 0, T_ref: 300 } },
      ],
      speciesMeta: {},
      keyReactantId: 'A',
    };

    const customParams: SimulationParams = {
      ...baseParams,
      k: 1.0,
      k2: 0.5,
      k3: 2.0,
      k4: 1.0,
      customReaction: network,
    };

    const builtinResult = solveNetwork(cstrNodes, cstrEdges, denbighParams);
    const customResult = solveNetwork(cstrNodes, cstrEdges, customParams);

    expect(builtinResult).not.toBeNull();
    expect(customResult).not.toBeNull();
    expect(builtinResult!.converged).toBe(true);
    expect(customResult!.converged).toBe(true);

    // Species concentrations must match exactly
    const bSeg = builtinResult!.segments[0];
    const cSeg = customResult!.segments[0];
    expect(Math.abs(bSeg.Ca_out - cSeg.Ca_out)).toBeLessThan(1e-6);
    expect(Math.abs(bSeg.Cr_out - cSeg.Cr_out)).toBeLessThan(1e-6);
    expect(Math.abs(bSeg.Cs_out - cSeg.Cs_out)).toBeLessThan(1e-6);
    // Both should have same conversion
    expect(Math.abs(bSeg.Xa_out - cSeg.Xa_out)).toBeLessThan(1e-6);
  });

  it('Parallel equivalence: custom network matches parallelPreset within 1e-6', () => {
    // Expected: A→R (k1), A→S (k2) parallel, CSTR isothermal τ=1
    const parallelParams: SimulationParams = {
      ...baseParams,
      reactionMode: 'parallel',
      k: 0.5,
      k2: 0.8,
      customReaction: null,
    };

    const network: CustomReactionNetwork = {
      reactions: [
        { id: 'cr-1', reactants: [{ species: 'A', coeff: 1 }], products: [{ species: 'R', coeff: 1 }], reversible: false, rateType: 'power-law', rateParams: { k: 0.5, Ea: 0, T_ref: 300 } },
        { id: 'cr-2', reactants: [{ species: 'A', coeff: 1 }], products: [{ species: 'S', coeff: 1 }], reversible: false, rateType: 'power-law', rateParams: { k: 0.8, Ea: 0, T_ref: 300 } },
      ],
      speciesMeta: {},
      keyReactantId: 'A',
    };

    const customParams: SimulationParams = {
      ...baseParams,
      k: 0.5,
      k2: 0.8,
      customReaction: network,
    };

    const builtinResult = solveNetwork(cstrNodes, cstrEdges, parallelParams);
    const customResult = solveNetwork(cstrNodes, cstrEdges, customParams);

    expect(builtinResult).not.toBeNull();
    expect(customResult).not.toBeNull();
    expect(builtinResult!.converged).toBe(true);
    expect(customResult!.converged).toBe(true);

    const bSeg = builtinResult!.segments[0];
    const cSeg = customResult!.segments[0];
    expect(Math.abs(bSeg.Ca_out - cSeg.Ca_out)).toBeLessThan(1e-6);
    expect(Math.abs(bSeg.Cr_out - cSeg.Cr_out)).toBeLessThan(1e-6);
    expect(Math.abs(bSeg.Cs_out - cSeg.Cs_out)).toBeLessThan(1e-6);
    expect(Math.abs(bSeg.Xa_out - cSeg.Xa_out)).toBeLessThan(1e-6);
  });

  it('Series equivalence: custom network matches seriesPreset within 1e-6', () => {
    // Expected: A→R→S series, CSTR isothermal τ=1
    const seriesParams: SimulationParams = {
      ...baseParams,
      reactionMode: 'series',
      k: 0.5,
      k2: 0.3,
      customReaction: null,
    };

    const network: CustomReactionNetwork = {
      reactions: [
        { id: 'cr-1', reactants: [{ species: 'A', coeff: 1 }], products: [{ species: 'R', coeff: 1 }], reversible: false, rateType: 'power-law', rateParams: { k: 0.5, Ea: 0, T_ref: 300 } },
        { id: 'cr-2', reactants: [{ species: 'R', coeff: 1 }], products: [{ species: 'S', coeff: 1 }], reversible: false, rateType: 'power-law', rateParams: { k: 0.3, Ea: 0, T_ref: 300 } },
      ],
      speciesMeta: {},
      keyReactantId: 'A',
    };

    const customParams: SimulationParams = {
      ...baseParams,
      k: 0.5,
      k2: 0.3,
      customReaction: network,
    };

    const builtinResult = solveNetwork(cstrNodes, cstrEdges, seriesParams);
    const customResult = solveNetwork(cstrNodes, cstrEdges, customParams);

    expect(builtinResult).not.toBeNull();
    expect(customResult).not.toBeNull();
    expect(builtinResult!.converged).toBe(true);
    expect(customResult!.converged).toBe(true);

    const bSeg = builtinResult!.segments[0];
    const cSeg = customResult!.segments[0];
    expect(Math.abs(bSeg.Ca_out - cSeg.Ca_out)).toBeLessThan(1e-6);
    expect(Math.abs(bSeg.Cr_out - cSeg.Cr_out)).toBeLessThan(1e-6);
    expect(Math.abs(bSeg.Cs_out - cSeg.Cs_out)).toBeLessThan(1e-6);
    expect(Math.abs(bSeg.Xa_out - cSeg.Xa_out)).toBeLessThan(1e-6);
  });

  it('Stoichiometry net coefficient: 2A + B -> C yields A:-2, B:-1, C:+1 for all species in union', () => {
    // Expected: reaction has reactants 2A + B (coeffs 2,1) products C (coeff 1)
    // With species union {A, B, C} — each reaction's stoichiometry maps every species
    const network: CustomReactionNetwork = {
      reactions: [
        { id: 'cr-1', reactants: [{ species: 'A', coeff: 2 }, { species: 'B', coeff: 1 }], products: [{ species: 'C', coeff: 1 }], reversible: false, rateType: 'power-law', rateParams: { k: 0.5, Ea: 0, T_ref: 300 } },
      ],
      speciesMeta: {},
    };

    const preset = buildCustomNetworkPreset(network);
    const reactions = preset.buildReactions(
      { ...baseParams, customReaction: network } as SimulationParams,
    );

    expect(reactions).toHaveLength(1);
    const rxn = reactions[0];
    // A: product coeff 0 - reactant coeff 2 = -2
    expect(rxn.stoichiometry).toHaveProperty('A', -2);
    // B: product coeff 0 - reactant coeff 1 = -1
    expect(rxn.stoichiometry).toHaveProperty('B', -1);
    // C: product coeff 1 - reactant coeff 0 = +1
    expect(rxn.stoichiometry).toHaveProperty('C', 1);
    // All species in the union must have entries
    expect(Object.keys(rxn.stoichiometry).sort()).toEqual(['A', 'B', 'C']);
  });

  it('Per-reaction ΔH: reaction 2 gets custom value, reaction 1 falls back to params.delta_H', () => {
    // Expected: network with two reactions, only rxn[1] has deltaH=-100
    // thermo.deltaH('cr-1', T) returns params.delta_H = -50
    // thermo.deltaH('cr-2', T) returns -100
    const network: CustomReactionNetwork = {
      reactions: [
        { id: 'cr-1', reactants: [{ species: 'A', coeff: 1 }], products: [{ species: 'R', coeff: 1 }], reversible: false, rateType: 'power-law', rateParams: { k: 0.5 } },
        { id: 'cr-2', reactants: [{ species: 'R', coeff: 1 }], products: [{ species: 'S', coeff: 1 }], reversible: false, rateType: 'power-law', rateParams: { k: 0.3 }, deltaH: -100 },
      ],
      speciesMeta: {},
    };

    const params: SimulationParams = {
      ...baseParams,
      delta_H: -50,
      customReaction: network,
    };

    const thermo = buildThermoModel(params);
    expect(thermo.deltaH('cr-1', 300)).toBe(-50);
    expect(thermo.deltaH('cr-2', 300)).toBe(-100);
  });

  it('Serializer migration: legacy single-reaction JSON becomes one-reaction CustomReactionNetwork', () => {
    // Expected: old shape with species array and no reactions array
    // gets migrated to network with 1 reaction, id 'cr-1'
    const legacy = {
      species: [
        { id: 'A', label: 'A', role: 'reactant' as const, stoich: 1 },
        { id: 'R', label: 'R', role: 'product' as const, stoich: 1 },
      ],
      rateType: 'power-law' as const,
      rateParams: { k: 0.5, Ea: 0 },
      reversible: true,
      Keq_custom: 4.0,
    };

    const result = migrateCustomReaction(legacy);
    expect(result).not.toBeNull();
    expect(result!.reactions).toHaveLength(1);
    expect(result!.reactions[0].id).toBe('cr-1');
    expect(result!.reactions[0].reactants).toEqual([{ species: 'A', coeff: 1 }]);
    expect(result!.reactions[0].products).toEqual([{ species: 'R', coeff: 1 }]);
    expect(result!.reactions[0].reversible).toBe(true);
    expect(result!.reactions[0].rateParams.Keq).toBe(4.0);
    expect(result!.keyReactantId).toBe('A');
  });

  it('Serializer: already network-shaped value passes through unchanged', () => {
    const network: CustomReactionNetwork = {
      reactions: [{ id: 'cr-1', reactants: [{ species: 'A', coeff: 1 }], products: [{ species: 'R', coeff: 1 }], reversible: false, rateType: 'power-law', rateParams: { k: 0.5 } }],
      speciesMeta: { A: { feedConc: 1.0 } },
    };
    const result = migrateCustomReaction(network);
    expect(result).toEqual(network);
  });
});
