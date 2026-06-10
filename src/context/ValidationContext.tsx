import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { validateNodePaths, type NodeIssue } from '../math/validation';

interface ValidationContextValue {
  issueMap: Map<string, NodeIssue>;
}

const ValidationCtx = createContext<ValidationContextValue>({
  issueMap: new Map(),
});

export function ValidationProvider({
  nodes,
  edges,
  children,
}: {
  nodes: Node[];
  edges: Edge[];
  children: ReactNode;
}) {
  const issueMap = useMemo(() => {
    const issues = validateNodePaths(nodes, edges);
    const map = new Map<string, NodeIssue>();
    for (const issue of issues) {
      map.set(issue.nodeId, issue);
    }
    return map;
  }, [nodes, edges]);

  return (
    <ValidationCtx.Provider value={{ issueMap }}>
      {children}
    </ValidationCtx.Provider>
  );
}

export function useNodeIssues(nodeId: string): { isOffPath: boolean } {
  const { issueMap } = useContext(ValidationCtx);
  const issue = issueMap.get(nodeId);
  return { isOffPath: issue?.offPath ?? false };
}
