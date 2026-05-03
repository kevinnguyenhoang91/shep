/**
 * Static graph descriptors for the agent editor's Graph tab (FR-38).
 *
 * v1 ships hard-coded descriptions of each agent's LangGraph node/edge
 * topology. The runtime LangGraph state machines under
 * `packages/core/src/infrastructure/services/agents/<agent>/` are the
 * source of truth — these descriptors are a read-only visualization
 * that documents the same shape for the user. Editing the graph at
 * runtime is intentionally out of scope for this iteration.
 */

import type { AgentGraphDescriptor } from './agent-graph-view';

const FEATURE_AGENT_GRAPH: AgentGraphDescriptor = {
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

const SUPERVISOR_AGENT_GRAPH: AgentGraphDescriptor = {
  agentType: 'supervisor-agent',
  nodes: [
    { id: 'event-in', label: 'Event in', description: 'gate / question / message' },
    { id: 'policy', label: 'Resolve policy', description: 'cascade global → repo → app → feature' },
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

const DESCRIPTORS = new Map<string, AgentGraphDescriptor>([
  ['feature-agent', FEATURE_AGENT_GRAPH],
  ['supervisor-agent', SUPERVISOR_AGENT_GRAPH],
]);

export function getAgentGraphDescriptor(agentType: string): AgentGraphDescriptor | null {
  return DESCRIPTORS.get(agentType) ?? null;
}
