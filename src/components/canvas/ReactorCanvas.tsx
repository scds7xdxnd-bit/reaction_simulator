import { useCallback, useEffect } from 'react';
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
    type: 'smoothstep',
    style: { stroke: '#94a3b8', strokeWidth: 2 },
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
  },
  {
    id: 'cstr-0-pfr-0',
    source: 'cstr-0',
    target: 'pfr-0',
    type: 'smoothstep',
    style: { stroke: '#94a3b8', strokeWidth: 2 },
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
  },
  {
    id: 'pfr-0-product',
    source: 'pfr-0',
    target: 'product',
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

  const [nodes, setNodes, _onNodesChangeBase] = useNodesState<FlowNode>(initialNodes as FlowNode[]);
  const [edges, setEdges, _onEdgesChangeBase] = useEdgesState<Edge>(initialEdges);

  useEffect(() => {
    storeSetNodes(initialNodes);
    storeSetEdges(initialEdges);
  }, []);

  useSimulation();

  const syncStore = useCallback(
    (newNodes: typeof nodes, newEdges: Edge[]) => {
      storeSetNodes(newNodes);
      storeSetEdges(newEdges);
    },
    [storeSetNodes, storeSetEdges]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        syncStore(updated, edges);
        return updated;
      });
    },
    [setNodes, edges, syncStore]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds) as Edge[];
        syncStore(nodes, updated);
        return updated;
      });
    },
    [setEdges, nodes, syncStore]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceAlreadyConnected = edges.some(
        (e) => e.source === connection.source
      );
      if (sourceAlreadyConnected) return;

      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;

      const sourceX = sourceNode.position.x;
      const targetX = targetNode.position.x;
      if (sourceX > targetX) return;

      setEdges((eds) => {
        const newEdges = addEdge(connection, eds) as Edge[];
        syncStore(nodes, newEdges);
        return newEdges;
      });
    },
    [edges, nodes, setEdges, syncStore]
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === newConnection.source);
      const targetNode = nodes.find((n) => n.id === newConnection.target);
      if (!sourceNode || !targetNode) return;
      if (sourceNode.position.x > targetNode.position.x) return;

      setEdges((eds) => {
        const updated = reconnectEdge(oldEdge, newConnection, eds) as Edge[];
        syncStore(nodes, updated);
        return updated;
      });
    },
    [nodes, setEdges, syncStore]
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
        | undefined;
      if (!type) return;

      const reactFlowBounds = (event.target as HTMLElement)
        .closest('.react-flow')
        ?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: event.clientX - reactFlowBounds.left - 75,
        y: event.clientY - reactFlowBounds.top - 45,
      };

      addReactor(type, position);
      const latestNodes = useSimulatorStore.getState().nodes;
      setNodes(latestNodes as FlowNode[]);
    },
    [addReactor, setNodes]
  );

  const onDelete = useCallback(
    (deletedNodes: { id: string }[]) => {
      setNodes((nds) => {
        const updated = nds.filter(
          (n) =>
            !deletedNodes.some((dn) => dn.id === n.id) ||
            n.id === 'feed' ||
            n.id === 'product'
        );
        syncStore(updated, edges);
        return updated;
      });

      setEdges((eds) => {
        const deletedIds = new Set(deletedNodes.map((n) => n.id));
        const updated = eds.filter(
          (e) => !deletedIds.has(e.source) && !deletedIds.has(e.target)
        );
        return updated;
      });
    },
    [edges, setNodes, setEdges, syncStore]
  );

  return (
    <div className="w-full h-full bg-[#e8eeff]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        edgesReconnectable={true}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodesDelete={onDelete}
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
            return '#6b7280';
          }}
        />
      </ReactFlow>
    </div>
  );
}
