import { useState, useEffect, useRef, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useSimulatorStore } from '../store/simulatorStore';
import { topoSort, findTearEdgeIds } from '../math/networkSolver';
import { solveCSTR, solvePFR, solveSeriesCSTR, solveParallelCSTR, solveMultiPFR } from '../math/reactorSolvers';
import { solveCSTRAdiabatic, solveCSTRCooled, solvePFRAdiabatic, solvePFRCooled } from '../math/thermalSolvers';
import type { SimulationParams, ThermalMode } from '../types/reactor';
import type { StateVec } from '../math/dynamicSolvers';
import { cstrDerivative, rk4StepVec } from '../math/dynamicSolvers';

export interface DynamicPoint {
  t: number;
  Ca: number; Cr: number; Cs: number; T: number;
  Xa: number;
}

interface CstrHistory {
  nodeId: string;
  points: { t: number; Ca: number; Cr: number; T: number }[];
}

interface DynamicSimState {
  isRunning: boolean;
  t: number;
  speed: 1 | 5 | 10 | 50;
  history: DynamicPoint[];
  cstrStates: Record<string, StateVec>;
  cstrHistory: Record<string, { t: number; Ca: number; Cr: number; T: number }[]>;
  disturbanceLog: { t: number; desc: string }[];
  disturbanceMult: number;
}

const DT = 0.05;
const STEPS_PER_FRAME = 3;
const MAX_HISTORY = 800;

function getInletStreamForDynamic(
  inEdges: Edge[],
  edgeStreams: Map<string, StateVec>,
  params: SimulationParams,
  disturbanceMult: number
): StateVec {
  if (inEdges.length === 0) {
    return [params.Ca0 * disturbanceMult, 0, 0, params.T_feed ?? 300];
  }
  return (
    edgeStreams.get(inEdges[0].id) ?? [params.Ca0 * disturbanceMult, 0, 0, params.T_feed ?? 300]
  );
}

function mixStreamsDynamic(
  inEdges: Edge[],
  edgeStreams: Map<string, StateVec>,
  params: SimulationParams
): StateVec {
  const inlets = inEdges
    .map((e) => edgeStreams.get(e.id))
    .filter(Boolean) as StateVec[];
  if (inlets.length === 0) {
    return [params.Ca0, 0, 0, params.T_feed ?? 300];
  }
  const totalFlow = inlets.length;
  let ca = 0, cr = 0, cs = 0, t = 0;
  for (const inlet of inlets) {
    ca += inlet[0] / totalFlow;
    cr += inlet[1] / totalFlow;
    cs += inlet[2] / totalFlow;
    t += inlet[3] / totalFlow;
  }
  return [ca, cr, cs, t];
}

function solveReactorUnitDynamic(
  inlet: StateVec,
  tauEff: number,
  reactorType: 'cstr' | 'pfr',
  params: SimulationParams,
  nodeData?: { thermalMode?: ThermalMode; Tc?: number; kappa_v?: number }
): StateVec {
  const [Ca_in, Cr_in, Cs_in, T_in] = inlet;
  const Xa_in = 1 - Ca_in / Math.max(params.Ca0, 1e-9);
  const thermalMode = nodeData?.thermalMode ?? 'isothermal';
  const isSingle = params.reactionMode === 'single';

  if (thermalMode === 'isothermal' || !isSingle) {
    if (isSingle) {
      let Xa_out: number;
      if (reactorType === 'cstr') {
        const r = solveCSTR(Xa_in, tauEff, params);
        Xa_out = r.Xa_out;
      } else {
        const r = solvePFR(Xa_in, tauEff, params);
        Xa_out = r.Xa_out;
      }
      const Ca = params.Ca0 * (1 - Xa_out);
      const Cr = params.Ca0 * Xa_out;
      return [Ca, Cr, 0, T_in];
    }

    if (reactorType === 'cstr') {
      const r =
        params.reactionMode === 'series'
          ? solveSeriesCSTR(Ca_in, Cr_in, Cs_in, tauEff, params.k, params.k2)
          : solveParallelCSTR(Ca_in, Cr_in, Cs_in, tauEff, params.k, params.k2);
      return [r.Ca_out, r.Cr_out, r.Cs_out, T_in];
    }

    const r = solveMultiPFR(
      Ca_in, Cr_in, Cs_in, tauEff,
      params.k, params.k2,
      params.reactionMode as 'series' | 'parallel'
    );
    return [r.Ca_out, r.Cr_out, r.Cs_out, T_in];
  }

  const Tc = nodeData?.Tc ?? 300;
  const kappa_v_node = nodeData?.kappa_v ?? 0.5;

  if (reactorType === 'cstr') {
    const r = thermalMode === 'adiabatic'
      ? solveCSTRAdiabatic(Xa_in, T_in, tauEff, params)
      : solveCSTRCooled(Xa_in, T_in, tauEff, Tc, kappa_v_node, params);
    const Ca = params.Ca0 * (1 - r.Xa_out);
    const Cr = params.Ca0 * r.Xa_out;
    return [Ca, Cr, 0, r.T_out];
  }

  const r = thermalMode === 'adiabatic'
    ? solvePFRAdiabatic(Xa_in, T_in, tauEff, params)
    : solvePFRCooled(Xa_in, T_in, tauEff, Tc, kappa_v_node, params);
  const Ca = params.Ca0 * (1 - r.Xa_out);
  const Cr = params.Ca0 * r.Xa_out;
  return [Ca, Cr, 0, r.T_out];
}

