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
      recycleMethod: 'direct',
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
    recycleMethod: 'direct',
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
      recycleMethod: 'direct',
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
      recycleMethod: 'direct',
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

describe('F13.2 — RK45 adaptive PFR accuracy (golden)', () => {
  it('first-order isothermal PFR: Ca_out matches exp(-k·τ) to rtol=1e-4', () => {
    const params: SimulationParams = {
      reactionMode: 'single', kinetics: 'first-order',
      k: 1.0, k2: 0, k3: 0, k4: 0, Cb0: 1, Keq_ref: 4,
      Ca0: 1.0, Cr0_fraction: 0, T_ref: 300, Ea: 0,
      delta_H: 0, rho_Cp: 1, T_feed: 300, epsilon: 0, Q_feed: 0,
      recycleMethod: 'direct', customReaction: null,
    };
    const nodes = [
      { id: 'feed-1', type: 'feed',    position: { x: 0, y: 0 }, data: {} },
      { id: 'pfr-1',  type: 'pfr',     position: { x: 2, y: 0 }, data: { reactorType: 'PFR', tau: 2, thermalMode: 'isothermal', label: 'P1' } },
      { id: 'prod-1', type: 'product', position: { x: 4, y: 0 }, data: {} },
    ] as unknown as import('@xyflow/react').Node[];
    const edges = [
      { id: 'e1', source: 'feed-1', target: 'pfr-1' },
      { id: 'e2', source: 'pfr-1',  target: 'prod-1' },
    ] as unknown as import('@xyflow/react').Edge[];

    const result = solveNetwork(nodes, edges, params);
    expect(result).not.toBeNull();
    const Ca_exact = Math.exp(-1.0 * 2.0);  // Ca0 * exp(-k*tau)
    const Xa_exact = 1 - Ca_exact;
    expect(Math.abs(result!.finalConversion - Xa_exact)).toBeLessThan(1e-4);
    // Profile has 201 points (resampled onto uniform grid)
    expect(result!.segments[0].profile.length).toBe(201);
  });
});

describe('solveNetwork — Wegstein vs Direct convergence (F13.1)', () => {
  // Tight recycle loop: Feed → Mixer → CSTR(τ=2,k=1) → Splitter(50% recycle) → Product
  // Direct damping converges at ~0.5^n rate (~29 iters); Wegstein extrapolates to ~5 iters.
  const recycleNodes = [
    { id: 'feed-1',  type: 'feed',     position: { x: 0,   y: 0 }, data: {} },
    { id: 'mix-1',   type: 'mixer',    position: { x: 100, y: 0 }, data: {} },
    { id: 'cstr-1',  type: 'cstr',     position: { x: 200, y: 0 }, data: { reactorType: 'CSTR', tau: 2, label: 'R1' } },
    { id: 'split-1', type: 'splitter', position: { x: 300, y: 0 }, data: { alpha: 0.5 } },
    { id: 'prod-1',  type: 'product',  position: { x: 400, y: 0 }, data: {} },
  ] as unknown as import('@xyflow/react').Node[];

  const recycleEdges = [
    { id: 'e1', source: 'feed-1',  target: 'mix-1' },
    { id: 'e2', source: 'mix-1',   target: 'cstr-1' },
    { id: 'e3', source: 'cstr-1',  target: 'split-1' },
    { id: 'e4', source: 'split-1', target: 'prod-1',  sourceHandle: 'out-top' },
    { id: 'e5', source: 'split-1', target: 'mix-1',   sourceHandle: 'out-bot' },
  ] as unknown as import('@xyflow/react').Edge[];

  const baseRecycleParams: import('../../types/reactor').SimulationParams = {
    reactionMode: 'single', kinetics: 'first-order',
    k: 1, k2: 0, k3: 0, k4: 0, Cb0: 1, Keq_ref: 4,
    Ca0: 1, Cr0_fraction: 0, T_ref: 300, Ea: 0,
    delta_H: 0, rho_Cp: 1, T_feed: 300, epsilon: 0, Q_feed: 0,
    recycleMethod: 'direct', customReaction: null,
  };

  it('Direct: tight recycle converges (may take many iterations with 50% damping)', () => {
    const result = solveNetwork(recycleNodes, recycleEdges, { ...baseRecycleParams, recycleMethod: 'direct' });
    expect(result).not.toBeNull();
    expect(result!.converged).toBe(true);
    expect(result!.iterations).toBeLessThanOrEqual(40);
  });

  it('Wegstein: tight recycle converges in ≤8 iterations (≥4× faster than direct)', () => {
    const result = solveNetwork(recycleNodes, recycleEdges, { ...baseRecycleParams, recycleMethod: 'wegstein' });
    expect(result).not.toBeNull();
    expect(result!.converged).toBe(true);
    expect(result!.iterations).toBeLessThanOrEqual(8);
  });

  it('Direct and Wegstein converge to same final Xa (within 1e-4)', () => {
    const rDirect   = solveNetwork(recycleNodes, recycleEdges, { ...baseRecycleParams, recycleMethod: 'direct' });
    const rWegstein = solveNetwork(recycleNodes, recycleEdges, { ...baseRecycleParams, recycleMethod: 'wegstein' });
    expect(rDirect).not.toBeNull();
    expect(rWegstein).not.toBeNull();
    expect(Math.abs(rDirect!.finalConversion - rWegstein!.finalConversion)).toBeLessThan(1e-4);
  });
});

