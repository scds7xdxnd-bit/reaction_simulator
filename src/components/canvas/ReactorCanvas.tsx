import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  reconnectEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  BackgroundVariant,
  PanOnScrollMode,
  SelectionMode,
  type Connection,
  type Edge,
  type Node as FlowNode,
  type NodeChange,
  type EdgeChange,
  type Viewport,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CSTRNode from './CSTRNode';
import PFRNode from './PFRNode';
import BatchNode from './BatchNode';
import SemibatchNode from './SemibatchNode';
import FixedBedNode from './FixedBedNode';
import FeedNode from './FeedNode';
import ProductNode from './ProductNode';
import MixerNode from './MixerNode';
import SplitterNode from './SplitterNode';
import HXNode from './HXNode';
import CSplitNode from './CSplitNode';
import FlashNode from './FlashNode';
import PurgeNode from './PurgeNode';
import PumpNode from './PumpNode';
import CompNode from './CompNode';
import ValveNode from './ValveNode';
import ContextMenu from './ContextMenu';
import CanvasContextMenu from './CanvasContextMenu';
import CanvasAddMenu from './CanvasAddMenu';
import { ValidationProvider } from '../../context/ValidationContext';
import { useSimulatorStore } from '../../store/simulatorStore';
import { useSimulation } from '../../hooks/useSimulation';
import { useClipboardActions } from '../../hooks/useClipboardActions';

type GhostNodeType = 'CSTR' | 'PFR' | 'Batch' | 'Mixer' | 'Splitter' | 'HX' | 'Product';
const GHOST_TYPES: GhostNodeType[] = ['CSTR', 'PFR', 'Batch', 'Mixer', 'Splitter', 'HX', 'Product'];

const nodeTypes = {
  cstr: CSTRNode,
  pfr: PFRNode,
  batch: BatchNode,
  semibatch: SemibatchNode,
  fixedbed: FixedBedNode,
  feed: FeedNode,
  product: ProductNode,
  mixer: MixerNode,
  splitter: SplitterNode,
  hx: HXNode,
  csplit: CSplitNode,
  flash: FlashNode,
  purge: PurgeNode,
  pump: PumpNode,
  comp: CompNode,
  valve: ValveNode,
};

function MiniMapNode({ x, y, width, height, color }: { x: number; y: number; width: number; height: number; color?: string }) {
  return (
    <rect
      x={x}
      y={y}
      rx={3}
      ry={3}
      width={width}
      height={height}
      style={{ fill: color, fillOpacity: 0.9 }}
    />
  );
}

const defaultEdgeOptions: Partial<Edge> = {
  type: 'smoothstep',
  style: { stroke: '#94a3b8', strokeWidth: 2 },
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
  interactionWidth: 20,
};

