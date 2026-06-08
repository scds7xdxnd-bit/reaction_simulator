import type { Node, Edge } from '@xyflow/react';
import type {
  SimulationParams,
  SimulationResult,
  ReactorSegmentResult,
  ThermalMode,
} from '../types/reactor';
import { buildLevenspielCurve, getRate } from './kinetics';
import {
  solveCSTR,
  solvePFR,
  solveSeriesCSTR,
  solveParallelCSTR,
  solveMultiPFR,
} from './reactorSolvers';
import {
  solveCSTRAdiabatic,
  solveCSTRCooled,
  solvePFRAdiabatic,
  solvePFRCooled,
} from './thermalSolvers';
import { type StreamState, stateToStream, annotateStream } from './streamBridge';
import { buildChemistry } from './chemistryFactory';
import type { AnnotatedStream } from '../types/stream';
import type { ChemistryModel } from '../types/chemistry';

export function findTearEdgeIds(nodes: Node[], edges: Edge[]): Set<string> {
  const color = new Map<string, 'white' | 'gray' | 'black'>();
  const tearIds = new Set<string>();

  const adj = new Map<string, { targetId: string; edgeId: string }[]>();
  for (const n of nodes) {
    color.set(n.id, 'white');
    adj.set(n.id, []);
  }
  for (const e of edges) {
    adj.get(e.source)?.push({ targetId: e.target, edgeId: e.id });
  }

  function dfs(nodeId: string) {
    color.set(nodeId, 'gray');
    for (const { targetId, edgeId } of adj.get(nodeId) ?? []) {
      if (color.get(targetId) === 'gray') {
        tearIds.add(edgeId);
      } else if (color.get(targetId) === 'white') {
        dfs(targetId);
      }
    }
    color.set(nodeId, 'black');
  }

  for (const n of nodes) {
    if (color.get(n.id) === 'white') dfs(n.id);
  }

  return tearIds;
}

export function topoSort(nodes: Node[], edges: Edge[], tearIds: Set<string>): string[] {
  const dagEdges = edges.filter((e) => !tearIds.has(e.id));
  const inDegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]));

  for (const e of dagEdges) {
    adj.get(e.source)!.push(e.target);
    inDegree.set(e.target, inDegree.get(e.target)! + 1);
  }

  const queue = nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    order.push(curr);
    for (const next of adj.get(curr) ?? []) {
      const deg = inDegree.get(next)! - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  return order;
}

function getInletStream(
  inEdges: Edge[],
  streams: Map<string, StreamState>,
  params: SimulationParams
): StreamState {
  if (inEdges.length === 0) {
    return { Xa: 0, Ca: params.Ca0, Cr: 0, Cs: 0, flow: 1, T: params.T_feed ?? 300 };
  }
  return (
    streams.get(inEdges[0].id) ?? {
      Xa: 0,
      Ca: params.Ca0,
      Cr: 0,
      Cs: 0,
      flow: 1,
      T: params.T_feed ?? 300,
    }
  );
}

function mixStreams(
  inEdges: Edge[],
  streams: Map<string, StreamState>,
  _params: SimulationParams
): StreamState {
  const inlets = inEdges
    .map((e) => streams.get(e.id))
    .filter(Boolean) as StreamState[];
  if (inlets.length === 0) {
    return { Xa: 0, Ca: _params.Ca0, Cr: 0, Cs: 0, flow: 1, T: _params.T_feed ?? 300 };
  }

  const totalFlow = inlets.reduce((s, st) => s + st.flow, 0);
  if (totalFlow < 1e-9) {
    return { Xa: 0, Ca: _params.Ca0, Cr: 0, Cs: 0, flow: 1, T: _params.T_feed ?? 300 };
  }
  const Ca = inlets.reduce((s, st) => s + st.Ca * st.flow, 0) / totalFlow;
  const Cr = inlets.reduce((s, st) => s + st.Cr * st.flow, 0) / totalFlow;
  const Cs = inlets.reduce((s, st) => s + st.Cs * st.flow, 0) / totalFlow;
  const Xa = 1 - Ca / Math.max(_params.Ca0, 1e-9);
  const T = inlets.reduce((s, st) => s + (st.T ?? 300) * st.flow, 0) / totalFlow;
  return { Xa, Ca, Cr, Cs, flow: totalFlow, T };
}

