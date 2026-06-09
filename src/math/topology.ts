import type { Node, Edge } from '@xyflow/react';

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

export function reachableFrom(startId: string, edges: Edge[]): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [startId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    for (const e of edges) {
      if (e.source === curr && !visited.has(e.target)) {
        queue.push(e.target);
      }
    }
  }
  return visited;
}

export function reachableTo(endId: string, edges: Edge[]): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [endId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    for (const e of edges) {
      if (e.target === curr && !visited.has(e.source)) {
        queue.push(e.source);
      }
    }
  }
  return visited;
}