function stepNetwork(
  nodes: Node[],
  edges: Edge[],
  cstrStates: Record<string, StateVec>,
  params: SimulationParams,
  _t: number,
  dt: number,
  disturbanceMult: number
): { newStates: Record<string, StateVec>; edgeStreams: Map<string, StateVec>; outletStream: StateVec } {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const incomingEdges = new Map<string, Edge[]>();
  const outgoingEdges = new Map<string, Edge[]>();
  for (const e of edges) {
    if (!incomingEdges.has(e.target)) incomingEdges.set(e.target, []);
    incomingEdges.get(e.target)!.push(e);
    if (!outgoingEdges.has(e.source)) outgoingEdges.set(e.source, []);
    outgoingEdges.get(e.source)!.push(e);
  }

  const tearIds = findTearEdgeIds(nodes, edges);
  const topoOrder = topoSort(nodes, edges, tearIds);

  const newStates: Record<string, StateVec> = { ...cstrStates };
  const edgeStreams = new Map<string, StateVec>();

  for (const nodeId of topoOrder) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    if (node.type === 'feed') {
      const outVec: StateVec = [params.Ca0 * disturbanceMult, 0, 0, params.T_feed ?? 300];
      for (const e of outgoingEdges.get(nodeId) ?? []) {
        edgeStreams.set(e.id, outVec);
      }
    } else if (node.type === 'mixer') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      const outVec = mixStreamsDynamic(inEdges, edgeStreams, params);
      for (const e of outgoingEdges.get(nodeId) ?? []) {
        edgeStreams.set(e.id, outVec);
      }
    } else if (node.type === 'splitter') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      const inVec = getInletStreamForDynamic(inEdges, edgeStreams, params, disturbanceMult);
      const alpha = (node.data as { alpha: number }).alpha;
      const outEdges = outgoingEdges.get(nodeId) ?? [];
      const topEdge = outEdges.find((e) => e.sourceHandle === 'out-top');
      const botEdge = outEdges.find((e) => e.sourceHandle === 'out-bot');
      if (topEdge) {
        edgeStreams.set(topEdge.id, [...inVec] as StateVec);
      }
      if (botEdge) {
        edgeStreams.set(botEdge.id, [...inVec] as StateVec);
      }
    } else if (node.type === 'cstr') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      const inflow = inEdges.length > 0 ? edgeStreams.get(inEdges[0].id) : undefined;
      if (!inflow) continue;

      const data = node.data as {
        tau: number; thermalMode?: ThermalMode; Tc?: number; kappa_v?: number; ic_Ca?: number; ic_T?: number;
      };
      const flow = 1;
      const tauEff = data.tau / Math.max(flow, 0.001);
      const thermalMode = data.thermalMode ?? 'isothermal';

      if (thermalMode === 'isothermal') {
        const derivative = (s: StateVec) => cstrDerivative(s, inflow, tauEff, 'isothermal', 300, 0, params);
        const curState = newStates[nodeId] ?? [data.ic_Ca ?? params.Ca0, 0, 0, data.ic_T ?? params.T_feed];
        const nextState = rk4StepVec(curState, derivative, dt, params.Ca0);
        newStates[nodeId] = nextState;
        for (const e of outgoingEdges.get(nodeId) ?? []) {
          edgeStreams.set(e.id, nextState);
        }
      } else {
        const derivative = (s: StateVec) => cstrDerivative(
          s, inflow, tauEff, thermalMode,
          data.Tc ?? 300, data.kappa_v ?? 0.5, params
        );
        const curState = newStates[nodeId] ?? [data.ic_Ca ?? params.Ca0, 0, 0, data.ic_T ?? params.T_feed];
        const nextState = rk4StepVec(curState, derivative, dt, params.Ca0);
        newStates[nodeId] = nextState;
        for (const e of outgoingEdges.get(nodeId) ?? []) {
          edgeStreams.set(e.id, nextState);
        }
      }
    } else if (node.type === 'pfr') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      const inflow = inEdges.length > 0 ? edgeStreams.get(inEdges[0].id) : undefined;
      if (!inflow) continue;

      const data = node.data as {
        tau: number; thermalMode?: ThermalMode; Tc?: number; kappa_v?: number;
      };
      const flow = 1;
      const tauEff = data.tau / Math.max(flow, 0.001);
      const outVec = solveReactorUnitDynamic(inflow, tauEff, 'pfr', params, data);
      for (const e of outgoingEdges.get(nodeId) ?? []) {
        edgeStreams.set(e.id, outVec);
      }
    } else if (node.type === 'product') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      const outletStream = getInletStreamForDynamic(inEdges, edgeStreams, params, disturbanceMult);
      return { newStates, edgeStreams, outletStream };
    }
  }

  const outletStream: StateVec = [params.Ca0 * disturbanceMult, 0, 0, params.T_feed ?? 300];
  return { newStates, edgeStreams, outletStream };
}

