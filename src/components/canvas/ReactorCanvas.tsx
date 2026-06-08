import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  reconnectEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  BackgroundVariant,
  type Connection,
  type Edge,
  type Node as FlowNode,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CSTRNode from './CSTRNode';
import PFRNode from './PFRNode';
import FeedNode from './FeedNode';
import ProductNode from './ProductNode';
import MixerNode from './MixerNode';
import SplitterNode from './SplitterNode';
import { useSimulatorStore } from '../../store/simulatorStore';
import { useSimulation } from '../../hooks/useSimulation';

const initialNodes = [
  {
    id: 'feed',
    type: 'feed',
    position: { x: 60, y: 230 },
    data: {},
    draggable: false,
    deletable: false,
  },
  {
    id: 'cstr-0',
    type: 'cstr',
    position: { x: 230, y: 220 },
    data: { reactorType: 'CSTR' as const, label: 'CSTR-1', tau: 2.0 },
  },
  {
    id: 'pfr-0',
    type: 'pfr',
    position: { x: 470, y: 220 },
    data: { reactorType: 'PFR' as const, label: 'PFR-1', tau: 2.0 },
  },
  {
    id: 'product',
    type: 'product',
    position: { x: 720, y: 230 },
    data: {},
    draggable: false,
    deletable: false,
  },
];

const initialEdges: Edge[] = [
  {
    id: 'feed-cstr-0',
    source: 'feed',
    target: 'cstr-0',
    sourceHandle: 'out',
    targetHandle: 'in',
    type: 'smoothstep',
    style: { stroke: '#94a3b8', strokeWidth: 2 },
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
  },
  {
    id: 'cstr-0-pfr-0',
    source: 'cstr-0',
    target: 'pfr-0',
    sourceHandle: 'out',
    targetHandle: 'in',
    type: 'smoothstep',
    style: { stroke: '#94a3b8', strokeWidth: 2 },
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
  },
  {
    id: 'pfr-0-product',
    source: 'pfr-0',
    target: 'product',
    sourceHandle: 'out',
    targetHandle: 'in',
    type: 'smoothstep',
    style: { stroke: '#94a3b8', strokeWidth: 2 },
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
  },
];

const nodeTypes = {
  cstr: CSTRNode,
  pfr: PFRNode,
  feed: FeedNode,
  product: ProductNode,
  mixer: MixerNode,
  splitter: SplitterNode,
};

const defaultEdgeOptions: Partial<Edge> = {
  type: 'smoothstep',
  style: { stroke: '#94a3b8', strokeWidth: 2 },
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
};

export default function ReactorCanvas() {
  const storeSetNodes = useSimulatorStore((s) => s.setNodes);
  const storeSetEdges = useSimulatorStore((s) => s.setEdges);
  const addReactor = useSimulatorStore((s) => s.addReactor);
  const addUnit = useSimulatorStore((s) => s.addUnit);
  const result = useSimulatorStore((s) => s.result);
  const pushHistory = useSimulatorStore((s) => s.pushHistory);
  const setSelectedNodeId = useSimulatorStore((s) => s.setSelectedNodeId);

  const [nodes, setNodes, _onNodesChangeBase] = useNodesState<FlowNode>(initialNodes as FlowNode[]);
  const [edges, setEdges, _onEdgesChangeBase] = useEdgesState<Edge>(initialEdges);

  useEffect(() => {
    storeSetNodes(initialNodes);
    storeSetEdges(initialEdges);
  }, []);

  useSimulation();

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds) as Edge[]);
    },
    [setEdges]
  );

  useEffect(() => {
    storeSetNodes(nodes);
  }, [nodes, storeSetNodes]);

  useEffect(() => {
    storeSetEdges(edges);
  }, [edges, storeSetEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;

      if (targetNode.type === 'mixer') {
        const incomingCount = edges.filter(
          (e) => e.target === targetNode.id
        ).length;
        if (incomingCount >= 2) return;
      }

      if (sourceNode.type === 'splitter') {
        const outgoingCount = edges.filter(
          (e) => e.source === sourceNode.id
        ).length;
        if (outgoingCount >= 2) return;
      }

      pushHistory();
      setEdges((eds) => addEdge(connection, eds) as Edge[]);
    },
    [edges, nodes, setEdges, pushHistory]
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      pushHistory();
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds) as Edge[]);
    },
    [setEdges, pushHistory]
  );

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
        | 'Mixer'
        | 'Splitter'
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

      if (type === 'CSTR' || type === 'PFR') {
        addReactor(type, position);
      } else {
        addUnit(type, position);
      }

      const latestNodes = useSimulatorStore.getState().nodes;
      setNodes(latestNodes as FlowNode[]);
    },
    [addReactor, addUnit, setNodes]
  );

  const onDelete = useCallback(
    (deletedNodes: { id: string }[]) => {
      const deletedIds = new Set(deletedNodes.map((n) => n.id));
      pushHistory();
      setNodes((nds) =>
        nds.filter(
          (n) =>
            !deletedIds.has(n.id) ||
            n.id === 'feed' ||
            n.id === 'product'
        )
      );
      setEdges((eds) =>
        eds.filter(
          (e) => !deletedIds.has(e.source) && !deletedIds.has(e.target)
        )
      );
    },
    [setNodes, setEdges, pushHistory]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: FlowNode) => {
      if (node.type === 'cstr' || node.type === 'pfr') {
        setSelectedNodeId(node.id);
      }
    },
    [setSelectedNodeId]
  );

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
      };
    });
  // recycleIdsKey is a stable string; avoids recompute on every new result object
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, recycleIdsKey]);

  return (
    <div className="w-full h-full bg-[#e8eeff]">
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        edgesReconnectable={true}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodesDelete={onDelete}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        deleteKeyCode={['Delete', 'Backspace']}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} color="#c7d2e8" />
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
            if (node.type === 'feed') return '#6b7280';
            if (node.type === 'product') return '#16a34a';
            if (node.type === 'mixer') return '#059669';
            if (node.type === 'splitter') return '#7c3aed';
            return '#6b7280';
          }}
        />
      </ReactFlow>
    </div>
  );
}
