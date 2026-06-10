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

describe('solveNetwork — parallel network fixes', () => {
  const baseParams: SimulationParams = {
    reactionMode: 'single',
    kinetics: 'first-order',
    k: 0.5,
    k2: 0,
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
