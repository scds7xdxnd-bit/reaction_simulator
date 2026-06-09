import type { SimulationParams } from '../types/reactor';
import type { Node, Edge } from '@xyflow/react';

export interface ValidationIssue {
  level: 'error' | 'warning';
  field?: string;
  message: string;
}

export function validateParams(params: SimulationParams): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (params.k <= 0)
    issues.push({ level: 'error', field: 'k', message: 'Rate constant k must be > 0' });

  if (params.reactionMode !== 'single' && params.k2 <= 0)
    issues.push({ level: 'error', field: 'k2', message: 'Rate constant k₂ must be > 0 for multi-reaction mode' });

  if (params.Ca0 <= 0)
    issues.push({ level: 'error', field: 'Ca0', message: 'Feed concentration Cₐ₀ must be > 0' });

  if (params.rho_Cp <= 0)
    issues.push({ level: 'error', field: 'rho_Cp', message: 'ρCₚ must be > 0' });

  if (params.Ea < 0)
    issues.push({ level: 'warning', field: 'Ea', message: 'Activation energy Eₐ should be ≥ 0' });

  if (params.T_feed < 200 || params.T_feed > 900)
    issues.push({ level: 'warning', field: 'T_feed', message: 'Feed temperature outside physical range [200, 900] K' });

  return issues;
}

export function validateTopology(nodes: Node[], edges: Edge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const feedCount    = nodes.filter((n) => n.type === 'feed').length;
  const productCount = nodes.filter((n) => n.type === 'product').length;

  if (feedCount === 0)
    issues.push({ level: 'error', field: 'topology', message: 'Flowsheet requires a Feed node' });
  if (productCount === 0)
    issues.push({ level: 'error', field: 'topology', message: 'Flowsheet requires a Product node' });

  const reactorIds   = new Set(nodes.filter((n) => n.type === 'cstr' || n.type === 'pfr' || n.type === 'batch').map((n) => n.id));
  const connectedIds = new Set([...edges.map((e) => e.source), ...edges.map((e) => e.target)]);
  const orphanCount  = [...reactorIds].filter((id) => !connectedIds.has(id)).length;

  if (orphanCount > 0)
    issues.push({ level: 'warning', field: 'topology',
      message: `${orphanCount} reactor(s) are not connected to any stream` });

  return issues;
}
