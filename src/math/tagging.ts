/**
 * F21 — ISA-5.1 equipment tag assignment (pure math, zero React/Zustand imports)
 *
 * Assigns ISA-style tags (R-101, E-101, V-101, P-101, K-101, FV-101) to equipment
 * nodes in topological order of the flowsheet graph.
 *
 * Tag classes:
 *   R-   Reactors      (cstr, pfr, fixedbed, batch, semibatch)
 *   E-   Exchangers    (hx)
 *   V-   Drums/vessels (flash)
 *   P-   Pumps         (pump)
 *   K-   Compressors   (comp)
 *   FV-  Control valves (valve)
 *
 * Nodes without a tag class (mixer, splitter, csplit, purge, feed, product)
 * are omitted from the returned map.
 */

const TAG_PREFIX: Partial<Record<string, string>> = {
  cstr:      'R',
  pfr:       'R',
  fixedbed:  'R',
  batch:     'R',
  semibatch: 'R',
  hx:        'E',
  flash:     'V',
  pump:      'P',
  comp:      'K',
  valve:     'FV',
};

const TAG_BASE = 101;

// ─── Kahn's algorithm — topological sort ────────────────────────────────────

function topoSort(
  nodeIds: string[],
  edges: { source: string; target: string }[],
): string[] {
  const nodeSet  = new Set(nodeIds);
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    children.set(id, []);
  }

  for (const { source, target } of edges) {
    if (!nodeSet.has(source) || !nodeSet.has(target)) continue;
    inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    children.get(source)!.push(target);
  }

  const queue: string[] = nodeIds.filter(id => (inDegree.get(id) ?? 0) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    order.push(curr);
    for (const child of children.get(curr) ?? []) {
      const deg = (inDegree.get(child) ?? 0) - 1;
      inDegree.set(child, deg);
      if (deg === 0) queue.push(child);
    }
  }

  // Append any remaining (cycle members) in original order — degrade gracefully
  for (const id of nodeIds) {
    if (!order.includes(id)) order.push(id);
  }

  return order;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Assign ISA equipment tags to equipment nodes in topological order.
 *
 * @param nodes  Array of { id, type } for every node in the flowsheet
 * @param edges  Array of { source, target } edge descriptors
 * @returns      Map of nodeId → ISA tag string (only equipment nodes included)
 */
export function assignTags(
  nodes: { id: string; type: string }[],
  edges: { source: string; target: string }[],
): Record<string, string> {
  const sorted   = topoSort(nodes.map(n => n.id), edges);
  const typeMap  = new Map(nodes.map(n => [n.id, n.type]));
  const counters: Record<string, number> = {};
  const tags:     Record<string, string> = {};

  for (const id of sorted) {
    const type   = typeMap.get(id) ?? '';
    const prefix = TAG_PREFIX[type];
    if (!prefix) continue;
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    tags[id] = `${prefix}-${TAG_BASE - 1 + counters[prefix]}`;
  }

  return tags;
}

/**
 * Return the display prefix for a given node type.
 * Used to show "R" chip on schematic nodes even outside PFD mode.
 */
export function tagPrefix(type: string): string | undefined {
  return TAG_PREFIX[type];
}