export default function ReactorCanvas() {
  const storeSetNodes = useSimulatorStore((s) => s.setNodes);
  const storeSetEdges = useSimulatorStore((s) => s.setEdges);
  const addReactor = useSimulatorStore((s) => s.addReactor);
  const addUnit = useSimulatorStore((s) => s.addUnit);
  const addFeedNode    = useSimulatorStore((s) => s.addFeedNode);
  const addProductNode = useSimulatorStore((s) => s.addProductNode);
  const result = useSimulatorStore((s) => s.result);
  const pushHistory = useSimulatorStore((s) => s.pushHistory);
  const setSelectedNodeId = useSimulatorStore((s) => s.setSelectedNodeId);
  const openMenu  = useSimulatorStore((s) => s.openMenu);
  const closeMenu = useSimulatorStore((s) => s.closeMenu);
  const openCanvasMenu  = useSimulatorStore((s) => s.openCanvasMenu);
  const closeCanvasMenu = useSimulatorStore((s) => s.closeCanvasMenu);

  const nodes = useSimulatorStore((s) => s.nodes) as FlowNode[];
  const edges = useSimulatorStore((s) => s.edges);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef  = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [addMenu, setAddMenu] = useState<{ screenX: number; screenY: number; flowPos: { x: number; y: number } } | null>(null);

  // Chain-connect state
  const [isChaining, setIsChaining] = useState(false);
  const chainRef    = useRef<{ sourceId: string; ghostType: GhostNodeType } | null>(null);
  const [ghostPos,  setGhostPos]  = useState({ x: 0, y: 0 });
  const [ghostType, setGhostType] = useState<GhostNodeType>('CSTR');
  const chainTypeIdx = useRef(0);

  const clipboard = useSimulatorStore((s) => s.clipboard);
  const { pasteAt } = useClipboardActions();

  useSimulation();

  // Capture-phase mousedown: intercept Ctrl+handle to start chain-connect
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as Element;
      const handle = target.closest('.react-flow__handle');

      // Ctrl+Shift on pane: place Feed then chain
      if (e.ctrlKey && e.shiftKey && !handle) {
        if (!target.closest('.react-flow__pane')) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = el.getBoundingClientRect();
        const { x: vx, y: vy, zoom } = viewportRef.current;
        const pos = {
          x: (e.clientX - rect.left - vx) / zoom - 35,
          y: (e.clientY - rect.top  - vy) / zoom - 35,
        };
        useSimulatorStore.getState().addFeedNode(pos);
        const added = useSimulatorStore.getState().nodes.find(n => n.selected && n.type === 'feed');
        if (!added) return;
        chainTypeIdx.current = 0;
        chainRef.current = { sourceId: added.id, ghostType: GHOST_TYPES[0] };
        setGhostPos({ x: e.clientX, y: e.clientY });
        setGhostType(GHOST_TYPES[0]);
        setIsChaining(true);
        return;
      }

      if (!e.ctrlKey || !handle) return;
      const nodeEl = handle.closest('[data-id]');
      if (!nodeEl) return;
      const nodeId = nodeEl.getAttribute('data-id');
      if (!nodeId) return;

      e.preventDefault();
      e.stopPropagation();
      chainTypeIdx.current = 0;
      chainRef.current = { sourceId: nodeId, ghostType: GHOST_TYPES[0] };
      setGhostPos({ x: e.clientX, y: e.clientY });
      setGhostType(GHOST_TYPES[0]);
      setIsChaining(true);
    };

    el.addEventListener('mousedown', handleMouseDown, true);
    return () => el.removeEventListener('mousedown', handleMouseDown, true);
  }, []); // refs only; no reactive deps needed

  // Chain mode: track mouse and handle commit/cancel
  useEffect(() => {
    if (!isChaining) return;

    const onMove = (e: MouseEvent) => setGhostPos({ x: e.clientX, y: e.clientY });

    const onUp = (e: MouseEvent) => {
      const cs = chainRef.current;
      setIsChaining(false);
      chainRef.current = null;
      if (!cs || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const { x: vx, y: vy, zoom } = viewportRef.current;
      const pos = {
        x: (e.clientX - rect.left - vx) / zoom - 40,
        y: (e.clientY - rect.top  - vy) / zoom - 25,
      };

      const store = useSimulatorStore.getState();
      const type = cs.ghostType;
      if (type === 'CSTR' || type === 'PFR' || type === 'Batch') store.addReactor(type, pos);
      else if (type === 'Mixer' || type === 'Splitter' || type === 'HX') store.addUnit(type as 'Mixer' | 'Splitter' | 'HX', pos);
      else store.addProductNode(pos);

      const newNode = useSimulatorStore.getState().nodes.find(n => n.selected);
      if (newNode) {
        const currEdges = useSimulatorStore.getState().edges;
        store.setEdges(addEdge({ source: cs.sourceId, target: newNode.id } as Connection, currEdges) as Edge[]);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsChaining(false);
        chainRef.current = null;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        chainTypeIdx.current = (chainTypeIdx.current + 1) % GHOST_TYPES.length;
        const nt = GHOST_TYPES[chainTypeIdx.current];
        if (chainRef.current) chainRef.current = { ...chainRef.current, ghostType: nt };
        setGhostType(nt);
      }
    };

    const onWheel = (e: WheelEvent) => {
      const dir = e.deltaY > 0 ? 1 : -1;
      chainTypeIdx.current = ((chainTypeIdx.current + dir) % GHOST_TYPES.length + GHOST_TYPES.length) % GHOST_TYPES.length;
      const nt = GHOST_TYPES[chainTypeIdx.current];
      if (chainRef.current) chainRef.current = { ...chainRef.current, ghostType: nt };
      setGhostType(nt);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    document.addEventListener('keydown',   onKey, true);
    document.addEventListener('wheel',     onWheel);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      document.removeEventListener('keydown',   onKey, true);
      document.removeEventListener('wheel',     onWheel);
    };
  }, [isChaining]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const latest = useSimulatorStore.getState().nodes as FlowNode[];
    storeSetNodes(applyNodeChanges(changes, latest) as FlowNode[]);
  }, [storeSetNodes]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const latest = useSimulatorStore.getState().edges;
    storeSetEdges(applyEdgeChanges(changes, latest) as Edge[]);
  }, [storeSetEdges]);

  const onConnect = useCallback((connection: Connection) => {
    const { nodes: n, edges: e } = useSimulatorStore.getState();
    const sourceNode = n.find((nd) => nd.id === connection.source);
    const targetNode = n.find((nd) => nd.id === connection.target);
    if (!sourceNode || !targetNode) return;
    if (targetNode.type === 'mixer' && e.filter((ed) => ed.target === targetNode.id).length >= 2) return;
    if (sourceNode.type === 'splitter' && e.filter((ed) => ed.source === sourceNode.id).length >= 2) return;
    pushHistory();
    storeSetEdges(addEdge(connection, e) as Edge[]);
  }, [pushHistory, storeSetEdges]);

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    pushHistory();
    storeSetEdges(reconnectEdge(oldEdge, newConnection, useSimulatorStore.getState().edges) as Edge[]);
  }, [pushHistory, storeSetEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow') as
        | 'CSTR'
        | 'PFR'
        | 'Batch'
        | 'Mixer'
        | 'Splitter'
        | 'HX'
        | 'CSplit'
        | 'Flash'
        | 'Purge'
        | 'Pump'
        | 'Comp'
        | 'Valve'
        | 'Feed'
        | 'Product'
        | undefined;
      if (!type) return;

      const reactFlowBounds = (event.target as HTMLElement)
        .closest('.react-flow')
        ?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: event.clientX - reactFlowBounds.left - 55,
        y: event.clientY - reactFlowBounds.top - 40,
      };

      if (type === 'CSTR' || type === 'PFR' || type === 'Batch') {
        addReactor(type, position);
      } else if (type === 'Feed') {
        addFeedNode(position);
      } else if (type === 'Product') {
        addProductNode(position);
      } else {
        addUnit(type, position);
      }
    },
    [addReactor, addUnit, addFeedNode, addProductNode]
  );

  const onDelete = useCallback((deletedNodes: { id: string }[]) => {
    const deletedIds = new Set(deletedNodes.map((n) => n.id));
    const { nodes: n, edges: e } = useSimulatorStore.getState();
    pushHistory();
    storeSetNodes(n.filter((nd) => !deletedIds.has(nd.id) || nd.id === 'feed' || nd.id === 'product'));
    storeSetEdges(e.filter((ed) => !deletedIds.has(ed.source) && !deletedIds.has(ed.target)));
  }, [pushHistory, storeSetNodes, storeSetEdges]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: FlowNode) => {
      if (node.type === 'cstr' || node.type === 'pfr' || node.type === 'batch') {
        setSelectedNodeId(node.id);
      }
    },
    [setSelectedNodeId]
  );

  const onMove = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      viewportRef.current = viewport;
    },
    []
  );

  const onInit = useCallback((instance: any) => {
    viewportRef.current = instance.getViewport();
  }, []);

  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const { x: vx, y: vy, zoom } = viewportRef.current;
    const flowX = (event.clientX - rect.left - vx) / zoom;
    const flowY = (event.clientY - rect.top - vy) / zoom;
    closeMenu();
    openCanvasMenu(event.clientX, event.clientY, flowX, flowY);
  }, [closeMenu, openCanvasMenu]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: FlowNode) => {
      event.preventDefault();
      closeCanvasMenu();
      const { nodes: current } = useSimulatorStore.getState();
      storeSetNodes(
        current.map((n) => ({ ...n, selected: n.id === node.id, data: { ...n.data } }))
      );
      openMenu(event.clientX, event.clientY, node.id);
    },
    [storeSetNodes, openMenu, closeCanvasMenu]
  );

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    closeMenu();
    closeCanvasMenu();
    const rect = containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const { x: vx, y: vy, zoom } = viewportRef.current;
    const flowX = (event.clientX - rect.left - vx) / zoom;
    const flowY = (event.clientY - rect.top - vy) / zoom;
    setAddMenu({ screenX: event.clientX, screenY: event.clientY, flowPos: { x: flowX, y: flowY } });
  }, [closeMenu, closeCanvasMenu]);

  // Recycle edge styling is DISPLAY-ONLY — never written back to `edges` state.
  // Keeping style out of the base `edges` state breaks the feedback loop:
  //   result → setEdges → storeSetEdges → simulation → result → ...
  const recycleIdsKey = result?.recycleEdgeIds.join(',') ?? '';
  const displayEdges = useMemo(() => {
    const recycleIds = new Set(result?.recycleEdgeIds ?? []);

    // Count outgoing edges per non-splitter source for fraction chips (E9.2)
    const outCount = new Map<string, number>();
    for (const e of edges) {
      if (nodes.find(n => n.id === e.source)?.type !== 'splitter') {
        outCount.set(e.source, (outCount.get(e.source) ?? 0) + 1);
      }
    }
    const fracLabel = (n: number) => n === 2 ? '½' : n === 3 ? '⅓' : `1/${n}`;

    return edges.map((e) => {
      const isRecycle = recycleIds.has(e.id);
      const n = outCount.get(e.source) ?? 1;
      const showFrac = !isRecycle && n > 1;
      return {
        ...e,
        style: { stroke: isRecycle ? '#7c3aed' : '#94a3b8', strokeWidth: 2 },
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: isRecycle ? '#7c3aed' : '#94a3b8' },
        label: isRecycle ? '♻' : (showFrac ? fracLabel(n) : undefined),
        labelStyle: isRecycle
          ? { fontSize: 12, fill: '#7c3aed', fontWeight: 700, filter: 'drop-shadow(0 0 2px #fff)' }
          : showFrac ? { fontSize: 9, fontWeight: 700, fill: '#6b7280' } : undefined,
        labelBgStyle: isRecycle
          ? { fill: '#ffffff', fillOpacity: 0.85 }
          : showFrac ? { fill: '#f1f5f9', fillOpacity: 0.9 } : undefined,
        labelBgPadding: (showFrac || isRecycle) ? [3, 5] as [number, number] : undefined,
        labelBgBorderRadius: (showFrac || isRecycle) ? 4 : undefined,
        labelShowBg: showFrac || isRecycle,
      };
    });
  // recycleIdsKey is a stable string; avoids recompute on every new result object
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, recycleIdsKey, nodes]);

  return (
    <ValidationProvider nodes={nodes} edges={edges}>
    <div ref={containerRef} className="w-full h-full" style={{ background: 'var(--canvas-bg)' }}>
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        edgesFocusable={true}
        edgesReconnectable={false}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodesDelete={onDelete}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onMove={onMove}
        onInit={onInit}
        onPaneContextMenu={onPaneContextMenu}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        deleteKeyCode={['Delete', 'Backspace']}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} color="var(--canvas-dot)" />
        <Controls
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #dde3f0',
            borderRadius: 8,
          }}
        />
        <MiniMap
          style={{
            height: 100,
            backgroundColor: '#e8eeff',
            maskColor: '#dde3f080',
          } as React.CSSProperties}
          nodeColor={(node) => {
            if (node.type === 'cstr') return '#2563eb';
            if (node.type === 'pfr') return '#d97706';
            if (node.type === 'batch') return '#be123c';
            if (node.type === 'feed') return '#6b7280';
            if (node.type === 'product') return '#16a34a';
            if (node.type === 'mixer') return '#059669';
            if (node.type === 'splitter') return '#7c3aed';
            if (node.type === 'hx') return '#dc2626';
            if (node.type === 'csplit') return '#0891b2';
            if (node.type === 'flash') return '#0d9488';
            if (node.type === 'purge') return '#ea580c';
            if (node.type === 'pump')  return '#1d4ed8';
            if (node.type === 'comp')  return '#7c3aed';
            if (node.type === 'valve') return '#b45309';
            return '#6b7280';
          }}
          nodeComponent={MiniMapNode}
        />
      </ReactFlow>
      <ContextMenu />
      <CanvasContextMenu />
      {isChaining && (
        <div
          className="chain-ghost"
          style={{ left: ghostPos.x - 40, top: ghostPos.y - 25 }}
        >
          {ghostType}
        </div>
      )}
      {addMenu && (
        <CanvasAddMenu
          screenX={addMenu.screenX}
          screenY={addMenu.screenY}
          flowPos={addMenu.flowPos}
          clipboard={clipboard}
          onClose={() => setAddMenu(null)}
          onAddReactor={(type, pos) => addReactor(type as Parameters<typeof addReactor>[0], pos)}
          onAddUnit={(type, pos) => addUnit(type as Parameters<typeof addUnit>[0], pos)}
          onAddFeed={addFeedNode}
          onAddProduct={addProductNode}
          onPasteAt={(fx, fy) => pasteAt(fx, fy)}
        />
      )}
    </div>
    </ValidationProvider>
  );
}