function solveReactorUnit(
  inlet: StreamState,
  tauEff: number,
  reactorType: 'cstr' | 'pfr',
  params: SimulationParams,
  nodeData?: { thermalMode?: ThermalMode; Tc?: number; kappa_v?: number }
): StreamState {
  const T_in = inlet.T ?? (params.T_feed ?? 300);
  const thermalMode = nodeData?.thermalMode ?? 'isothermal';
  const isSingle = params.reactionMode === 'single';

  if (thermalMode === 'isothermal' || !isSingle) {
    if (isSingle) {
      let Xa_out: number;
      if (reactorType === 'cstr') {
        const r = solveCSTR(inlet.Xa, tauEff, params);
        Xa_out = r.Xa_out;
      } else {
        const r = solvePFR(inlet.Xa, tauEff, params);
        Xa_out = r.Xa_out;
      }
      const Ca = params.Ca0 * (1 - Xa_out);
      const Cr = params.Ca0 * Xa_out;
      return { Xa: Xa_out, Ca, Cr, Cs: 0, flow: inlet.flow, T: T_in };
    }

    if (reactorType === 'cstr') {
      const r =
        params.reactionMode === 'series'
          ? solveSeriesCSTR(
              inlet.Ca,
              inlet.Cr,
              inlet.Cs,
              tauEff,
              params.k,
              params.k2
            )
          : solveParallelCSTR(
              inlet.Ca,
              inlet.Cr,
              inlet.Cs,
              tauEff,
              params.k,
              params.k2
            );
      const Xa = 1 - r.Ca_out / Math.max(params.Ca0, 1e-9);
      return {
        Xa: Math.max(0, Math.min(0.9999, Xa)),
        Ca: r.Ca_out,
        Cr: r.Cr_out,
        Cs: r.Cs_out,
        flow: inlet.flow,
        T: T_in,
      };
    }

    const r = solveMultiPFR(
      inlet.Ca,
      inlet.Cr,
      inlet.Cs,
      tauEff,
      params.k,
      params.k2,
      params.reactionMode as 'series' | 'parallel'
    );
    const Xa = 1 - r.Ca_out / Math.max(params.Ca0, 1e-9);
    return {
      Xa: Math.max(0, Math.min(0.9999, Xa)),
      Ca: r.Ca_out,
      Cr: r.Cr_out,
      Cs: r.Cs_out,
      flow: inlet.flow,
      T: T_in,
    };
  }

  const Tc = nodeData?.Tc ?? 300;
  const kappa_v_node = nodeData?.kappa_v ?? 0.5;

  if (reactorType === 'cstr') {
    const r = thermalMode === 'adiabatic'
      ? solveCSTRAdiabatic(inlet.Xa, T_in, tauEff, params)
      : solveCSTRCooled(inlet.Xa, T_in, tauEff, Tc, kappa_v_node, params);
    const Ca = params.Ca0 * (1 - r.Xa_out);
    const Cr = params.Ca0 * r.Xa_out;
    return { Xa: r.Xa_out, Ca, Cr, Cs: 0, flow: inlet.flow, T: r.T_out };
  }

  const r = thermalMode === 'adiabatic'
    ? solvePFRAdiabatic(inlet.Xa, T_in, tauEff, params)
    : solvePFRCooled(inlet.Xa, T_in, tauEff, Tc, kappa_v_node, params);
  const Ca = params.Ca0 * (1 - r.Xa_out);
  const Cr = params.Ca0 * r.Xa_out;
  return { Xa: r.Xa_out, Ca, Cr, Cs: 0, flow: inlet.flow, T: r.T_out };
}

