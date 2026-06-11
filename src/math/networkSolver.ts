import type { Node, Edge } from '@xyflow/react';
import type {
  SimulationParams,
  SimulationResult,
  ReactorSegmentResult,
  RecycleIterationRecord,
  RecycleConvergenceEntry,
} from '../types/reactor';
import type { ThermalMode } from '../types/simulation';
import { buildLevenspielCurve } from './kinetics';
import { type StreamState, streamToState, stateToStream, annotateStream } from './streamBridge';
import { buildChemistry } from './chemistryFactory';
import { getPreset } from './reactionRegistry';
import { cstrModel, pfrModel, sideFeedPFR, catalyticPFR, type UnitParams, type SideFeedParams, type CatalyticPFRParams } from './unitModels';
import { semibatchSolve } from './semibatchModel';
import type { AnnotatedStream } from '../types/stream';
import type { ChemistryModel } from '../types/chemistry';

import { findTearEdgeIds, topoSort, reachableFrom, reachableTo } from './topology';
import { computeXeq } from './equilibrium';
import { buildOperatingDiagram, type OperatingDiagramData } from './operatingDiagramModel';

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

function forwardPass(
  nodes: Node[],
  edges: Edge[],
  tearIds: Set<string>,
  tearStreams: Map<string, StreamState>,
  params: SimulationParams,
  topoOrder: string[],
  chemistry: ChemistryModel
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
      const fData = node.data as { Ca0?: number; T_feed?: number; flowrate?: number; speciesLabel?: string };
      outState = {
        Xa: 0,
        Ca:   fData.Ca0      ?? params.Ca0,
        Cr: 0, Cs: 0,
        flow: fData.flowrate ?? 1.0,
        T:    fData.T_feed   ?? params.T_feed,
        speciesLabel: fData.speciesLabel,
      };
    } else if (node.type === 'product') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      outState = getInletStream(inEdges, streams, params);
    } else if (node.type === 'fixedbed') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      const inlet = mixStreams(inEdges, streams, params);
      const fbData = node.data as { W_cat?: number; rho_bulk?: number; epsilon_bed?: number; thermalMode?: ThermalMode; Tc?: number; kappa_v?: number };
      const tauEff = 1.0 / Math.max(inlet.flow, 0.001);
      const catParams: CatalyticPFRParams = {
        tau: tauEff, thermalMode: fbData.thermalMode ?? 'isothermal',
        Tc: fbData.Tc ?? 300, kappa_v: fbData.kappa_v ?? 0.5, Ca0: params.Ca0,
        W_cat: fbData.W_cat ?? 5.0, rho_bulk: fbData.rho_bulk, epsilon_bed: fbData.epsilon_bed,
      };
      const inletStream = stateToStream(inlet);
      const unitResult = catalyticPFR(inletStream, catParams, chemistry);
      outState = streamToState(unitResult.outlet, params.Ca0);
    } else if (node.type === 'semibatch') {
      const sbData = node.data as { tau: number; FB0?: number; CB_feed?: number };
      const sbResult = semibatchSolve(
        { tau_batch: sbData.tau, FB0: sbData.FB0 ?? 0.1, CB_feed: sbData.CB_feed ?? 1.0,
          Na0: params.Ca0, V0: 1.0 },
        chemistry,
        params.T_feed ?? 300,
      );
      outState = {
        Xa: sbResult.Xa_out, Ca: params.Ca0 * (1 - sbResult.Xa_out),
        Cr: params.Ca0 * sbResult.Xa_out * sbResult.selectivity_R,
        Cs: params.Ca0 * sbResult.Xa_out * (1 - sbResult.selectivity_R),
        flow: 1, T: sbResult.T_out,
      };
    } else if (node.type === 'cstr' || node.type === 'pfr' || node.type === 'batch') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      const inlet = node.type === 'batch'
        ? { Xa: 0, Ca: params.Ca0, Cr: 0, Cs: 0, flow: 1, T: params.T_feed ?? 300 }
        : mixStreams(inEdges, streams, params);
      const data = node.data as {
        tau: number;
        reactorType: 'CSTR' | 'PFR' | 'Batch';
        thermalMode?: ThermalMode;
        Tc?: number;
        kappa_v?: number;
        pressureDrop?: boolean;
        Dp?: number;
        phi?: number;
        P0?: number;
        u0?: number;
      };
      const tauEff = data.tau / Math.max(inlet.flow, 0.001);
      const unitParams: UnitParams = {
        tau:          tauEff,
        thermalMode:  data.thermalMode  ?? 'isothermal',
        Tc:           data.Tc           ?? 300,
        kappa_v:      data.kappa_v      ?? 0.5,
        Ca0:          params.Ca0,
        pressureDrop: data.pressureDrop ?? false,
        Dp:           data.Dp           ?? 0.005,
        phi:          data.phi          ?? 0.4,
        P0:           data.P0           ?? 101325,
        u0:           data.u0           ?? 0.01,
        gasPhase:     params.kinetics === 'gas-phase-1st-order',
        epsilon:      params.epsilon    ?? 0,
      };
      const isSideInject = node.type === 'pfr' && !!((node.data as { sideInjection?: boolean }).sideInjection);
      const model = node.type === 'cstr' ? cstrModel : pfrModel;
      const inletStream = stateToStream(inlet);
      let unitResult;
      if (isSideInject) {
        const sideFeedData = node.data as { FB0_side?: number; CB_feed_side?: number };
        const sideParams: SideFeedParams = { ...unitParams, FB0_side: sideFeedData.FB0_side ?? 0.1, CB_feed_side: sideFeedData.CB_feed_side };
        unitResult = sideFeedPFR(inletStream, sideParams, chemistry);
      } else {
        unitResult = model(inletStream, unitParams, chemistry);
      }
      outState = streamToState(unitResult.outlet, params.Ca0);
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
      // fallback: assign by edge order when handles don't match 'out-top'/'out-bot'
      const unset = outEdges.filter(e => !streams.has(e.id));
      if (unset[0]) streams.set(unset[0].id, { ...inlet, flow: alpha * inlet.flow });
      if (unset[1]) streams.set(unset[1].id, { ...inlet, flow: (1 - alpha) * inlet.flow });
      outState = inlet;
    } else {
      outState = {
        Xa: 0, Ca: params.Ca0, Cr: 0, Cs: 0,
        flow: 1.0, T: params.T_feed ?? 300,
      };
    }

    nodeOutputs.set(nodeId, outState);

    if (node.type !== 'splitter') {
      const outEdges = outgoingEdges.get(nodeId) ?? [];
      const N = outEdges.length;
      for (const e of outEdges) {
        streams.set(e.id, N > 1 ? { ...outState, flow: outState.flow / N } : outState);
      }
    }
  }

  return { streams, nodeOutputs };
}

