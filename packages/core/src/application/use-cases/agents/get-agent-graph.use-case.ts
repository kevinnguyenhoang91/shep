/**
 * GetAgentGraphUseCase
 *
 * Returns the merged LangGraph descriptor for an agent type — the override
 * stored in agent_graph_overrides when present, otherwise the bundled
 * descriptor from the registry. Powers the agent editor's Graph tab and
 * any future runtime consumer.
 */

import { inject, injectable } from 'tsyringe';

import type { IAgentGraphOverrideRepository } from '../../ports/output/repositories/agent-graph-override-repository.interface.js';
import {
  getBuiltinGraph,
  type BuiltinGraphDescriptor,
  type BuiltinGraphEdge,
  type BuiltinGraphNode,
} from '../../services/builtin-graph-registry.js';

export interface AgentGraphResult {
  agentType: string;
  nodes: BuiltinGraphNode[];
  edges: BuiltinGraphEdge[];
  /** True when an override row exists in agent_graph_overrides. */
  hasOverride: boolean;
  /** Snapshot of the bundled descriptor — never mutated, used by reset/diff. */
  bundled: BuiltinGraphDescriptor;
}

export interface GetAgentGraphInput {
  agentType: string;
}

@injectable()
export class GetAgentGraphUseCase {
  constructor(
    @inject('IAgentGraphOverrideRepository')
    private readonly overrides: IAgentGraphOverrideRepository
  ) {}

  async execute(input: GetAgentGraphInput): Promise<AgentGraphResult | null> {
    const bundled = getBuiltinGraph(input.agentType);
    if (!bundled) return null;

    const override = await this.overrides.findActive(input.agentType);
    if (!override) {
      return {
        agentType: input.agentType,
        nodes: bundled.nodes,
        edges: bundled.edges,
        hasOverride: false,
        bundled,
      };
    }

    const nodes = parseJsonArray<BuiltinGraphNode>(override.nodesJson, bundled.nodes);
    const edges = parseJsonArray<BuiltinGraphEdge>(override.edgesJson, bundled.edges);
    return {
      agentType: input.agentType,
      nodes,
      edges,
      hasOverride: true,
      bundled,
    };
  }
}

function parseJsonArray<T>(raw: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}