function forwardPass(
  nodes: Node[],
  edges: Edge[],
  tearIds: Set<string>,
  tearStreams: Map<string, StreamState>,
  params: SimulationParams,
  topoOrder: string[]
): { streams: Map<string, StreamState>; nodeOutputs: Map<string, StreamState> } {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const streams = new Map<string, StreamState>();
  const nodeOutputs = new Map<string, StreamState>();

  for (const [edgeId, state] of tearStreams) {
    streams.set(edgeId, state);
  }

  const incomingEdges = new Map<string, Edge[]>();
  for (const e of edges) {
    if (!incomingEdges.has(e.target)) incomingEdges.set(e.target, []);
    incomingEdges.get(e.target)!.push(e);
  }
  const outgoingEdges = new Map<string, Edge[]>();
  for (const e of edges) {
    if (!outgoingEdges.has(e.source)) outgoingEdges.set(e.source, []);
    outgoingEdges.get(e.source)!.push(e);
  }

  for (const nodeId of topoOrder) {
    const node = nodeMap.get(nodeId)!;
    let outState: StreamState;

    if (node.type === 'feed') {
      outState = {
        Xa: 0, Ca: params.Ca0, Cr: 0, Cs: 0,
        flow: 1.0, T: params.T_feed ?? 300,
      };
    } else if (node.type === 'product') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      outState = getInletStream(inEdges, streams, params);
    } else if (node.type === 'cstr' || node.type === 'pfr') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      const inlet = getInletStream(inEdges, streams, params);
      const data = node.data as {
        tau: number;
        reactorType: 'CSTR' | 'PFR';
        thermalMode?: ThermalMode;
        Tc?: number;
        kappa_v?: number;
      };
      const tauEff = data.tau / Math.max(inlet.flow, 0.001);
      outState = solveReactorUnit(
        inlet, tauEff, node.type as 'cstr' | 'pfr', params, data
      );
    } else if (node.type === 'mixer') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      outState = mixStreams(inEdges, streams, params);
    } else if (node.type === 'splitter') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      const inlet = getInletStream(inEdges, streams, params);
      const alpha = (node.data as { alpha: number }).alpha;
      const outEdges = outgoingEdges.get(nodeId) ?? [];
      const topEdge = outEdges.find((e) => e.sourceHandle === 'out-top');
      const botEdge = outEdges.find((e) => e.sourceHandle === 'out-bot');
      if (topEdge) {
        streams.set(topEdge.id, { ...inlet, flow: alpha * inlet.flow });
      }
      if (botEdge) {
        streams.set(botEdge.id, { ...inlet, flow: (1 - alpha) * inlet.flow });
      }
      outState = inlet;
    } else {
      outState = {
        Xa: 0, Ca: params.Ca0, Cr: 0, Cs: 0,
        flow: 1.0, T: params.T_feed ?? 300,
      };
    }

    nodeOutputs.set(nodeId, outState);

    if (node.type !== 'splitter') {
      for (const e of outgoingEdges.get(nodeId) ?? []) {
        streams.set(e.id, outState);
      }
    }
  }

  return { streams, nodeOutputs };
}

