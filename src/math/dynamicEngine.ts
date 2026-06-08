import type { Node, Edge } from '@xyflow/react';
import type { SimulationParams, ThermalMode } from '../types/reactor';
import type { ChemistryModel, SpeciesId } from '../types/chemistry';
import type { Stream } from '../types/stream';
import { findTearEdgeIds, topoSort } from './networkSolver';
import { pfrModel, type UnitParams } from './unitModels';
import { rk4Step as rk4StepBase } from './numerics';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DynamicNodeState {
  C: Record<SpeciesId, number>;
  T: number;
}

export interface DynamicEngineState {
  nodeStates: Record<string, DynamicNodeState>;
}

export interface DynamicStepResult {
  newEngineState: DynamicEngineState;
  outletC: Record<SpeciesId, number>;
  outletT: number;
  perNodeOutput: Record<string, DynamicNodeState>;
}

// ---------------------------------------------------------------------------
// Public: initialise engine state from a flow-graph
// ---------------------------------------------------------------------------

export function makeDynamicInitialState(
  nodes: Node[],
  params: SimulationParams,
  chemistry: ChemistryModel,
): DynamicEngineState {
  const nodeStates: Record<string, DynamicNodeState> = {};

  for (const n of nodes) {
    if (n.type === 'cstr') {
      const C: Record<SpeciesId, number> = {};
      for (const s of chemistry.species) {
        C[s.id] = s.id === chemistry.keyReactantId ? params.Ca0 : 0;
      }
      nodeStates[n.id] = { C, T: params.T_feed ?? 300 };
    }
  }

  return { nodeStates };
}

// ---------------------------------------------------------------------------
// Public: advance the dynamic network by one time step
// ---------------------------------------------------------------------------

export function runDynamicStep(
  nodes: Node[],
  edges: Edge[],
  engineState: DynamicEngineState,
  params: SimulationParams,
  chemistry: ChemistryModel,
  dt: number,
  disturbanceMult: number,
): DynamicStepResult {
  const speciesIds = chemistry.species.map((s) => s.id);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
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

  const newEngineState: DynamicEngineState = {
    nodeStates: { ...engineState.nodeStates },
  };

  const edgeStreams = new Map<string, DynamicNodeState>();
  const perNodeOutput: Record<string, DynamicNodeState> = {};

  let productOutput: DynamicNodeState | null = null;

  const feedCBase: Record<SpeciesId, number> = {};
  for (const s of chemistry.species) {
    feedCBase[s.id] = s.id === chemistry.keyReactantId ? params.Ca0 : 0;
  }
  const feedT = params.T_feed ?? 300;

  for (const nodeId of topoOrder) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const outEdges = outgoingEdges.get(nodeId) ?? [];

    if (node.type === 'feed') {
      const C: Record<SpeciesId, number> = {};
      for (const s of chemistry.species) {
        C[s.id] = s.id === chemistry.keyReactantId ? params.Ca0 * disturbanceMult : 0;
      }
      const outState: DynamicNodeState = { C, T: feedT };
      perNodeOutput[nodeId] = outState;
      for (const e of outEdges) {
        edgeStreams.set(e.id, outState);
      }
    } else if (node.type === 'mixer') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      const inlets = inEdges
        .map((e) => edgeStreams.get(e.id))
        .filter(Boolean) as DynamicNodeState[];

      let outState: DynamicNodeState;
      if (inlets.length === 0) {
        outState = { C: { ...feedCBase }, T: feedT };
      } else {
        const allSpecies = new Set<SpeciesId>();
        for (const inlet of inlets) {
          for (const id of Object.keys(inlet.C)) allSpecies.add(id);
        }
        const C: Record<SpeciesId, number> = {};
        const n = inlets.length;
        for (const id of allSpecies) {
          let sum = 0;
          for (const inlet of inlets) sum += inlet.C[id] ?? 0;
          C[id] = sum / n;
        }
        let tSum = 0;
        for (const inlet of inlets) tSum += inlet.T;
        outState = { C, T: tSum / n };
      }
      perNodeOutput[nodeId] = outState;
      for (const e of outEdges) {
        edgeStreams.set(e.id, outState);
      }
    } else if (node.type === 'splitter') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      const inState = inEdges.length > 0
        ? edgeStreams.get(inEdges[0].id)
        : { C: { ...feedCBase }, T: feedT };

      if (!inState) continue;

      const topEdge = outEdges.find((e) => e.sourceHandle === 'out-top');
      const botEdge = outEdges.find((e) => e.sourceHandle === 'out-bot');
      if (topEdge) edgeStreams.set(topEdge.id, inState);
      if (botEdge) edgeStreams.set(botEdge.id, inState);

      perNodeOutput[nodeId] = inState;
    } else if (node.type === 'cstr') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      const inlet = inEdges.length > 0
        ? edgeStreams.get(inEdges[0].id)
        : { C: { ...feedCBase }, T: feedT };

      if (!inlet) continue;

      const data = node.data as {
        tau: number; thermalMode?: ThermalMode; Tc?: number; kappa_v?: number;
      };
      const tauEff = data.tau / Math.max(1, 0.001);
      const thermalMode = data.thermalMode ?? 'isothermal';
      const Tc = data.Tc ?? 300;
      const kappa_v = data.kappa_v ?? 0.5;

      let curState = newEngineState.nodeStates[nodeId];
      if (!curState) {
        const C: Record<SpeciesId, number> = {};
        for (const s of chemistry.species) {
          C[s.id] = s.id === chemistry.keyReactantId ? params.Ca0 : 0;
        }
        curState = { C, T: feedT };
      }

      const derivFn = (C: Record<SpeciesId, number>, T: number) =>
        cstrOdeDerivative(C, T, inlet.C, inlet.T, tauEff, thermalMode, Tc, kappa_v, chemistry);

      const next = rk4Step(curState.C, curState.T, derivFn, dt, speciesIds);
      newEngineState.nodeStates[nodeId] = next;

      perNodeOutput[nodeId] = next;
      for (const e of outEdges) {
        edgeStreams.set(e.id, next);
      }
    } else if (node.type === 'pfr') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      const inlet = inEdges.length > 0
        ? edgeStreams.get(inEdges[0].id)
        : { C: { ...feedCBase }, T: feedT };

      if (!inlet) continue;

      const data = node.data as {
        tau: number; thermalMode?: ThermalMode; Tc?: number; kappa_v?: number;
      };
      const tauEff = data.tau / Math.max(1, 0.001);

      const unitParams: UnitParams = {
        tau:         tauEff,
        thermalMode: data.thermalMode ?? 'isothermal',
        Tc:          data.Tc          ?? 300,
        kappa_v:     data.kappa_v     ?? 0.5,
        Ca0:         params.Ca0,
      };

      const inletStream = dynToStream(inlet);
      const unitResult = pfrModel(inletStream, unitParams, chemistry);
      const outState = streamToDyn(unitResult.outlet);

      perNodeOutput[nodeId] = outState;
      for (const e of outEdges) {
        edgeStreams.set(e.id, outState);
      }
    } else if (node.type === 'product') {
      const inEdges = incomingEdges.get(nodeId) ?? [];
      const outState = inEdges.length > 0
        ? edgeStreams.get(inEdges[0].id)
        : { C: { ...feedCBase }, T: feedT };

      if (outState) {
        productOutput = outState;
        perNodeOutput[nodeId] = outState;
      }
    }
  }

  const outletC: Record<SpeciesId, number> = productOutput
    ? { ...productOutput.C }
    : { ...feedCBase };
  const outletT = productOutput?.T ?? feedT;

  return { newEngineState, outletC, outletT, perNodeOutput };
}

