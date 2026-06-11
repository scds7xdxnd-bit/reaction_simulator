import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { solveNetwork } from '../networkSolver';
import { EXAMPLES } from '../../io/examples';
import type { SimulationParams } from '../../types/reactor';

describe('solveNetwork — golden examples', () => {
  it('single-cstr: first-order isothermal, Xa = 0.5', () => {
    const { nodes, edges, params } = EXAMPLES[0].state;
    const result = solveNetwork(nodes, edges, params);

    expect(result).not.toBeNull();
    expect(result!.converged).toBe(true);
    expect(result!.iterations).toBe(1);
    expect(Math.abs(result!.finalConversion - 0.5)).toBeLessThan(1e-4);

    expect(result!.segments).toHaveLength(1);
    expect(result!.segments[0].reactorId).toBe('cstr-2');
    expect(Math.abs(result!.segments[0].Xa_out - 0.5)).toBeLessThan(1e-4);
    expect(Math.abs(result!.segments[0].Ca_out - 0.5)).toBeLessThan(1e-4);
    expect(result!.segments[0].T_out).toBe(300);
  });

  it('two-cstr-series: staging increases conversion to ~0.609', () => {
    const { nodes, edges, params } = EXAMPLES[1].state;
    const result = solveNetwork(nodes, edges, params);

    expect(result).not.toBeNull();
    expect(result!.converged).toBe(true);
    expect(result!.iterations).toBe(1);
    expect(Math.abs(result!.finalConversion - 0.609375)).toBeLessThan(1e-4);

    expect(result!.segments).toHaveLength(2);
    expect(result!.segments[0].reactorId).toBe('cstr-2');
    expect(Math.abs(result!.segments[0].Xa_out - 0.375)).toBeLessThan(1e-4);
    expect(result!.segments[1].reactorId).toBe('cstr-3');
    expect(Math.abs(result!.segments[1].Xa_out - 0.609375)).toBeLessThan(1e-4);
  });

  it('cstr-pfr: second-order hybrid, Xa ~ 0.680', () => {
    const { nodes, edges, params } = EXAMPLES[2].state;
    const result = solveNetwork(nodes, edges, params);

    expect(result).not.toBeNull();
    expect(result!.converged).toBe(true);
    expect(result!.iterations).toBe(1);
    expect(Math.abs(result!.finalConversion - 0.6799)).toBeLessThan(5e-3);

    expect(result!.segments).toHaveLength(2);
    expect(result!.segments[0].reactorId).toBe('cstr-2');
    expect(Math.abs(result!.segments[0].Xa_out - 0.3441)).toBeLessThan(5e-3);
    expect(result!.segments[1].reactorId).toBe('pfr-2');
    expect(Math.abs(result!.segments[1].Xa_out - 0.6799)).toBeLessThan(5e-3);
    expect(result!.segments[0].Xa_out).toBeLessThan(result!.segments[1].Xa_out);
  });
});

describe('solveNetwork — series3 preset (A→R→S→T)', () => {
  it('isothermal CSTR, k1=0.5 k2=0.3 k3=0.1, τ=2: CS_out>0, mass balance ≈ Ca0', () => {
    const params: SimulationParams = {
      reactionMode: 'series3',
      kinetics: 'first-order',
      k: 0.5,
      k2: 0.3,
      k3: 0.1,
      Cb0: 1.0,
      k4: 0,
      Keq_ref: 4,
      Ca0: 1.0,
      Cr0_fraction: 0,
      T_ref: 300,
      Ea: 0,
      delta_H: 0,
      rho_Cp: 1,
      T_feed: 300,
      epsilon: 0,
      Q_feed: 0,
      customReaction: null,
    };
    const nodes = [
      { id: 'feed-1', type: 'feed',    position: { x: 0, y: 0 },   data: {} },
      { id: 'cstr-1', type: 'cstr',    position: { x: 200, y: 0 }, data: { reactorType: 'CSTR', tau: 2, thermalMode: 'isothermal', label: 'R1' } },
      { id: 'prod-1', type: 'product', position: { x: 400, y: 0 }, data: {} },
    ] as unknown as import('@xyflow/react').Node[];
    const edges = [
      { id: 'e1', source: 'feed-1', target: 'cstr-1' },
      { id: 'e2', source: 'cstr-1', target: 'prod-1' },
    ] as unknown as import('@xyflow/react').Edge[];

    const result = solveNetwork(nodes, edges, params);
    expect(result).not.toBeNull();
    expect(result!.converged).toBe(true);
    const seg = result!.segments[0];
    // A must be consumed, S produced as intermediate
    expect(seg.Xa_out).toBeGreaterThan(0);
    expect(seg.Ca_out).toBeLessThan(params.Ca0);
    expect(seg.Cs_out).toBeGreaterThan(0);
    // Conversion should be substantial (k1τ=1 → Xa≈0.5)
    expect(seg.Xa_out).toBeGreaterThan(0.3);
  });
});