function buildReactorProfile(
  node: Node,
  inlet: StreamState,
  Xa_out: number,
  tauEff: number,
  params: SimulationParams
): { cumTau: number; Xa: number; Ca: number; Cr: number; Cs: number; T: number }[] {
  const data = node.data as {
    tau: number;
    reactorType: 'CSTR' | 'PFR';
    thermalMode?: ThermalMode;
    Tc?: number;
    kappa_v?: number;
  };
  const isSingle = params.reactionMode === 'single';
  const thermalMode = data.thermalMode ?? 'isothermal';
  const T_in = inlet.T ?? (params.T_feed ?? 300);

  if (node.type === 'cstr') {
    if (isSingle && thermalMode === 'adiabatic') {
      const r = solveCSTRAdiabatic(inlet.Xa, T_in, tauEff, params);
      return [
        { cumTau: 0, Xa: inlet.Xa, Ca: params.Ca0 * (1 - inlet.Xa), Cr: params.Ca0 * inlet.Xa, Cs: 0, T: T_in },
        { cumTau: tauEff, Xa: r.Xa_out, Ca: params.Ca0 * (1 - r.Xa_out), Cr: params.Ca0 * r.Xa_out, Cs: 0, T: r.T_out },
      ];
    }
    if (isSingle && thermalMode === 'cooled') {
      const Tc = data.Tc ?? 300;
      const kappa_v_node = data.kappa_v ?? 0.5;
      const r = solveCSTRCooled(inlet.Xa, T_in, tauEff, Tc, kappa_v_node, params);
      return [
        { cumTau: 0, Xa: inlet.Xa, Ca: params.Ca0 * (1 - inlet.Xa), Cr: params.Ca0 * inlet.Xa, Cs: 0, T: T_in },
        { cumTau: tauEff, Xa: r.Xa_out, Ca: params.Ca0 * (1 - r.Xa_out), Cr: params.Ca0 * r.Xa_out, Cs: 0, T: r.T_out },
      ];
    }

    if (isSingle) {
      return [
        { cumTau: 0, Xa: inlet.Xa, Ca: params.Ca0 * (1 - inlet.Xa), Cr: params.Ca0 * inlet.Xa, Cs: 0, T: T_in },
        { cumTau: tauEff, Xa: Xa_out, Ca: params.Ca0 * (1 - Xa_out), Cr: params.Ca0 * Xa_out, Cs: 0, T: T_in },
      ];
    }

    const r =
      params.reactionMode === 'series'
        ? solveSeriesCSTR(inlet.Ca, inlet.Cr, inlet.Cs, tauEff, params.k, params.k2)
        : solveParallelCSTR(inlet.Ca, inlet.Cr, inlet.Cs, tauEff, params.k, params.k2);
    return [
      { cumTau: 0, Xa: inlet.Xa, Ca: inlet.Ca, Cr: inlet.Cr, Cs: inlet.Cs, T: T_in },
      { cumTau: tauEff, Xa: 1 - r.Ca_out / Math.max(params.Ca0, 1e-9), Ca: r.Ca_out, Cr: r.Cr_out, Cs: r.Cs_out, T: T_in },
    ];
  }

  if (isSingle && thermalMode === 'adiabatic') {
    const r = solvePFRAdiabatic(inlet.Xa, T_in, tauEff, params);
    return r.profile.map((p) => ({
      cumTau: p.t,
      Xa: p.Xa,
      Ca: params.Ca0 * (1 - p.Xa),
      Cr: params.Ca0 * p.Xa,
      Cs: 0,
      T: p.T,
    }));
  }
  if (isSingle && thermalMode === 'cooled') {
    const Tc = data.Tc ?? 300;
    const kappa_v_node = data.kappa_v ?? 0.5;
    const r = solvePFRCooled(inlet.Xa, T_in, tauEff, Tc, kappa_v_node, params);
    return r.profile.map((p) => ({
      cumTau: p.t,
      Xa: p.Xa,
      Ca: params.Ca0 * (1 - p.Xa),
      Cr: params.Ca0 * p.Xa,
      Cs: 0,
      T: p.T,
    }));
  }

  if (isSingle) {
    const r = solvePFR(inlet.Xa, tauEff, params);
    return r.profile.map((p) => ({
      cumTau: p.cumTau,
      Xa: p.Xa,
      Ca: params.Ca0 * (1 - p.Xa),
      Cr: params.Ca0 * p.Xa,
      Cs: 0,
      T: T_in,
    }));
  }

  const r = solveMultiPFR(
    inlet.Ca, inlet.Cr, inlet.Cs, tauEff,
    params.k, params.k2,
    params.reactionMode as 'series' | 'parallel'
  );
  return r.profile.map((p) => ({
    cumTau: p.t,
    Xa: 1 - p.Ca / Math.max(params.Ca0, 1e-9),
    Ca: p.Ca, Cr: p.Cr, Cs: p.Cs,
    T: T_in,
  }));
}

