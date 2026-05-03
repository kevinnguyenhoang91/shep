/**
 * UpsertAgentGraphOverrideUseCase
 *
 * Creates a new override or replaces the existing one for the given
 * agentType. Rejects unknown agent types — the user can only override
 * graphs the registry knows about.
 *
 * Validates structural integrity: every edge must reference existing
 * node ids and node ids must be unique. The frontend should pre-validate
 * but the use case re-checks defensively.
 */

import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'node:crypto';

import type { IAgentGraphOverrideRepository } from '../../ports/output/repositories/agent-graph-override-repository.interface.js';
import type { ICustomAgentRepository } from '../../ports/output/repositories/custom-agent-repository.interface.js';
import type { AgentGraphOverride } from '../../../domain/generated/output.js';
import {
  isKnownGraphAgent,
  type BuiltinGraphEdge,
  type BuiltinGraphNode,
} from '../../services/builtin-graph-registry.js';

export interface UpsertAgentGraphOverrideInput {
  agentType: string;
  nodes: BuiltinGraphNode[];
  edges: BuiltinGraphEdge[];
  /** Author of the override; defaults to 'user'. */
  createdBy?: string;
}

@injectable()
export class UpsertAgentGraphOverrideUseCase {
  constructor(
    @inject('IAgentGraphOverrideRepository')
    private readonly overrides: IAgentGraphOverrideRepository,
    @inject('ICustomAgentRepository')
    private readonly customAgents: ICustomAgentRepository
  ) {}

  async execute(input: UpsertAgentGraphOverrideInput): Promise<AgentGraphOverride> {
    if (!input.agentType.trim()) throw new Error('agentType is required');
    if (!isKnownGraphAgent(input.agentType)) {
      // Custom agents can carry their own graph descriptors too.
      const custom = await this.customAgents.findByType(input.agentType);
      if (!custom) {
        throw new Error(
          `Unknown graph agent: ${input.agentType}. ` +
            'Only agents registered in the built-in graph registry or owned by a custom agent ' +
            'can have a graph override.'
        );
      }
    }
    if (!Array.isArray(input.nodes) || input.nodes.length === 0) {
      throw new Error('nodes must be a non-empty array');
    }
    if (!Array.isArray(input.edges)) {
      throw new Error('edges must be an array');
    }
    validateStructure(input.nodes, input.edges);

    const existing = await this.overrides.findActive(input.agentType);
    const now = new Date();
    const override: AgentGraphOverride = {
      id: existing?.id ?? randomUUID(),
      agentType: input.agentType,
      nodesJson: JSON.stringify(input.nodes),
      edgesJson: JSON.stringify(input.edges),
      version: (existing?.version ?? 0) + 1,
      createdBy: input.createdBy ?? existing?.createdBy ?? 'user',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) {
      await this.overrides.update(override);
    } else {
      await this.overrides.create(override);
    }
    return override;
  }
}

function validateStructure(nodes: BuiltinGraphNode[], edges: BuiltinGraphEdge[]): void {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (!node.id?.trim()) throw new Error('every node must have a non-empty id');
    if (!node.label?.trim()) throw new Error(`node ${node.id} must have a non-empty label`);
    if (ids.has(node.id)) throw new Error(`duplicate node id: ${node.id}`);
    ids.add(node.id);
  }
  for (const edge of edges) {
    if (!ids.has(edge.from)) throw new Error(`edge references unknown source node: ${edge.from}`);
    if (!ids.has(edge.to)) throw new Error(`edge references unknown target node: ${edge.to}`);
  }
}