export function useDynamicSimulation() {
  const nodes = useSimulatorStore((s) => s.nodes);
  const edges = useSimulatorStore((s) => s.edges);
  const params = useSimulatorStore((s) => s.params);
  const simulationMode = useSimulatorStore((s) => s.simulationMode);

  const [state, setState] = useState<DynamicSimState>({
    isRunning: false,
    t: 0,
    speed: 1,
    history: [],
    cstrStates: {},
    cstrHistory: {},
    disturbanceLog: [],
    disturbanceMult: 1.0,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (simulationMode !== 'dynamic') {
      setState(s => ({ ...s, isRunning: false }));
      return;
    }
  }, [simulationMode]);

  const initNetwork = useCallback(() => {
    const cstrStates: Record<string, StateVec> = {};
    for (const n of nodes) {
      if (n.type === 'cstr') {
        const data = n.data as { ic_Ca?: number; ic_T?: number };
        cstrStates[n.id] = [data.ic_Ca ?? params.Ca0, 0, 0, data.ic_T ?? params.T_feed];
      }
    }
    setState(s => ({
      ...s,
      isRunning: false,
      t: 0,
      history: [],
      cstrStates,
      cstrHistory: {},
      disturbanceLog: [],
      disturbanceMult: 1.0,
    }));
  }, [nodes, params]);

  useEffect(() => {
    if (simulationMode === 'dynamic') {
      initNetwork();
    }
  }, [simulationMode, nodes.length]);

  const play = useCallback(() => setState(s => ({ ...s, isRunning: true })), []);
  const pause = useCallback(() => setState(s => ({ ...s, isRunning: false })), []);
  const reset = useCallback(() => initNetwork(), [initNetwork]);

  const setSpeed = useCallback((speed: 1 | 5 | 10 | 50) => setState(s => ({ ...s, speed })), []);

  const applyDisturbance = useCallback((magnitude: number) => {
    setState(s => ({
      ...s,
      disturbanceMult: s.disturbanceMult * (1 + magnitude / 100),
      disturbanceLog: [...s.disturbanceLog, { t: s.t, desc: `${magnitude > 0 ? '+' : ''}${magnitude}% Cₐ₀` }],
    }));
  }, []);

  useEffect(() => {
    if (!state.isRunning || simulationMode !== 'dynamic') return;
    let rafId: number;
    const cstrNodeIds = nodes.filter(n => n.type === 'cstr').map(n => n.id);

    const tick = () => {
      setState(prev => {
        if (!prev.isRunning) return prev;
        let { t, cstrStates, history, cstrHistory } = prev;
        const stepsToRun = STEPS_PER_FRAME * prev.speed;

        for (let i = 0; i < stepsToRun; i++) {
          const { newStates, outletStream } = stepNetwork(
            nodes, edges, cstrStates, params, t, DT, prev.disturbanceMult
          );
          cstrStates = newStates;
          t += DT;

          if (i % 2 === 0) {
            const [Ca_out, Cr_out, Cs_out, T_out] = outletStream;
            const point: DynamicPoint = {
              t,
              Ca: Ca_out,
              Cr: Cr_out,
              Cs: Cs_out,
              T: T_out,
              Xa: Ca_out < params.Ca0 ? 1 - Ca_out / params.Ca0 : 0,
            };
            history = history.length >= MAX_HISTORY
              ? [...history.slice(1), point]
              : [...history, point];
          }
        }

        const newCstrHistory = { ...cstrHistory };
        for (const nodeId of cstrNodeIds) {
          const sv = cstrStates[nodeId];
          if (!sv) continue;
          if (!newCstrHistory[nodeId]) newCstrHistory[nodeId] = [];
          const h = newCstrHistory[nodeId];
          if (h.length === 0 || h[h.length - 1].t < t) {
            h.push({ t, Ca: sv[0], Cr: sv[1], T: sv[3] });
            if (h.length > MAX_HISTORY) h.shift();
          }
        }

        return { ...prev, t, cstrStates, history, cstrHistory: newCstrHistory };
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [state.isRunning, state.speed, simulationMode, nodes, edges, params, state.disturbanceMult]);

  return {
    isRunning: state.isRunning,
    t: state.t,
    speed: state.speed,
    history: state.history,
    cstrStates: state.cstrStates,
    cstrHistory: state.cstrHistory,
    disturbanceLog: state.disturbanceLog,
    play,
    pause,
    reset,
    setSpeed,
    applyDisturbance,
  };
}
