import { useState, useEffect, useRef, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useSimulatorStore } from '../store/simulatorStore';
import {
  runDynamicStep,
  makeDynamicInitialState,
  type DynamicEngineState,
} from '../math/dynamicEngine';
import { buildChemistry } from '../math/chemistryFactory';

type StateVec = [number, number, number, number];

export interface DynamicPoint {
  t: number;
  Ca: number; Cr: number; Cs: number; T: number;
  Xa: number;
}

interface DynamicSimState {
  isRunning: boolean;
  t: number;
  speed: 1 | 5 | 10 | 50;
  history: DynamicPoint[];
  cstrHistory: Record<string, { t: number; Ca: number; Cr: number; T: number }[]>;
  disturbanceLog: { t: number; desc: string }[];
  disturbanceMult: number;
}

const DT = 0.05;
const STEPS_PER_FRAME = 3;
const MAX_HISTORY = 800;

function toCstrStateVecs(
  s: DynamicEngineState,
): Record<string, StateVec> {
  const out: Record<string, StateVec> = {};
  for (const [id, ns] of Object.entries(s.nodeStates)) {
    out[id] = [ns.C['A'] ?? 0, ns.C['R'] ?? 0, ns.C['S'] ?? 0, ns.T];
  }
  return out;
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
    cstrHistory: {},
    disturbanceLog: [],
    disturbanceMult: 1.0,
  });

  const engineStateRef = useRef<DynamicEngineState>({ nodeStates: {} });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (simulationMode !== 'dynamic') {
      setState(s => ({ ...s, isRunning: false }));
      return;
    }
  }, [simulationMode]);

  const initNetwork = useCallback(() => {
    engineStateRef.current = makeDynamicInitialState(nodes, params, buildChemistry(params));
    setState(s => ({
      ...s,
      isRunning: false,
      t: 0,
      history: [],
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
    const chemistry = buildChemistry(params);

    const tick = () => {
      setState(prev => {
        if (!prev.isRunning) return prev;
        let { t, history, cstrHistory } = prev;
        const stepsToRun = STEPS_PER_FRAME * prev.speed;

        for (let i = 0; i < stepsToRun; i++) {
          const result = runDynamicStep(
            nodes, edges, engineStateRef.current, params, chemistry, DT, prev.disturbanceMult,
          );
          engineStateRef.current = result.newEngineState;
          t += DT;

          if (i % 2 === 0) {
            const Ca_out = result.outletC[chemistry.keyReactantId] ?? 0;
            const point: DynamicPoint = {
              t,
              Ca: Ca_out,
              Cr: result.outletC['R'] ?? 0,
              Cs: result.outletC['S'] ?? 0,
              T: result.outletT,
              Xa: Ca_out < params.Ca0 ? 1 - Ca_out / params.Ca0 : 0,
            };
            history = history.length >= MAX_HISTORY
              ? [...history.slice(1), point]
              : [...history, point];
          }
        }

        const newCstrHistory = { ...cstrHistory };
        for (const nodeId of cstrNodeIds) {
          const ns = engineStateRef.current.nodeStates[nodeId];
          if (!ns) continue;
          if (!newCstrHistory[nodeId]) newCstrHistory[nodeId] = [];
          const h = newCstrHistory[nodeId];
          if (h.length === 0 || h[h.length - 1].t < t) {
            h.push({ t, Ca: ns.C['A'] ?? 0, Cr: ns.C['R'] ?? 0, T: ns.T });
            if (h.length > MAX_HISTORY) h.shift();
          }
        }

        return { ...prev, t, history, cstrHistory: newCstrHistory };
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
    cstrStates: toCstrStateVecs(engineStateRef.current),
    cstrHistory: state.cstrHistory,
    disturbanceLog: state.disturbanceLog,
    play,
    pause,
    reset,
    setSpeed,
    applyDisturbance,
  };
}
