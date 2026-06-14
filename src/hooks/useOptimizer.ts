/**
 * F23 — Optimisation Engine hook
 *
 * Drives Nelder–Mead against the live flowsheet. Yields between chunks of 10
 * iterations via setTimeout(0) so React can re-render and the user sees the
 * convergence sparkline update live.
 *
 * Pure math lives in src/math/optimizer.ts. All React/Zustand contact is here.
 */
import { useState, useRef, useCallback } from 'react';
import { useSimulatorStore } from '../store/simulatorStore';
import { initSimplex, stepNM } from '../math/optimizer';
import { solveNetwork } from '../math/networkSolver';
import { computeSizing } from '../math/sizing';
import { costNode, calcEP } from '../math/costing';
import type { SimulationResult, SimulationParams } from '../types/reactor';
import type { Node, Edge } from '@xyflow/react';

// ─── Public types ─────────────────────────────────────────────────────────────

export type OptimObjective = 'Xa' | 'T_out' | 'Ca_out' | 'EP';
export type ConstraintOp   = '<=' | '>=';

export interface OptimVar {
  nodeId:  string;
  param:   string;
  label:   string;
  min:     number;
  max:     number;
  enabled: boolean;
}

export interface OptimConstraint {
  metric: OptimObjective;
  op:     ConstraintOp;
  value:  number;
  weight: number;
}

export interface OptimConfig {
  vars:        OptimVar[];
  objective:   OptimObjective;
  maximize:    boolean;
  constraints: OptimConstraint[];
  maxIter:     number;
}

export interface OptimProgress {
  iteration: number;
  fx:        number;      // raw minimized value (< 0 when maximizing)
  metric:    number;      // actual objective value (always in natural units)
}

export interface OptimApplied {
  x:       number[];       // best variable values
  fx:      number;         // raw minimized value
  metric:  number;         // actual objective value
  varLabels: string[];
}

// ─── Schema: which params are optimizable per node type ───────────────────────

export interface VarSchema {
  param: string;
  label: string;
  min:   number;
  max:   number;
}

export const OPTIM_SCHEMA: Record<string, VarSchema[]> = {
  cstr:     [{ param: 'tau',   label: 'τ (s)',          min: 1,    max: 10000 }],
  pfr:      [{ param: 'tau',   label: 'τ (s)',          min: 1,    max: 10000 }],
  semibatch:[{ param: 'tau',   label: 'τ (s)',          min: 10,   max: 10000 }],
  fixedbed: [{ param: 'W_cat', label: 'W_cat (kg)',     min: 0.1,  max: 1000  }],
  hx:       [{ param: 'T_c',   label: 'T_c (K)',        min: 200,  max: 600   }],
  pump:     [{ param: 'P_out', label: 'P_out (Pa)',     min: 2e5,  max: 1e7   }],
  comp:     [{ param: 'P_out', label: 'P_out (Pa)',     min: 2e5,  max: 1e7   }],
};

// ─── Metric extraction ────────────────────────────────────────────────────────