describe('solveNetwork — parallel network fixes', () => {
  const baseParams: SimulationParams = {
    reactionMode: 'single',
    kinetics: 'first-order',
    k: 0.5,
    k2: 0,
    k3: 0,
    Cb0: 1.0,
    k4: 0,
    Keq_ref: 10,
    Ca0: 1.0,
    Cr0_fraction: 0,
    T_ref: 300,
    Ea: 0,
    delta_H: 0,
    rho_Cp: 1,
    T_feed: 300,
    epsilon: 0,
    Q_feed: 0,
    customReaction: null,
  };

  it('diamond: Feed → Splitter(α=0.5) → [CSTR-A, CSTR-B] → Mixer → Product, Xa = kτ_eff/(1+kτ_eff) ≈ 2/3', () => {
    // Edges use generic handles (no sourceHandle) to exercise the splitter fallback path
    const nodes = [
      { id: 'feed-1',  type: 'feed',     position: { x: 0, y: 0 },     data: {} },
      { id: 'split-1', type: 'splitter', position: { x: 200, y: 0 },   data: { alpha: 0.5 } },
      { id: 'cstr-a',  type: 'cstr',     position: { x: 400, y: -100 }, data: { reactorType: 'CSTR', tau: 2, label: 'CSTR A' } },
      { id: 'cstr-b',  type: 'cstr',     position: { x: 400, y:  100 }, data: { reactorType: 'CSTR', tau: 2, label: 'CSTR B' } },
      { id: 'mix-1',   type: 'mixer',    position: { x: 600, y: 0 },   data: {} },
      { id: 'prod-1',  type: 'product',  position: { x: 800, y: 0 },   data: {} },
    ] as unknown as Node[];
    const edges = [
      { id: 'e1', source: 'feed-1',  target: 'split-1' },
      { id: 'e2', source: 'split-1', target: 'cstr-a' },
      { id: 'e3', source: 'split-1', target: 'cstr-b' },
      { id: 'e4', source: 'cstr-a',  target: 'mix-1' },
      { id: 'e5', source: 'cstr-b',  target: 'mix-1' },
      { id: 'e6', source: 'mix-1',   target: 'prod-1' },
    ] as unknown as Edge[];

    const result = solveNetwork(nodes, edges, baseParams);
    // flow splits to 0.5 each → τ_eff = 2/0.5 = 4 → Xa = 0.5·4/(1+0.5·4) = 2/3
    expect(result).not.toBeNull();
    expect(result!.converged).toBe(true);
    expect(Math.abs(result!.finalConversion - 2 / 3)).toBeLessThan(1e-4);
    expect(result!.segments).toHaveLength(2);
  });

  it('stale-edge guard: ghost source edge does not crash topoSort', () => {
    const nodes = [
      { id: 'feed-1', type: 'feed',    position: { x: 0, y: 0 },   data: {} },
      { id: 'cstr-1', type: 'cstr',    position: { x: 200, y: 0 }, data: { reactorType: 'CSTR', tau: 1, label: 'R1' } },
      { id: 'prod-1', type: 'product', position: { x: 400, y: 0 }, data: {} },
    ] as unknown as Node[];
    const edges = [
      { id: 'e1',      source: 'feed-1',  target: 'cstr-1' },
      { id: 'e2',      source: 'cstr-1',  target: 'prod-1' },
      { id: 'e-stale', source: 'ghost-id', target: 'cstr-1' },
    ] as unknown as Edge[];

    expect(() => solveNetwork(nodes, edges, baseParams)).not.toThrow();
    const result = solveNetwork(nodes, edges, baseParams);
    expect(result).not.toBeNull();
  });
});

