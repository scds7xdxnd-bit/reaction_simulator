import { useEffect, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { SimulationResult, ReactorSegmentResult, SimulationParams } from '../types/reactor';
import { useSimulatorStore } from '../store/simulatorStore';
import { solveCSTR, solvePFR, solveSeriesCSTR, solveParallelCSTR, solveMultiPFR } from '../math/reactorSolvers';
import { buildLevenspielCurve } from '../math/kinetics';
import { getRate } from '../math/kinetics';

function traverseGraph(nodes: Node[], edges: Edge[]): Node[] | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, string[]>();

  for (const e of edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source)!.push(e.target);
  }

  const reactors: Node[] = [];
  let current = 'feed';

  const visited = new Set<string>();

  while (current !== 'product') {
    if (visited.has(current)) return null;
    visited.add(current);

    const nextNodes = adjacency.get(current);
    if (!nextNodes || nextNodes.length === 0) return null;
    if (nextNodes.length > 1) return null;

    const nextId = nextNodes[0];
    const nextNode = nodeMap.get(nextId);
    if (!nextNode) return null;

    if (nextId !== 'product') {
      reactors.push(nextNode);
    }

    current = nextId;
  }

  return reactors;
}

function runSimulation(
  reactorNodes: Node[],
  storeParams: SimulationParams
): SimulationResult {
  const levenspielCurve = buildLevenspielCurve(storeParams);
  let Xa = 0.0;
  let Ca = storeParams.Ca0;
  let Cr = 0.0;
  let Cs = 0.0;
  let cumTau = 0.0;
  const segments: ReactorSegmentResult[] = [];

  const isSingle = storeParams.reactionMode === 'single';

  for (const node of reactorNodes) {
    const data = node.data as { reactorType: 'CSTR' | 'PFR'; label: string; tau: number };
    const tau = data.tau;
    const reactorType = data.reactorType;

    let Ca_out: number;
    let Cr_out: number;
    let Cs_out: number;
    let profilePts: { cumTau: number; Xa: number; Ca: number; Cr: number; Cs: number }[] = [];
    let Da: number;

    if (isSingle) {
      let result: { Xa_out: number; profile: { cumTau: number; Xa: number }[] };

      if (reactorType === 'CSTR') {
        result = solveCSTR(Xa, tau, storeParams);
      } else {
        result = solvePFR(Xa, tau, storeParams);
      }

      Xa = result.Xa_out;
      Ca_out = storeParams.Ca0 * (1 - Xa);
      Cr_out = storeParams.Ca0 * Xa;
      Cs_out = 0;

      Da = storeParams.kinetics === 'first-order'
        ? storeParams.k * tau
        : storeParams.k * storeParams.Ca0 * tau;

      profilePts = result.profile.map((p) => ({
        cumTau: cumTau + p.cumTau,
        Xa: p.Xa,
        Ca: storeParams.Ca0 * (1 - p.Xa),
        Cr: storeParams.Ca0 * p.Xa,
        Cs: 0,
      }));
    } else {
      if (reactorType === 'CSTR') {
        const res = storeParams.reactionMode === 'series'
          ? solveSeriesCSTR(Ca, Cr, Cs, tau, storeParams.k, storeParams.k2)
          : solveParallelCSTR(Ca, Cr, Cs, tau, storeParams.k, storeParams.k2);
        Ca_out = res.Ca_out;
        Cr_out = res.Cr_out;
        Cs_out = res.Cs_out;

        profilePts = [
          { cumTau: cumTau, Xa: 1 - Ca / storeParams.Ca0, Ca, Cr, Cs },
          { cumTau: cumTau + tau, Xa: 1 - Ca_out / storeParams.Ca0, Ca: Ca_out, Cr: Cr_out, Cs: Cs_out },
        ];
      } else {
        const res = solveMultiPFR(Ca, Cr, Cs, tau, storeParams.k, storeParams.k2, storeParams.reactionMode as 'series' | 'parallel');
        Ca_out = res.Ca_out;
        Cr_out = res.Cr_out;
        Cs_out = res.Cs_out;

        profilePts = res.profile.map((p) => ({
          cumTau: cumTau + p.t,
          Xa: 1 - p.Ca / storeParams.Ca0,
          Ca: p.Ca,
          Cr: p.Cr,
          Cs: p.Cs,
        }));
      }

      Da = storeParams.k * tau;
      Xa = 1 - Ca_out / storeParams.Ca0;
    }

    const yield_R = Cr_out / storeParams.Ca0;
    const consumed = storeParams.Ca0 - Ca_out;
    const selectivity_R = consumed > 1e-9 ? Cr_out / consumed : 0;

    segments.push({
      reactorId: node.id,
      reactorType,
      label: data.label,
      Xa_in: isSingle ? segments[segments.length - 1]?.Xa_out ?? 0 : 1 - Ca / storeParams.Ca0,
      Xa_out: Xa,
      tau,
      Da,
      Ca_out,
      Cr_out,
      Cs_out,
      yield_R,
      selectivity_R,
      profile: profilePts,
    });

    Ca = Ca_out;
    Cr = Cr_out;
    Cs = Cs_out;
    cumTau += tau;
  }

  const lastSeg = segments[segments.length - 1];

  return {
    segments,
    finalConversion: Xa,
    finalYield: isSingle ? NaN : (lastSeg?.yield_R ?? NaN),
    finalSelectivity: isSingle ? NaN : (lastSeg?.selectivity_R ?? NaN),
    levenspielCurve,
  };
}

export function useSimulation() {
  const nodes = useSimulatorStore((s) => s.nodes);
  const edges = useSimulatorStore((s) => s.edges);
  const params = useSimulatorStore((s) => s.params);
  const setResult = useSimulatorStore((s) => s.setResult);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      const reactorNodes = traverseGraph(nodes, edges);

      if (!reactorNodes || reactorNodes.length === 0) {
        setResult(null);
        return;
      }

      const result = runSimulation(reactorNodes, params);
      setResult(result);
    }, 50);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [nodes, edges, params, setResult]);
}
