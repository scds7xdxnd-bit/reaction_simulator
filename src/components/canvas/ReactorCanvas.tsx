import { useCallback, useMemo, useRef } from 'react';
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
import ContextMenu from './ContextMenu';
import CanvasContextMenu from './CanvasContextMenu';
import { ValidationProvider } from '../../context/ValidationContext';
import { useSimulatorStore } from '../../store/simulatorStore';
import { useSimulation } from '../../hooks/useSimulation';

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

  useSimulation();

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

  const onPaneClick = useCallback(() => {
    closeMenu();
    closeCanvasMenu();
  }, [closeMenu, closeCanvasMenu]);

  // Recycle edge styling is DISPLAY-ONLY — never written back to `edges` state.
  // Keeping style out of the base `edges` state breaks the feedback loop:
  //   result → setEdges → storeSetEdges → simulation → result → ...
  const recycleIdsKey = result?.recycleEdgeIds.join(',') ?? '';
  const displayEdges = useMemo(() => {
    const recycleIds = new Set(result?.recycleEdgeIds ?? []);
    return edges.map((e) => {
      const isRecycle = recycleIds.has(e.id);
      return {
        ...e,
        style: {
          stroke: isRecycle ? '#7c3aed' : '#94a3b8',
          strokeWidth: 2,
        },
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isRecycle ? '#7c3aed' : '#94a3b8',
        },
        label: isRecycle ? '♻' : undefined,
        labelStyle: isRecycle ? {
          fontSize: 12,
          fill: '#7c3aed',
          fontWeight: 700,
          filter: 'drop-shadow(0 0 2px #fff)',
        } : undefined,
        labelBgStyle: isRecycle ? {
          fill: '#ffffff',
          fillOpacity: 0.85,
        } : undefined,
      };
    });
  // recycleIdsKey is a stable string; avoids recompute on every new result object
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, recycleIdsKey]);

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
            return '#6b7280';
          }}
          nodeComponent={MiniMapNode}
        />
      </ReactFlow>
      <ContextMenu />
      <CanvasContextMenu />
    </div>
    </ValidationProvider>
  );
}