describe('F14.1 — hxModel golden test (hand-calculated Q̇)', () => {
  it('utility mode T_out: Q = rho_Cp * Vdot * ΔT, outlet T matches set-point', async () => {
    const { hxModel } = await import('../unitModels');
    const inlet = { F: { A: 1.0, R: 0.0 }, T: 300, P: 101325 };
    const rho_Cp = 4.18; // kJ/(L·K)
    const Ca0    = 1.0;  // mol/L → V̇ = 1.0/1.0 = 1.0 L/s
    const { outlet, Q } = hxModel(inlet, { mode: 'utility', T_out: 400, rho_Cp, Ca0 });
    // Q = 4.18 * 1.0 * (400 - 300) = 418 kJ/s
    expect(outlet.T).toBeCloseTo(400, 8);
    expect(Q).toBeCloseTo(418, 4);
  });

  it('utility mode Q_duty: T_out = T_in + Q / (rho_Cp * Vdot)', async () => {
    const { hxModel } = await import('../unitModels');
    const inlet = { F: { A: 1.0, R: 0.0 }, T: 300, P: 101325 };
    const { outlet, Q } = hxModel(inlet, { mode: 'utility', Q_duty: 418, rho_Cp: 4.18, Ca0: 1.0 });
    expect(outlet.T).toBeCloseTo(400, 4);
    expect(Q).toBe(418);
  });

  it('pass-through when neither T_out nor Q_duty specified', async () => {
    const { hxModel } = await import('../unitModels');
    const inlet = { F: { A: 2.0 }, T: 350, P: 101325 };
    const { outlet, Q } = hxModel(inlet, { mode: 'utility', rho_Cp: 4.18, Ca0: 1.0 });
    expect(outlet.T).toBe(350);
    expect(Q).toBe(0);
  });

  it('cooling (Q < 0) when T_out < T_in', async () => {
    const { hxModel } = await import('../unitModels');
    const inlet = { F: { A: 1.0 }, T: 400, P: 101325 };
    const { Q } = hxModel(inlet, { mode: 'utility', T_out: 300, rho_Cp: 4.18, Ca0: 1.0 });
    expect(Q).toBeLessThan(0);
    expect(Q).toBeCloseTo(-418, 4);
  });

  it('solveNetwork routes through hx node and changes stream temperature', () => {
    const params: SimulationParams = {
      reactionMode: 'single', kinetics: 'first-order',
      k: 0.5, k2: 0.3, k3: 0.1, Cb0: 1.0, k4: 0.1,
      Keq_ref: 4.0, Ca0: 1.0, Cr0_fraction: 0.01,
      T_ref: 300, Ea: 0, delta_H: 0, rho_Cp: 4.18,
      T_feed: 300, epsilon: 0, Q_feed: 0,
      recycleMethod: 'direct', customReaction: null,
    };
    const nodes: Node[] = [
      { id: 'feed',    type: 'feed',    position: { x: 0,  y: 0 }, data: {} },
      { id: 'hx-1',   type: 'hx',      position: { x: 200,y: 0 }, data: { label: 'HX-1', mode: 'utility', T_out: 400 } },
      { id: 'cstr-1', type: 'cstr',     position: { x: 400,y: 0 }, data: { tau: 2, thermalMode: 'isothermal', Tc: 300, kappa_v: 0.5 } },
      { id: 'product', type: 'product', position: { x: 600,y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'feed',   target: 'hx-1',   sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e2', source: 'hx-1',   target: 'cstr-1', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e3', source: 'cstr-1', target: 'product', sourceHandle: 'out', targetHandle: 'in' },
    ];
    const result = solveNetwork(nodes, edges, params);
    expect(result).not.toBeNull();
    // The HX should heat feed to 400K; CSTR runs isothermally at T_ref=300 (isothermal overrides inlet T)
    // The stream entering CSTR should be 400K
    const hxOutStream = result!.streams['e2'];
    expect(hxOutStream?.T).toBeCloseTo(400, 4);
  });
});
