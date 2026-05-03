/**
 * Built-in Graph Registry (spec 093, FR-38 ext)
 *
 * Static catalog of editable LangGraph descriptors exposed to the agent
 * editor. The runtime resolver returns the override descriptor when one
 * exists, otherwise the snapshot here.
 *
 * Keeping the registry centralized means the agent editor and the runtime
 * agree on which agents have an editable graph and what the bundled shape
 * looks like — nothing dynamic, nothing inferred.
 *
 * v1 ships hard-coded descriptions of each agent's LangGraph node/edge
 * topology. The runtime LangGraph state machines under
 * `infrastructure/services/agents/<agent>/` are the source of truth — these
 * descriptors are a documentation surface that the editor lets users
 * customise (e.g. to add advisory waypoints or rename steps in the UI).
 */

export interface BuiltinGraphNode {
  id: string;
  label: string;
  description?: string;
}

export interface BuiltinGraphEdge {
  from: string;
  to: string;
  label?: string;
}

export interface BuiltinGraphDescriptor {
  agentType: string;
  nodes: BuiltinGraphNode[];
  edges: BuiltinGraphEdge[];
}

const FEATURE_AGENT_GRAPH: BuiltinGraphDescriptor = {
  agentType: 'feature-agent',
  nodes: [
    { id: 'analyze', label: 'Analyze', description: 'survey codebase' },
    { id: 'requirements', label: 'Requirements', description: 'spec yaml' },
    { id: 'research', label: 'Research', description: 'find affected modules' },
    { id: 'plan', label: 'Plan', description: 'TDD-ordered phases' },
    { id: 'implement', label: 'Implement', description: 'commit, lint, test' },
    { id: 'review', label: 'Review', description: 'PR + CI watch' },
    { id: 'merge', label: 'Merge', description: 'gate + ship' },
  ],
  edges: [
    { from: 'analyze', to: 'requirements' },
    { from: 'requirements', to: 'research' },
    { from: 'research', to: 'plan' },
    { from: 'plan', to: 'implement', label: 'gate: plan' },
    { from: 'implement', to: 'review' },
    { from: 'review', to: 'merge', label: 'gate: merge' },
  ],
};

const SUPERVISOR_AGENT_GRAPH: BuiltinGraphDescriptor = {
  agentType: 'supervisor-agent',
  nodes: [
    { id: 'event-in', label: 'Event in', description: 'gate / question / message' },
    {
      id: 'policy',
      label: 'Resolve policy',
      description: 'cascade global -> repo -> app -> feature',
    },
    { id: 'evaluate', label: 'Evaluate', description: 'LLM call via IAgentExecutorProvider' },
    { id: 'verdict', label: 'Verdict', description: 'approve / reject / advise / escalate' },
    { id: 'persist', label: 'Persist', description: 'SupervisorDecision + activity_log' },
  ],
  edges: [
    { from: 'event-in', to: 'policy' },
    { from: 'policy', to: 'evaluate' },
    { from: 'evaluate', to: 'verdict' },
    { from: 'verdict', to: 'persist' },
  ],
};

const DESCRIPTORS = new Map<string, BuiltinGraphDescriptor>([
  ['feature-agent', FEATURE_AGENT_GRAPH],
  ['supervisor-agent', SUPERVISOR_AGENT_GRAPH],
]);

export function getBuiltinGraph(agentType: string): BuiltinGraphDescriptor | null {
  const found = DESCRIPTORS.get(agentType);
  return found ? cloneDescriptor(found) : null;
}

export function listBuiltinGraphAgentTypes(): string[] {
  return [...DESCRIPTORS.keys()].sort();
}

export function isKnownGraphAgent(agentType: string): boolean {
  return DESCRIPTORS.has(agentType);
}

function cloneDescriptor(d: BuiltinGraphDescriptor): BuiltinGraphDescriptor {
  return {
    agentType: d.agentType,
    nodes: d.nodes.map((n) => ({ ...n })),
    edges: d.edges.map((e) => ({ ...e })),
  };
}