function extractObjectiveValue(
  result: SimulationResult,
  objective: OptimObjective,
  nodes: Node[],
  edges: Edge[],
): number {
  if (objective === 'Xa')    return result.finalConversion;
  if (objective === 'Ca_out') return result.segments[result.segments.length - 1]?.Ca_out ?? 0;
  if (objective === 'T_out')  return result.segments[result.segments.length - 1]?.T_out ?? 0;
  if (objective === 'EP') {
    const sizings = computeSizing(
      nodes.map(n => ({ id: n.id, type: n.type ?? '', data: n.data as Record<string, unknown> })),
      edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: (e as { sourceHandle?: string }).sourceHandle })),
      result.streams as Parameters<typeof computeSizing>[2],
    );
    const costs = Object.values(sizings).map(s => costNode(s));
    const ep = calcEP({
      costs,
      utilities: { heat_kW: 0, cool_kW: 0, power_kW: 0, steam_USD_GJ: 6, cooling_USD_GJ: 0.1, elec_USD_kWh: 0.08, op_hr_yr: 8000 },
      product_mol_s: 0, product_USD_mol: 0.01,
      feed_mol_s: 0, feed_USD_mol: 0.001,
      plant_life_yr: 10,
    });
    return ep.EP_USD_yr;
  }
  return 0;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOptimizer() {
  const nodes        = useSimulatorStore(s => s.nodes);
  const edges        = useSimulatorStore(s => s.edges);
  const params       = useSimulatorStore(s => s.params);
  const setNodes     = useSimulatorStore(s => s.setNodes);

  const [isRunning,  setIsRunning]  = useState(false);
  const [progress,   setProgress]   = useState<OptimProgress[]>([]);
  const [applied,    setApplied]    = useState<OptimApplied | null>(null);

  const cancelRef = useRef(false);

  // Build the objective function for a given config + snapshot of nodes/edges/params
  function buildObjective(
    config: OptimConfig,
    nodesSnap: Node[],
    edgesSnap: Edge[],
    paramsSnap: SimulationParams,
    activeVars: OptimVar[],
  ): (x: number[]) => number {
    return (x: number[]) => {
      // Apply variable values to nodes
      const modNodes = nodesSnap.map(n => {
        const updates: Record<string, number> = {};
        activeVars.forEach((v, i) => { if (v.nodeId === n.id) updates[v.param] = x[i]; });
        return Object.keys(updates).length > 0
          ? { ...n, data: { ...n.data, ...updates } }
          : n;
      });

      const result = solveNetwork(modNodes, edgesSnap, paramsSnap);
      if (!result || !result.converged) return Infinity;

      const metric = extractObjectiveValue(result, config.objective, modNodes, edgesSnap);
      const sign   = config.maximize ? -1 : 1;

      // Quadratic penalty for violated constraints
      let penalty = 0;
      for (const c of config.constraints) {
        const val = extractObjectiveValue(result, c.metric, modNodes, edgesSnap);
        const viol = c.op === '<=' ? Math.max(0, val - c.value) : Math.max(0, c.value - val);
        penalty += c.weight * viol * viol;
      }

      return sign * metric + penalty;
    };
  }

  const run = useCallback(async (config: OptimConfig) => {
    const activeVars = config.vars.filter(v => v.enabled);
    if (activeVars.length === 0) return;

    setIsRunning(true);
    setProgress([]);
    setApplied(null);
    cancelRef.current = false;

    // Snapshot store state at the start (avoids re-renders mutating the closure)
    const nodesSnap  = useSimulatorStore.getState().nodes;
    const edgesSnap  = useSimulatorStore.getState().edges;
    const paramsSnap = useSimulatorStore.getState().params;

    const f = buildObjective(config, nodesSnap, edgesSnap, paramsSnap, activeVars);

    const x0     = activeVars.map(v => (v.min + v.max) / 2);
    const bounds = activeVars.map(v => [v.min, v.max] as [number, number]);
    const opts   = {
      maxIter: config.maxIter, xtol: 1e-5, ftol: 1e-7,
      alpha: 1.0, gamma: 2.0, rho: 0.5, sigma: 0.5, initStep: 0.05,
    };

    let simplex  = initSimplex(x0, bounds, f, opts.initStep);
    let iter     = 0;
    const log: OptimProgress[] = [];

    const CHUNK = 10;

    while (iter < config.maxIter && !cancelRef.current) {
      for (let c = 0; c < CHUNK && iter < config.maxIter; c++) {
        simplex = stepNM(simplex, f, bounds, opts);
        iter++;
      }

      const best    = simplex[0];
      const fSpread = simplex[simplex.length - 1].fx - best.fx;
      // recover actual metric from negated storage
      const metricNow = config.maximize ? -best.fx : best.fx;
      log.push({ iteration: iter, fx: best.fx, metric: metricNow });
      setProgress([...log]);

      // Check convergence
      const diam = Math.sqrt(
        simplex[simplex.length - 1].x.reduce(
          (s, _, i) => s + (simplex[simplex.length - 1].x[i] - best.x[i]) ** 2, 0
        )
      );
      if (diam < opts.xtol && fSpread < opts.ftol) break;

      // Yield to React
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (!cancelRef.current) {
      const best       = simplex[0];
      const metricFinal = config.maximize ? -best.fx : best.fx;
      setApplied({
        x:         best.x,
        fx:        best.fx,
        metric:    metricFinal,
        varLabels: activeVars.map(v => v.label),
      });
    }

    setIsRunning(false);
  }, []);

  const cancel = useCallback(() => { cancelRef.current = true; }, []);

  const reset = useCallback(() => {
    cancelRef.current = true;
    setProgress([]);
    setApplied(null);
  }, []);

  const applyToFlowsheet = useCallback((config: OptimConfig) => {
    if (!applied) return;
    const activeVars = config.vars.filter(v => v.enabled);
    const newNodes = nodes.map(n => {
      const updates: Record<string, number> = {};
      activeVars.forEach((v, i) => { if (v.nodeId === n.id) updates[v.param] = applied.x[i]; });
      return Object.keys(updates).length > 0
        ? { ...n, data: { ...n.data, ...updates } }
        : n;
    });
    setNodes(newNodes);
  }, [applied, nodes, setNodes]);

  return { run, cancel, reset, applyToFlowsheet, isRunning, progress, applied };
}
