/**
 * UpsertAgentPromptOverrideUseCase
 *
 * Creates a new override or replaces the existing one for the given
 * (agentType, promptId) slot. Rejects unknown slots — the user can only
 * override prompts the runtime registry knows about (FR-35).
 */

import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'node:crypto';

import type { IAgentPromptOverrideRepository } from '../../ports/output/repositories/agent-prompt-override-repository.interface.js';
import type { ICustomAgentRepository } from '../../ports/output/repositories/custom-agent-repository.interface.js';
import type { AgentPromptOverride } from '../../../domain/generated/output.js';
import { isKnownPromptSlot } from '../../services/builtin-prompt-registry.js';

export interface UpsertAgentPromptOverrideInput {
  agentType: string;
  promptId: string;
  body: string;
  /** Author of the override; defaults to 'user'. */
  createdBy?: string;
}

@injectable()
export class UpsertAgentPromptOverrideUseCase {
  constructor(
    @inject('IAgentPromptOverrideRepository')
    private readonly overrides: IAgentPromptOverrideRepository,
    @inject('ICustomAgentRepository')
    private readonly customAgents: ICustomAgentRepository
  ) {}

  async execute(input: UpsertAgentPromptOverrideInput): Promise<AgentPromptOverride> {
    if (!input.agentType.trim()) throw new Error('agentType is required');
    if (!input.promptId.trim()) throw new Error('promptId is required');
    if (typeof input.body !== 'string' || input.body.length === 0) {
      throw new Error('body must be a non-empty string');
    }
    if (!isKnownPromptSlot(input.agentType, input.promptId)) {
      // Custom agents accept any slot the user invents.
      const custom = await this.customAgents.findByType(input.agentType);
      if (!custom) {
        throw new Error(
          `Unknown prompt slot: ${input.agentType}/${input.promptId}. ` +
            'Only slots registered in the built-in prompt registry or owned by a custom agent ' +
            'can be overridden.'
        );
      }
    }

    const existing = await this.overrides.findActive(input.agentType, input.promptId);
    const now = new Date();
    const override: AgentPromptOverride = {
      id: existing?.id ?? randomUUID(),
      agentType: input.agentType,
      promptId: input.promptId,
      body: input.body,
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