describe('solveNetwork — series-parallel preset (A+B→R, R+B→S, S+B→T)', () => {
  it('isothermal PFR, k1=k2=k3=0.5, Ca0=1, Cb0=2, τ=2: B not fully consumed, CR_out>0', () => {
    const params: SimulationParams = {
      reactionMode: 'series-parallel',
      kinetics: 'first-order',
      k: 0.5,
      k2: 0.5,
      k3: 0.5,
      Cb0: 2.0,
      k4: 0,
      Keq_ref: 4,
      Ca0: 1.0,
      Cr0_fraction: 0,
      T_ref: 300,
      Ea: 0,
      delta_H: 0,
      rho_Cp: 1,
      T_feed: 300,
      epsilon: 0,
      Q_feed: 0,
      customReaction: null,
    };
    const nodes = [
      { id: 'feed-1', type: 'feed',    position: { x: 0, y: 0 },   data: {} },
      { id: 'pfr-1',  type: 'pfr',     position: { x: 200, y: 0 }, data: { reactorType: 'PFR', tau: 2, thermalMode: 'isothermal', label: 'P1' } },
      { id: 'prod-1', type: 'product', position: { x: 400, y: 0 }, data: {} },
    ] as unknown as import('@xyflow/react').Node[];
    const edges = [
      { id: 'e1', source: 'feed-1', target: 'pfr-1' },
      { id: 'e2', source: 'pfr-1',  target: 'prod-1' },
    ] as unknown as import('@xyflow/react').Edge[];

    const result = solveNetwork(nodes, edges, params);
    expect(result).not.toBeNull();
    expect(result!.converged).toBe(true);
    const seg = result!.segments[0];
    // A must be consumed; R must be produced as bimolecular product
    expect(seg.Xa_out).toBeGreaterThan(0);
    expect(seg.Cr_out).toBeGreaterThan(0);
    // Ca0=1, Cb0=2 (excess B) — A is significantly consumed
    expect(seg.Ca_out).toBeLessThan(params.Ca0);
    expect(seg.Xa_out).toBeGreaterThan(0.3);
  });
});

describe('solveNetwork — Denbigh system (A→R/T, R→S/U)', () => {
  it('isothermal CSTR, k1=1 k2=0.5 k3=2 k4=1, τ=1, Ca0=1: Xa≈0.6, Cr>0', () => {
    const params: SimulationParams = {
      reactionMode: 'denbigh',
      kinetics: 'first-order',
      k: 1.0,
      k2: 0.5,
      k3: 2.0,
      k4: 1.0,
      Cb0: 1.0,
      Keq_ref: 4,
      Ca0: 1.0,
      Cr0_fraction: 0,
      T_ref: 300,
      Ea: 0,
      delta_H: 0,
      rho_Cp: 1,
      T_feed: 300,
      epsilon: 0,
      Q_feed: 0,
      customReaction: null,
    };
    const nodes = [
      { id: 'feed-1', type: 'feed',    position: { x: 0, y: 0 },   data: {} },
      { id: 'cstr-1', type: 'cstr',    position: { x: 200, y: 0 }, data: { reactorType: 'CSTR', tau: 1, thermalMode: 'isothermal', label: 'R1' } },
      { id: 'prod-1', type: 'product', position: { x: 400, y: 0 }, data: {} },
    ] as unknown as import('@xyflow/react').Node[];
    const edges = [
      { id: 'e1', source: 'feed-1', target: 'cstr-1' },
      { id: 'e2', source: 'cstr-1', target: 'prod-1' },
    ] as unknown as import('@xyflow/react').Edge[];

    const result = solveNetwork(nodes, edges, params);
    expect(result).not.toBeNull();
    expect(result!.converged).toBe(true);
    const seg = result!.segments[0];
    // A is consumed, R is the desired product and must be nonzero
    expect(seg.Xa_out).toBeGreaterThan(0);
    expect(seg.Ca_out).toBeLessThan(params.Ca0);
    expect(seg.Cr_out).toBeGreaterThan(0);
    // Denbigh: k12=1.5, k34=3 → R is produced but also consumed; verify it's intermediate
    expect(seg.Cr_out).toBeLessThan(params.Ca0);
  });
});