function buildSegments(
  nodes: Node[],
  edges: Edge[],
  pass: ReturnType<typeof forwardPass>,
  params: SimulationParams
): ReactorSegmentResult[] {
  const reactorNodes = nodes.filter((n) => n.type === 'cstr' || n.type === 'pfr');
  const order = findReactorOrder(nodes, edges);
  const segments: ReactorSegmentResult[] = [];
  let cumTauOffset = 0;

  for (const nodeId of order) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    const data = node.data as {
      reactorType: 'CSTR' | 'PFR';
      label: string;
      tau: number;
      thermalMode?: ThermalMode;
      Tc?: number;
      kappa_v?: number;
    };
    const output = pass.nodeOutputs.get(nodeId);
    if (!output) continue;

    const incomingEdges = edges.filter((e) => e.target === nodeId);
    const inlet = getInletStream(incomingEdges, pass.streams, params);
    const Xa_in = inlet.Xa;
    const Xa_out = output.Xa;
    const T_in = inlet.T ?? (params.T_feed ?? 300);
    const T_out = output.T ?? T_in;

    const Da =
      params.kinetics === 'first-order'
        ? params.k * data.tau
        : params.k * params.Ca0 * data.tau;

    const tauEff = data.tau / Math.max(inlet.flow, 0.001);

    const rawProfile = buildReactorProfile(node, inlet, Xa_out, tauEff, params);

    const profile = rawProfile.map((p) => ({
      ...p,
      cumTau: cumTauOffset + p.cumTau,
    }));

    cumTauOffset += tauEff;

    const yieldR = output.Cr / Math.max(params.Ca0, 1e-9);
    const consumed =
      params.reactionMode === 'single'
        ? params.Ca0 * Xa_out
        : inlet.Ca - output.Ca;
    const selectivity =
      Math.abs(consumed) > 1e-9
        ? output.Cr / Math.max(consumed, 1e-9)
        : 0;

    segments.push({
      reactorId: node.id,
      reactorType: data.reactorType,
      label: data.label,
      Xa_in,
      Xa_out,
      T_in,
      T_out,
      tau: data.tau,
      Da,
      Ca_out: output.Ca,
      Cr_out: output.Cr,
      Cs_out: output.Cs,
      yield_R: yieldR,
      selectivity_R: selectivity,
      profile,
    });
  }

  return segments;
}

function findReactorOrder(nodes: Node[], edges: Edge[]): string[] {
  const reactorIds = new Set(
    nodes.filter((n) => n.type === 'cstr' || n.type === 'pfr').map((n) => n.id)
  );

  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
  }

  const visited = new Set<string>();
  const order: string[] = [];
  let current = 'feed';

  while (current !== 'product') {
    if (visited.has(current)) break;
    visited.add(current);

    let nextId: string | undefined;
    for (const t of adj.get(current) ?? []) {
      if (reactorIds.has(t) && !visited.has(t)) {
        nextId = t;
        break;
      }
    }
    if (!nextId) {
      for (const t of adj.get(current) ?? []) {
        if (t === 'product') break;
        if (!visited.has(t)) {
          nextId = t;
          break;
        }
      }
    }
    if (!nextId) break;

    if (reactorIds.has(nextId)) order.push(nextId);
    current = nextId;
  }

  return order;
}

