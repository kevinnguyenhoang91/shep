'use client';

import { useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Position,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { layoutWithDagre } from '@/lib/layout-with-dagre';

export interface AgentGraphDescriptor {
  agentType: string;
  nodes: { id: string; label: string; description?: string }[];
  edges: { from: string; to: string; label?: string }[];
}

export interface AgentGraphViewProps {
  graph: AgentGraphDescriptor | null;
}

/**
 * Read-only LangGraph visualization for an agent type. v1 reads from a
 * static descriptor map (see `agent-graph-descriptors.ts`). Editing is
 * out of scope per FR-38.
 */
export function AgentGraphView({ graph }: AgentGraphViewProps) {
  if (!graph) {
    return (
      <p
        className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm"
        data-testid="agent-graph-empty"
      >
        No graph descriptor registered for this agent yet.
      </p>
    );
  }

  return (
    <div
      className="bg-muted/20 h-[480px] w-full overflow-hidden rounded-lg border"
      data-testid="agent-graph-view"
    >
      <ReactFlowProvider>
        <AgentGraphInner graph={graph} />
      </ReactFlowProvider>
    </div>
  );
}

function AgentGraphInner({ graph }: { graph: AgentGraphDescriptor }) {
  const { nodes, edges } = useMemo(() => buildGraph(graph), [graph]);
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

function buildGraph(graph: AgentGraphDescriptor): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.nodes.map((n) => ({
    id: n.id,
    type: 'default',
    position: { x: 0, y: 0 },
    data: {
      label: (
        <div className="flex flex-col items-start gap-0.5 px-2 py-1.5 text-left">
          <span className="text-xs font-semibold">{n.label}</span>
          {n.description ? (
            <span className="text-muted-foreground text-[10px]">{n.description}</span>
          ) : null}
        </div>
      ),
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));

  const edges: Edge[] = graph.edges.map((e, idx) => ({
    id: `e-${idx}`,
    source: e.from,
    target: e.to,
    type: 'smoothstep',
    label: e.label,
    animated: false,
  }));

  const laidOut = layoutWithDagre(nodes, edges, {
    direction: 'LR',
    nodeSize: { width: 220, height: 60 },
    nodesep: 30,
    ranksep: 80,
  });
  return { nodes: laidOut.nodes, edges: laidOut.edges };
}