// ---------------------------------------------------------------------------
// Private: CSTR unsteady ODE  (no imports from dynamicSolvers / reactorSolvers / thermalSolvers)
// ---------------------------------------------------------------------------

function cstrOdeDerivative(
  C: Record<SpeciesId, number>,
  T: number,
  Cin: Record<SpeciesId, number>,
  Tin: number,
  tau: number,
  thermalMode: ThermalMode,
  Tc: number,
  kappa_v: number,
  chemistry: ChemistryModel,
): { dC: Record<SpeciesId, number>; dT: number } {
  const { reactions, species, thermo } = chemistry;

  // --- net production rate per species ---
  const net: Record<SpeciesId, number> = {};
  for (const s of species) net[s.id] = 0;
  for (const rxn of reactions) {
    const rate = rxn.rateLaw(C, T, rxn.kineticParams);
    for (const [s, stoich] of Object.entries(rxn.stoichiometry)) {
      net[s] = (net[s] ?? 0) + stoich * rate;
    }
  }

  // --- material balances ---
  const dC: Record<SpeciesId, number> = {};
  for (const s of species) {
    const cin = Cin[s.id] ?? 0;
    const ccur = C[s.id] ?? 0;
    dC[s.id] = (cin - ccur) / tau + (net[s.id] ?? 0);
  }

  // --- energy balance ---
  let dT = 0;
  if (thermalMode !== 'isothermal') {
    let heatGen = 0;
    for (const rxn of reactions) {
      const rate = rxn.rateLaw(C, T, rxn.kineticParams);
      heatGen += (-thermo.deltaH(rxn.id, T)) * rate;
    }
    const rhoCp = thermo.rhoCp(C, T);
    const cooling = thermalMode === 'cooled'
      ? kappa_v * (T - Tc) / rhoCp
      : 0;
    dT = (Tin - T) / tau + heatGen / rhoCp - cooling;
  }

  return { dC, dT };
}

// ---------------------------------------------------------------------------
// Private: RK4 for the (C, T) system
// ---------------------------------------------------------------------------

function rk4Step(
  C_in: Record<SpeciesId, number>,
  T_in: number,
  derivFn: (
    C: Record<SpeciesId, number>,
    T: number,
  ) => { dC: Record<SpeciesId, number>; dT: number },
  dt: number,
  speciesIds: SpeciesId[],
): DynamicNodeState {
  const n = speciesIds.length;

  const toArr = (C: Record<SpeciesId, number>): number[] =>
    speciesIds.map((id) => C[id] ?? 0);

  const toRec = (arr: number[]): Record<SpeciesId, number> => {
    const rec: Record<SpeciesId, number> = {};
    for (let i = 0; i < n; i++) rec[speciesIds[i]] = arr[i];
    return rec;
  };

  const yDeriv = (_t: number, y: number[]): number[] => {
    const C = toRec(y.slice(0, n));
    const T = y[n];
    const { dC, dT } = derivFn(C, T);
    return [...speciesIds.map((id) => dC[id] ?? 0), dT];
  };

  const y0 = [...toArr(C_in), T_in];
  const yNext = rk4StepBase(yDeriv, 0, y0, dt);

  for (let i = 0; i < n; i++) yNext[i] = Math.max(0, yNext[i]);
  yNext[n] = Math.max(200, Math.min(1500, yNext[n]));

  return { C: toRec(yNext), T: yNext[n] };
}

// ---------------------------------------------------------------------------
// Private: DynamicNodeState ↔ Stream bridge
// ---------------------------------------------------------------------------

function dynToStream(state: DynamicNodeState): Stream {
  return { F: { ...state.C }, T: state.T, P: 101325 };
}

function streamToDyn(s: Stream): DynamicNodeState {
  return { C: { ...s.F }, T: s.T };
}
