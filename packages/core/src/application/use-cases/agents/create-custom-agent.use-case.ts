/**
 * CreateCustomAgentUseCase
 *
 * Creates a brand-new custom agent type the user can attach prompt and
 * graph overrides to. Optionally seeds the first prompt slot so the agent
 * is immediately useful in the editor.
 *
 * Rejects names that collide with built-in agent types — built-ins live
 * in code and must not be shadowed.
 */

import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'node:crypto';

import type { ICustomAgentRepository } from '../../ports/output/repositories/custom-agent-repository.interface.js';
import type { IAgentPromptOverrideRepository } from '../../ports/output/repositories/agent-prompt-override-repository.interface.js';
import type { CustomAgent, AgentPromptOverride } from '../../../domain/generated/output.js';
import { listBuiltinAgentTypes } from '../../services/builtin-prompt-registry.js';

const AGENT_TYPE_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;

export interface CreateCustomAgentInput {
  agentType: string;
  name: string;
  description: string;
  /**
   * Optional first prompt slot to seed. The user can add more from the
   * agent editor afterwards. The slot id must match
   * /^[a-z][a-z0-9-_.]{0,63}$/.
   */
  initialPrompt?: {
    promptId: string;
    body: string;
  };
  /** Author of the new agent; defaults to 'user'. */
  createdBy?: string;
}

export interface CreateCustomAgentResult {
  agent: CustomAgent;
  initialPromptOverride?: AgentPromptOverride;
}

@injectable()
export class CreateCustomAgentUseCase {
  constructor(
    @inject('ICustomAgentRepository')
    private readonly agents: ICustomAgentRepository,
    @inject('IAgentPromptOverrideRepository')
    private readonly overrides: IAgentPromptOverrideRepository
  ) {}

  async execute(input: CreateCustomAgentInput): Promise<CreateCustomAgentResult> {
    if (!input.agentType.trim()) throw new Error('agentType is required');
    if (!AGENT_TYPE_PATTERN.test(input.agentType)) {
      throw new Error(
        'agentType must be lowercase kebab-case (a-z, 0-9, -), starting with a letter, max 64 chars'
      );
    }
    if (!input.name.trim()) throw new Error('name is required');
    if (!input.description.trim()) throw new Error('description is required');

    if (isBuiltinAgentType(input.agentType)) {
      throw new Error(
        `agentType "${input.agentType}" collides with a built-in agent and cannot be used`
      );
    }
    const existing = await this.agents.findByType(input.agentType);
    if (existing) {
      throw new Error(`agentType "${input.agentType}" already exists`);
    }

    const now = new Date();
    const agent: CustomAgent = {
      id: randomUUID(),
      agentType: input.agentType,
      name: input.name,
      description: input.description,
      createdBy: input.createdBy ?? 'user',
      createdAt: now,
      updatedAt: now,
    };
    await this.agents.create(agent);

    let initialPromptOverride: AgentPromptOverride | undefined;
    if (input.initialPrompt) {
      const promptId = input.initialPrompt.promptId.trim();
      if (!promptId) throw new Error('initialPrompt.promptId must be non-empty');
      if (!input.initialPrompt.body.length) {
        throw new Error('initialPrompt.body must be non-empty');
      }
      initialPromptOverride = {
        id: randomUUID(),
        agentType: agent.agentType,
        promptId,
        body: input.initialPrompt.body,
        version: 1,
        createdBy: agent.createdBy,
        createdAt: now,
        updatedAt: now,
      };
      await this.overrides.create(initialPromptOverride);
    }

    return initialPromptOverride === undefined ? { agent } : { agent, initialPromptOverride };
  }
}

function isBuiltinAgentType(agentType: string): boolean {
  return listBuiltinAgentTypes().some((t) => t.agentType === agentType);
}
