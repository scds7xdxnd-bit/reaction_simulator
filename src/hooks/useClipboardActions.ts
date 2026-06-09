import { useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useSimulatorStore } from '../store/simulatorStore';

function getConnectedEdgesInternal(selectedNodes: Node[], allEdges: Edge[]): Edge[] {
  const selectedIds = new Set(selectedNodes.map(n => n.id));
  return allEdges.filter(
    e => selectedIds.has(e.source) && selectedIds.has(e.target)
  );
}

export function useClipboardActions() {
  const clipboard    = useSimulatorStore((s) => s.clipboard);
  const setClipboard = useSimulatorStore((s) => s.setClipboard);

  const storeNodes = useSimulatorStore((s) => s.nodes);
  const storeEdges = useSimulatorStore((s) => s.edges);
  const setNodes = useSimulatorStore((s) => s.setNodes);
  const setEdges = useSimulatorStore((s) => s.setEdges);
  const pushHistory = useSimulatorStore((s) => s.pushHistory);

  const copySelected = useCallback(() => {
    const sel = storeNodes.filter(n => n.selected && (n as any).deletable !== false);
    const internal = getConnectedEdgesInternal(sel, storeEdges);
    if (sel.length > 0) setClipboard({ nodes: sel, edges: internal });
  }, [storeNodes, storeEdges]);

  const paste = useCallback(() => {
    if (!clipboard) return;
    pushHistory();
    const idMap = new Map<string, string>();
    const timestamp = Date.now();
    const newNodes = clipboard.nodes.map((n, i) => {
      const newId = `${n.type}-paste-${timestamp}-${i}`;
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + 60, y: n.position.y + 60 },
        selected: true,
        data: { ...n.data },
      };
    });
    const newEdges: Edge[] = clipboard.edges.map((e, i) => ({
      ...e,
      id: `e-paste-${timestamp}-${i}`,
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
      selected: false,
    }));
    setNodes([...storeNodes.map(n => ({ ...n, selected: false, data: { ...n.data } })), ...newNodes]);
    setEdges([...storeEdges, ...newEdges]);
  }, [clipboard, storeNodes, storeEdges, setNodes, setEdges, pushHistory]);

  const cut = useCallback(() => {
    const sel = storeNodes.filter((n) => n.selected && (n as any).deletable !== false);
    if (sel.length === 0) return;
    const internal = getConnectedEdgesInternal(sel, storeEdges);
    setClipboard({ nodes: sel, edges: internal });
    pushHistory();
    const selIds = new Set(sel.map((n) => n.id));
    setNodes(storeNodes.filter((n) => !selIds.has(n.id)));
    setEdges(storeEdges.filter((e) => !selIds.has(e.source) && !selIds.has(e.target)));
  }, [storeNodes, storeEdges, setNodes, setEdges, pushHistory]);

  const duplicate = useCallback(() => {
    const sel = storeNodes.filter(n => n.selected && (n as any).deletable !== false);
    const internal = getConnectedEdgesInternal(sel, storeEdges);
    if (sel.length === 0) return;
    setClipboard({ nodes: sel, edges: internal });

    pushHistory();
    const idMap = new Map<string, string>();
    const timestamp = Date.now();
    const newNodes = sel.map((n, i) => {
      const newId = `${n.type}-dup-${timestamp}-${i}`;
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + 60, y: n.position.y + 60 },
        selected: true,
        data: { ...n.data },
      };
    });
    const newEdges: Edge[] = internal.map((e, i) => ({
      ...e,
      id: `e-dup-${timestamp}-${i}`,
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
      selected: false,
    }));
    setNodes([...storeNodes.map(n => ({ ...n, selected: false, data: { ...n.data } })), ...newNodes]);
    setEdges([...storeEdges, ...newEdges]);
  }, [storeNodes, storeEdges, setNodes, setEdges, pushHistory]);

  const pasteAt = useCallback((flowX: number, flowY: number) => {
    if (!clipboard) return;
    pushHistory();
    const centroidX = clipboard.nodes.reduce((s, n) => s + n.position.x, 0) / clipboard.nodes.length;
    const centroidY = clipboard.nodes.reduce((s, n) => s + n.position.y, 0) / clipboard.nodes.length;
    const dx = flowX - centroidX;
    const dy = flowY - centroidY;
    const idMap = new Map<string, string>();
    const timestamp = Date.now();
    const newNodes = clipboard.nodes.map((n, i) => {
      const newId = `${n.type}-paste-${timestamp}-${i}`;
      idMap.set(n.id, newId);
      return { ...n, id: newId, position: { x: n.position.x + dx, y: n.position.y + dy }, selected: true, data: { ...n.data } };
    });
    const newEdges: Edge[] = clipboard.edges.map((e, i) => ({
      ...e,
      id: `e-paste-${timestamp}-${i}`,
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
      selected: false,
    }));
    setNodes([...storeNodes.map(n => ({ ...n, selected: false, data: { ...n.data } })), ...newNodes]);
    setEdges([...storeEdges, ...newEdges]);
  }, [clipboard, storeNodes, storeEdges, setNodes, setEdges, pushHistory]);

  return { copySelected, paste, cut, duplicate, pasteAt };
}
