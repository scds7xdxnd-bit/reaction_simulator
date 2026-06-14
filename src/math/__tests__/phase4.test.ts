import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { solveNetwork } from '../networkSolver';
import { semibatchSolve } from '../semibatchModel';
import { buildChemistry } from '../chemistryFactory';
import { buildCustomNetworkPreset } from '../reactionRegistry';
import { computeXeq } from '../equilibrium';
import { computeRTD } from '../rtdModel';
import type { SimulationParams } from '../../types/reactor';
import type { CustomReactionNetwork } from '../../types/simulation';

const baseParams: SimulationParams = {
  reactionMode: 'single',
  kinetics: 'first-order',
  k: 0.5,
  k2: 0,
  k3: 0,
  Cb0: 1.0,
  k4: 0,
  Keq_ref: 4.0,
  Ca0: 1.0,
  Cr0_fraction: 0.01,
  T_ref: 300,
  Ea: 0,
  delta_H: -50,
  rho_Cp: 4.18,
  T_feed: 300,
  epsilon: 0,
  Q_feed: 0,
  recycleMethod: 'direct',
  customReaction: null,
};

describe('P5.4 — Phase 4 math tests', () => {
  it('(1) Arrhenius regression: adiabatic CSTR with Ea=33.3 kJ/mol → Xa≈0.73, T_out≈373K', () => {
    const nodes: Node[] = [
      { id: 'feed',   type: 'feed',    position: { x: 0, y: 0 }, data: {} },
      {
        id: 'cstr-1', type: 'cstr', position: { x: 200, y: 0 },
        data: { reactorType: 'CSTR', label: 'CSTR-1', tau: 2.0, thermalMode: 'adiabatic', Tc: 300, kappa_v: 0.5 },
      },
      { id: 'product', type: 'product', position: { x: 400, y: 0 }, data: {} },
    ] as unknown as Node[];
    const edges: Edge[] = [
      { id: 'e1', source: 'feed',   target: 'cstr-1' },
      { id: 'e2', source: 'cstr-1', target: 'product' },
    ] as unknown as Edge[];

    const params: SimulationParams = {
      ...baseParams,
      kinetics: 'first-order',
      k: 0.1,
      Ea: 33.3,
      delta_H: -100,
      rho_Cp: 1.0,
      Ca0: 1.0,
      T_feed: 300,
    };

    const result = solveNetwork(nodes, edges, params);
    expect(result).not.toBeNull();
    expect(result!.converged).toBe(true);
    expect(Math.abs(result!.finalConversion - 0.73)).toBeLessThan(0.02);
    expect(Math.abs(result!.segments[0].T_out - 373)).toBeLessThan(5);
  });

  it('(2) Semibatch selectivity: A→R single reaction, S_R > 0.7 over tau_batch=10s', () => {
    const params: SimulationParams = {
      ...baseParams,
      kinetics: 'first-order',
      k: 0.2,
    };
    const chemistry = buildChemistry(params);

    const result = semibatchSolve(
      { tau_batch: 10, FB0: 0.01, CB_feed: 1.0, Na0: 1.0, V0: 1.0 },
      chemistry,
      300,
    );

    expect(result.Xa_out).toBeGreaterThan(0.5);
    expect(result.selectivity_R).toBeGreaterThan(0.7);
    expect(result.profile.length).toBeGreaterThan(1);
  });

  it('(3) buildCustomNetworkPreset factory: power-law A→R rateLaw matches first-order at same k', () => {
    const net: CustomReactionNetwork = {
      reactions: [{
        id: 'cr-1',
        reactants: [{ species: 'A', coeff: 1 }],
        products: [{ species: 'R', coeff: 1 }],
        reversible: false,
        rateType: 'power-law',
        rateParams: { k: 0.5, Ea: 0, T_ref: 300 },
      }],
      speciesMeta: {},
      keyReactantId: 'A',
    };

    const preset = buildCustomNetworkPreset(net);
    expect(preset).not.toBeNull();
    expect(preset.buildReactions).toBeTypeOf('function');

    const reactions = preset.buildReactions({} as any);
    expect(reactions.length).toBe(1);
    const rxn = reactions[0];
    expect(rxn.rateLaw).toBeTypeOf('function');

    // Power-law A^1 at CA=0.6, k=0.5 → rA = 0.5 * 0.6 = 0.3
    const C = { A: 0.6, R: 0.4 };
    const rCustom = rxn.rateLaw(C, 300, rxn.kineticParams);
    expect(Math.abs(rCustom - 0.3)).toBeLessThan(1e-9);
  });

  it('(4) computeXeq: Keq=4 → Xeq = 0.80', () => {
    const Xeq = computeXeq(4);
    expect(Math.abs(Xeq - 0.8)).toBeLessThan(1e-9);
  });

  it('(5) TIS bracketing: CSTR < TIS(N=5) < PFR for 1st-order Da=2', () => {
    const { Xa_CSTR, Xa_TIS, Xa_PFR } = computeRTD(1, 5, 2);
    expect(Math.abs(Xa_CSTR - 2 / 3)).toBeLessThan(1e-6);
    expect(Math.abs(Xa_PFR - (1 - Math.exp(-2)))).toBeLessThan(1e-6);
    expect(Xa_TIS).toBeGreaterThan(Xa_CSTR);
    expect(Xa_TIS).toBeLessThan(Xa_PFR);
  });
});
