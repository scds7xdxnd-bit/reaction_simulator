import type { Node, Edge } from '@xyflow/react';
import type { SimulationParams } from '../types/reactor';
import { solveNetwork } from './networkSolver';

export interface ComparePoint {
  tau: number;
  cstr: number;
  pfr: number;
  nCstr: number;
}

export interface CompareConfig {
  tau_to: number;
  steps: number;
  N: number;
}

function makeEdge(id: string, source: string, target: string): Edge {
  return {
    id,
    source,
    target,
    sourceHandle: 'out',
    targetHandle: 'in',
    type: 'smoothstep',
    animated: false,
  } as Edge;
}

function makeFeed(): Node {
  return { id: 'cmp-feed', type: 'feed', position: { x: 0, y: 0 }, data: {} } as Node;
}

function makeProduct(): Node {
  return { id: 'cmp-product', type: 'product', position: { x: 0, y: 0 }, data: {} } as Node;
}

function buildSingleCstr(tau: number): { nodes: Node[]; edges: Edge[] } {
  const reactor: Node = {
    id: 'cmp-cstr',
    type: 'cstr',
    position: { x: 0, y: 0 },
    data: { reactorType: 'CSTR', label: 'CSTR', tau },
  } as Node;
  return {
    nodes: [makeFeed(), reactor, makeProduct()],
    edges: [
      makeEdge('cmp-e1', 'cmp-feed', 'cmp-cstr'),
      makeEdge('cmp-e2', 'cmp-cstr', 'cmp-product'),
    ],
  };
}

function buildSinglePfr(tau: number): { nodes: Node[]; edges: Edge[] } {
  const reactor: Node = {
    id: 'cmp-pfr',
    type: 'pfr',
    position: { x: 0, y: 0 },
    data: { reactorType: 'PFR', label: 'PFR', tau },
  } as Node;
  return {
    nodes: [makeFeed(), reactor, makeProduct()],
    edges: [
      makeEdge('cmp-e1', 'cmp-feed', 'cmp-pfr'),
      makeEdge('cmp-e2', 'cmp-pfr', 'cmp-product'),
    ],
  };
}

function buildNCstr(tau: number, N: number): { nodes: Node[]; edges: Edge[] } {
  const tauEach = tau / Math.max(N, 1);
  const reactors: Node[] = Array.from({ length: N }, (_, i) => ({
    id: `cmp-cstr-${i}`,
    type: 'cstr',
    position: { x: 0, y: 0 },
    data: { reactorType: 'CSTR', label: `CSTR-${i + 1}`, tau: tauEach },
  } as Node));

  const nodes: Node[] = [makeFeed(), ...reactors, makeProduct()];
  const edges: Edge[] = [
    makeEdge('cmp-e0', 'cmp-feed', 'cmp-cstr-0'),
    ...Array.from({ length: N - 1 }, (_, i) =>
      makeEdge(`cmp-e${i + 1}`, `cmp-cstr-${i}`, `cmp-cstr-${i + 1}`)
    ),
    makeEdge(`cmp-e${N}`, `cmp-cstr-${N - 1}`, 'cmp-product'),
  ];

  return { nodes, edges };
}

export function runComparison(
  params: SimulationParams,
  config: CompareConfig,
): ComparePoint[] {
  const { tau_to, steps, N } = config;
  if (tau_to <= 0 || steps < 2 || N < 1) return [];

  const points: ComparePoint[] = [];
  for (let i = 1; i <= steps; i++) {
    const tau = (tau_to / steps) * i;

    const { nodes: cn, edges: ce } = buildSingleCstr(tau);
    const cstrResult = solveNetwork(cn, ce, params);

    const { nodes: pn, edges: pe } = buildSinglePfr(tau);
    const pfrResult = solveNetwork(pn, pe, params);

    const { nodes: nn, edges: ne } = buildNCstr(tau, N);
    const nCstrResult = solveNetwork(nn, ne, params);

    points.push({
      tau,
      cstr:  cstrResult?.finalConversion  ?? 0,
      pfr:   pfrResult?.finalConversion   ?? 0,
      nCstr: nCstrResult?.finalConversion ?? 0,
    });
  }
  return points;
}