function buildSegments(
  nodes: Node[],
  edges: Edge[],
  tearIds: Set<string>,
  pass: ReturnType<typeof forwardPass>,
  params: SimulationParams,
  chemistry: ChemistryModel
): ReactorSegmentResult[] {
  const reactorNodes = nodes.filter((n) => n.type === 'cstr' || n.type === 'pfr' || n.type === 'batch' || n.type === 'semibatch' || n.type === 'fixedbed');
  const order = findReactorOrder(nodes, edges, tearIds);
  const segments: ReactorSegmentResult[] = [];
  let cumTauOffset = 0;

  for (const nodeId of order) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    const data = node.data as {
      reactorType: 'CSTR' | 'PFR' | 'Batch' | 'Semibatch' | 'FixedBed';
      label: string;
      tau: number;
      thermalMode?: ThermalMode;
      Tc?: number;
      kappa_v?: number;
      pressureDrop?: boolean;
      Dp?: number;
      phi?: number;
      P0?: number;
      u0?: number;
      FB0?: number;
      CB_feed?: number;
      W_cat?: number;
      rho_bulk?: number;
      epsilon_bed?: number;
    };
    const output = pass.nodeOutputs.get(nodeId);
    if (!output) continue;

    const incomingEdges = edges.filter((e) => e.target === nodeId);
    const isBatchLike = node.type === 'batch' || node.type === 'semibatch';
    const inlet = isBatchLike
      ? { Xa: 0, Ca: params.Ca0, Cr: 0, Cs: 0, flow: 1, T: params.T_feed ?? 300 }
      : getInletStream(incomingEdges, pass.streams, params);
    const Xa_in = inlet.Xa;
    const Xa_out = output.Xa;
    const T_in = inlet.T ?? (params.T_feed ?? 300);
    const T_out = output.T ?? T_in;

    const Da = getPreset(params).computeDa(params.k, data.tau, params.Ca0);

    if (isBatchLike) cumTauOffset = 0;

    let profile: ReactorSegmentResult['profile'];
    let P_out: number | undefined;
    let V: number | undefined;

    if (node.type === 'fixedbed') {
      const tauEff = data.tau / Math.max(inlet.flow, 0.001);
      const catParams: CatalyticPFRParams = {
        tau: tauEff, thermalMode: data.thermalMode ?? 'isothermal',
        Tc: data.Tc ?? 300, kappa_v: data.kappa_v ?? 0.5, Ca0: params.Ca0,
        W_cat: data.W_cat ?? 5.0, rho_bulk: data.rho_bulk, epsilon_bed: data.epsilon_bed,
      };
      const inletStream = stateToStream(inlet);
      const unitResult = catalyticPFR(inletStream, catParams, chemistry);
      const rawProfile = unitResult.profile.map(p => ({
        cumTau: p.cumTau,
        Xa: Math.max(0, Math.min(0.9999, 1 - (p.C[chemistry.keyReactantId] ?? 0) / Math.max(params.Ca0, 1e-9))),
        Ca: p.C['A'] ?? 0, Cr: p.C['R'] ?? 0, Cs: p.C['S'] ?? 0, T: p.T,
      }));
      profile = rawProfile.map((p) => ({ ...p, cumTau: cumTauOffset + p.cumTau }));
      cumTauOffset += tauEff;
      P_out = unitResult.outlet.P;
      V = data.W_cat ? data.W_cat / ((data.rho_bulk ?? 1200) * (1 - (data.epsilon_bed ?? 0.4))) : undefined;
    } else if (node.type === 'semibatch') {
      const sbResult = semibatchSolve(
        { tau_batch: data.tau, FB0: data.FB0 ?? 0.1, CB_feed: data.CB_feed ?? 1.0,
          Na0: params.Ca0, V0: 1.0 },
        chemistry, T_in,
      );
      profile = sbResult.profile.map((p) => ({
        cumTau: p.t, Xa: p.Xa, Ca: p.Ca, Cr: params.Ca0 * p.Xa * sbResult.selectivity_R, Cs: 0, T: T_in,
      }));
      P_out = 101325;
      V = undefined;
    } else {
      const tauEff = data.tau / Math.max(inlet.flow, 0.001);
      const unitParams: UnitParams = {
        tau:          tauEff,
        thermalMode:  data.thermalMode  ?? 'isothermal',
        Tc:           data.Tc           ?? 300,
        kappa_v:      data.kappa_v      ?? 0.5,
        Ca0:          params.Ca0,
        pressureDrop: data.pressureDrop ?? false,
        Dp:           data.Dp           ?? 0.005,
        phi:          data.phi          ?? 0.4,
        P0:           data.P0           ?? 101325,
        u0:           data.u0           ?? 0.01,
      };
      const isSideInject = node.type === 'pfr' && !!((node.data as { sideInjection?: boolean }).sideInjection);
      const model = node.type === 'cstr' ? cstrModel : pfrModel;
      const inletStream = stateToStream(inlet);
      let unitResult;
      if (isSideInject) {
        const sideFeedData = node.data as { FB0_side?: number; CB_feed_side?: number };
        const sideParams: SideFeedParams = { ...unitParams, FB0_side: sideFeedData.FB0_side ?? 0.1, CB_feed_side: sideFeedData.CB_feed_side };
        unitResult = sideFeedPFR(inletStream, sideParams, chemistry);
      } else {
        unitResult = model(inletStream, unitParams, chemistry);
      }
      const rawProfile = unitResult.profile.map(p => ({
        cumTau: p.cumTau,
        Xa:     Math.max(0, Math.min(0.9999, 1 - (p.C[chemistry.keyReactantId] ?? 0) / Math.max(params.Ca0, 1e-9))),
        Ca:     p.C['A'] ?? 0,
        Cr:     p.C['R'] ?? 0,
        Cs:     p.C['S'] ?? 0,
        T:      p.T,
      }));
      profile = rawProfile.map((p) => ({ ...p, cumTau: cumTauOffset + p.cumTau }));
      cumTauOffset += tauEff;
      P_out = unitResult.outlet.P;
      V = params.Q_feed > 0 ? data.tau * params.Q_feed : undefined;
    }

    const yieldR = output.Cr / Math.max(params.Ca0, 1e-9);
    const consumed = getPreset(params).isSingle
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
      P_out,
      V,
    });
  }

  return segments;
}

