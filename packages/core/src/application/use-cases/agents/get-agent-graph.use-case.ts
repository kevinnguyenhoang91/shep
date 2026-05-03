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
import type { ICustomAgentRepository } from '../../ports/output/repositories/custom-agent-repository.interface.js';
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
    private readonly overrides: IAgentGraphOverrideRepository,
    @inject('ICustomAgentRepository')
    private readonly customAgents: ICustomAgentRepository
  ) {}

  async execute(input: GetAgentGraphInput): Promise<AgentGraphResult | null> {
    const bundled = getBuiltinGraph(input.agentType);

    // Built-in: bundled descriptor exists; honour its shape.
    if (bundled) {
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

    // Custom agent: bundled is an empty descriptor — the user authors
    // every node and edge themselves.
    const custom = await this.customAgents.findByType(input.agentType);
    if (!custom) return null;

    const emptyBundled: BuiltinGraphDescriptor = {
      agentType: input.agentType,
      nodes: [{ id: 'start', label: 'Start', description: 'edit me' }],
      edges: [],
    };
    const override = await this.overrides.findActive(input.agentType);
    if (!override) {
      return {
        agentType: input.agentType,
        nodes: emptyBundled.nodes,
        edges: emptyBundled.edges,
        hasOverride: false,
        bundled: emptyBundled,
      };
    }
    const nodes = parseJsonArray<BuiltinGraphNode>(override.nodesJson, emptyBundled.nodes);
    const edges = parseJsonArray<BuiltinGraphEdge>(override.edgesJson, emptyBundled.edges);
    return {
      agentType: input.agentType,
      nodes,
      edges,
      hasOverride: true,
      bundled: emptyBundled,
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