export function solveNetwork(
  nodes: Node[],
  edges: Edge[],
  params: SimulationParams
): SimulationResult | null {
  if (
    !nodes.find((n) => n.id === 'feed') ||
    !nodes.find((n) => n.id === 'product')
  )
    return null;

  const tearIds = findTearEdgeIds(nodes, edges);
  const topoOrder = topoSort(nodes, edges, tearIds);
  if (topoOrder.length !== nodes.length) return null;

  const tearStreams = new Map<string, StreamState>();
  for (const e of edges.filter((e) => tearIds.has(e.id))) {
    tearStreams.set(e.id, {
      Xa: 0,
      Ca: params.Ca0,
      Cr: 0,
      Cs: 0,
      flow: 1,
      T: params.T_feed ?? 300,
    });
  }

  const DAMP = 0.5;
  const TOL = 1e-6;
  const MAX_ITER = 200;

  let converged = false;
  let iterations = 0;
  let lastPass: ReturnType<typeof forwardPass> | null = null;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    iterations = iter + 1;
    const pass = forwardPass(nodes, edges, tearIds, tearStreams, params, topoOrder);
    lastPass = pass;

    let error = 0;
    for (const e of edges.filter((e) => tearIds.has(e.id))) {
      const computed = pass.streams.get(e.id)!;
      const assumed = tearStreams.get(e.id)!;
      error = Math.max(
        error,
        Math.abs(computed.Xa - assumed.Xa),
        Math.abs(computed.Ca - assumed.Ca),
        Math.abs((computed.T - assumed.T) / 300)
      );
    }

    if (error < TOL) {
      converged = true;
      break;
    }

    for (const e of edges.filter((e) => tearIds.has(e.id))) {
      const computed = pass.streams.get(e.id)!;
      const assumed = tearStreams.get(e.id)!;
      tearStreams.set(e.id, {
        Xa: assumed.Xa * (1 - DAMP) + computed.Xa * DAMP,
        Ca: assumed.Ca * (1 - DAMP) + computed.Ca * DAMP,
        Cr: assumed.Cr * (1 - DAMP) + computed.Cr * DAMP,
        Cs: assumed.Cs * (1 - DAMP) + computed.Cs * DAMP,
        flow: assumed.flow * (1 - DAMP) + computed.flow * DAMP,
        T: assumed.T * (1 - DAMP) + computed.T * DAMP,
      });
    }
  }

  if (!lastPass) return null;

  const productOutput = lastPass.nodeOutputs.get('product');
  if (!productOutput) return null;

  const segments = buildSegments(nodes, edges, lastPass, params);
  const levenspielCurve = buildLevenspielCurve(params);

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const streamLabels = new Map<string, { label: string; desc: string }>();
  let streamIdx = 0;

  for (const nodeId of topoOrder) {
    const node = nodeMap.get(nodeId);
    if (!node || node.type === 'product') continue;
    for (const e of edges.filter(ee => ee.source === nodeId && !tearIds.has(ee.id))) {
      if (streamLabels.has(e.id)) continue;
      const srcLabel = (nodeMap.get(e.source)?.data as any)?.label ?? e.source.split('-')[0].toUpperCase();
      const tgtLabel = (nodeMap.get(e.target)?.data as any)?.label ?? e.target.split('-')[0].toUpperCase();
      streamLabels.set(e.id, {
        label: `S${String(streamIdx + 1).padStart(2, '0')}`,
        desc: `${srcLabel} → ${tgtLabel}`,
      });
      streamIdx++;
    }
  }

  for (const e of edges.filter(ee => tearIds.has(ee.id))) {
    if (streamLabels.has(e.id)) continue;
    const srcLabel = (nodeMap.get(e.source)?.data as any)?.label ?? e.source.split('-')[0].toUpperCase();
    const tgtLabel = (nodeMap.get(e.target)?.data as any)?.label ?? e.target.split('-')[0].toUpperCase();
    streamLabels.set(e.id, {
      label: `S${String(streamIdx + 1).padStart(2, '0')}`,
      desc: `${srcLabel} → ${tgtLabel}`,
    });
    streamIdx++;
  }

  const streamsOut: Record<string, AnnotatedStream> = {};
  for (const [edgeId, state] of lastPass.streams) {
    const labels = streamLabels.get(edgeId);
    streamsOut[edgeId] = annotateStream(
      stateToStream(state),
      labels?.label,
      labels?.desc
    );
  }

  const nodeOutputsOut: Record<string, AnnotatedStream> = {};
  for (const [nodeId, state] of lastPass.nodeOutputs) {
    nodeOutputsOut[nodeId] = annotateStream(stateToStream(state));
  }

  const chemistry = buildChemistry(params);

  const finalXa = productOutput.Xa;
  const finalYield = productOutput.Cr / Math.max(params.Ca0, 1e-9);
  const finalSelectivity =
    finalXa > 0.001
      ? productOutput.Cr / (params.Ca0 * finalXa)
      : 0;

  return {
    streams: streamsOut,
    nodeOutputs: nodeOutputsOut,
    converged,
    iterations,
    recycleEdgeIds: [...tearIds],
    segments,
    finalConversion: finalXa,
    finalYield,
    finalSelectivity,
    levenspielCurve,
    chemistry,
  };
}