function findReactorOrder(nodes: Node[], edges: Edge[], tearIds: Set<string>): string[] {
  const reactorIds = new Set(
    nodes.filter((n) => n.type === 'cstr' || n.type === 'pfr' || n.type === 'batch' || n.type === 'semibatch' || n.type === 'fixedbed').map((n) => n.id)
  );
  const batchIds = new Set(
    nodes.filter((n) => n.type === 'batch' || n.type === 'semibatch').map((n) => n.id)
  );

  const fromAnyFeed = new Set<string>();
  for (const fn of nodes.filter((n) => n.type === 'feed')) {
    for (const id of reachableFrom(fn.id, edges)) fromAnyFeed.add(id);
  }

  const toAnyProduct = new Set<string>();
  for (const pn of nodes.filter((n) => n.type === 'product')) {
    for (const id of reachableTo(pn.id, edges)) toAnyProduct.add(id);
  }

  return topoSort(nodes, edges, tearIds).filter(
    (id) =>
      reactorIds.has(id) &&
      (batchIds.has(id) || (fromAnyFeed.has(id) && toAnyProduct.has(id)))
  );
}

export function solveNetwork(
  nodes: Node[],
  edges: Edge[],
  params: SimulationParams
): SimulationResult | null {
  const feedNodes    = nodes.filter((n) => n.type === 'feed');
  const productNodes = nodes.filter((n) => n.type === 'product');

  if (feedNodes.length === 0 || productNodes.length === 0) return null;

  const nodeIds = new Set(nodes.map(n => n.id));
  const safeEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

  const reachableFromAllFeeds = new Set<string>();
  for (const fn of feedNodes) {
    for (const id of reachableFrom(fn.id, safeEdges)) reachableFromAllFeeds.add(id);
  }
  if (!productNodes.some((pn) => reachableFromAllFeeds.has(pn.id))) return null;

  const chemistry = buildChemistry(params);

  const tearIds = findTearEdgeIds(nodes, safeEdges);
  const topoOrder = topoSort(nodes, safeEdges, tearIds);
  if (topoOrder.length !== nodes.length) return null;

  const tearStreams = new Map<string, StreamState>();
  for (const e of safeEdges.filter((e) => tearIds.has(e.id))) {
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

  const recycleHistory: RecycleIterationRecord[] = [];

  for (let iter = 0; iter < MAX_ITER; iter++) {
    iterations = iter + 1;
    const pass = forwardPass(nodes, safeEdges, tearIds, tearStreams, params, topoOrder, chemistry);
    lastPass = pass;

    let error = 0;
    for (const e of safeEdges.filter((e) => tearIds.has(e.id))) {
      const computed = pass.streams.get(e.id)!;
      const assumed = tearStreams.get(e.id)!;
      error = Math.max(
        error,
        Math.abs(computed.Xa - assumed.Xa),
        Math.abs(computed.Ca - assumed.Ca),
        Math.abs((computed.T - assumed.T) / 300)
      );
    }

    recycleHistory.push({ iteration: iter + 1, maxError: error });

    if (error < TOL) {
      converged = true;
      break;
    }

    for (const e of safeEdges.filter((e) => tearIds.has(e.id))) {
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

  const recycleConvergenceData: Record<string, RecycleConvergenceEntry> = {};
  for (const e of safeEdges.filter((e) => tearIds.has(e.id))) {
    const assumed  = tearStreams.get(e.id)!;
    const computed = lastPass.streams.get(e.id)!;
    recycleConvergenceData[e.id] = {
      assumedXa:  assumed.Xa,
      computedXa: computed.Xa,
      assumedCa:  assumed.Ca,
      computedCa: computed.Ca,
      error:      Math.abs(computed.Xa - assumed.Xa),
    };
  }

  const primaryProductId =
    topoOrder.find((id) => productNodes.some((pn) => pn.id === id)) ??
    productNodes[0]?.id ?? null;
  const productOutput = primaryProductId
    ? lastPass.nodeOutputs.get(primaryProductId)
    : null;
  if (!productOutput) return null;

  const finalConversions: Record<string, number> = {};
  for (const pn of productNodes) {
    const pOut = lastPass.nodeOutputs.get(pn.id);
    if (pOut) finalConversions[pn.id] = pOut.Xa;
  }

  const segments = buildSegments(nodes, safeEdges, tearIds, lastPass, params, chemistry);
  const levenspielCurve = buildLevenspielCurve(params);

  const operatingDiagrams: Record<string, OperatingDiagramData> = {};
  if (params.reactionMode === 'single') {
    const incomingEdges = new Map<string, Edge[]>();
    for (const e of safeEdges) {
      if (!incomingEdges.has(e.target)) incomingEdges.set(e.target, []);
      incomingEdges.get(e.target)!.push(e);
    }
    for (const node of nodes) {
      if (node.type !== 'cstr') continue;
      const data = node.data as { thermalMode?: string; tau: number; Tc?: number; kappa_v?: number };
      if (data.thermalMode !== 'cooled') continue;
      const inEdge = (incomingEdges.get(node.id) ?? [])[0];
      const inlet = inEdge ? lastPass.streams.get(inEdge.id) : null;
      const Xa_in = inlet?.Xa ?? 0;
      const T_in = inlet?.T ?? (params.T_feed ?? 300);
      operatingDiagrams[node.id] = buildOperatingDiagram(
        Xa_in, T_in, data.tau, data.Tc ?? 300, data.kappa_v ?? 0.5, params
      );
    }
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const streamLabels = new Map<string, { label: string; desc: string }>();
  let streamIdx = 0;

  for (const nodeId of topoOrder) {
    const node = nodeMap.get(nodeId);
    if (!node || node.type === 'product') continue;
    for (const e of safeEdges.filter(ee => ee.source === nodeId && !tearIds.has(ee.id))) {
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

  for (const e of safeEdges.filter(ee => tearIds.has(ee.id))) {
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

  const finalXa = productOutput.Xa;
  const finalYield = productOutput.Cr / Math.max(params.Ca0, 1e-9);
  const finalSelectivity =
    finalXa > 0.001
      ? productOutput.Cr / (params.Ca0 * finalXa)
      : 0;

  // Selectivity & yield analysis (series/parallel only)
  let selectivityAnalysis: import('../types/reactor').SelectivityAnalysis | undefined;
  if (params.reactionMode !== 'single') {
    const k1 = params.k;
    const k2 = params.k2 ?? 0.5;
    const totalTau = segments.reduce((s, seg) => s + seg.tau, 0);
    const Da_current = k1 * totalTau;

    if (params.reactionMode === 'parallel') {
      const SR = k1 / (k1 + k2);
      const pts: { Da: number; YR: number }[] = [];
      for (let i = 0; i <= 49; i++) {
        const Da = (i / 49) * 10;
        pts.push({ Da, YR: Da * k1 / (1 + Da * (k1 + k2)) });
      }
      selectivityAnalysis = { SR, YR_curve: pts, Da_current };
    } else {
      // series A→R→S
      const Da_opt = k2 > 0 ? 1 / Math.sqrt(k1 * k2) : undefined;
      const SR = Da_current > 0
        ? (Da_current * k1 / ((1 + Da_current * k1) * (1 + Da_current * k2))) / Math.max(Da_current * k1 / (1 + Da_current * k1), 1e-9)
        : 0;
      const pts: { Da: number; YR: number }[] = [];
      const maxDa = Math.max(10, (Da_opt ?? 5) * 3);
      for (let i = 0; i <= 49; i++) {
        const Da = (i / 49) * maxDa;
        pts.push({ Da, YR: Da * k1 / ((1 + Da * k1) * (1 + Da * k2)) });
      }
      selectivityAnalysis = { SR, YR_curve: pts, Da_opt, Da_current };
    }
  }

  const Xa_eq = params.kinetics === 'reversible'
    ? computeXeq(params.Keq_ref)
    : (params.reactionMode === 'custom' && params.customReaction?.reversible && params.customReaction.Keq_custom != null)
      ? computeXeq(params.customReaction.Keq_custom)
      : undefined;

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
    finalConversions,
    levenspielCurve,
    chemistry,
    operatingDiagrams,
    recycleHistory,
    recycleConvergenceData,
    selectivityAnalysis,
    Xa_eq,
  };
}
