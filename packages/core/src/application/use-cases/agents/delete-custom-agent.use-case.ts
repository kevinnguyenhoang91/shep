/**
 * DeleteCustomAgentUseCase
 *
 * Removes a custom agent and its associated prompt + graph overrides.
 * No-op when no agent exists. Built-in agents cannot be deleted —
 * attempting to delete one is a defensive error.
 */

import { inject, injectable } from 'tsyringe';

import type { ICustomAgentRepository } from '../../ports/output/repositories/custom-agent-repository.interface.js';
import type { IAgentPromptOverrideRepository } from '../../ports/output/repositories/agent-prompt-override-repository.interface.js';
import type { IAgentGraphOverrideRepository } from '../../ports/output/repositories/agent-graph-override-repository.interface.js';
import { listBuiltinAgentTypes } from '../../services/builtin-prompt-registry.js';

export interface DeleteCustomAgentInput {
  agentType: string;
}

@injectable()
export class DeleteCustomAgentUseCase {
  constructor(
    @inject('ICustomAgentRepository')
    private readonly agents: ICustomAgentRepository,
    @inject('IAgentPromptOverrideRepository')
    private readonly prompts: IAgentPromptOverrideRepository,
    @inject('IAgentGraphOverrideRepository')
    private readonly graphs: IAgentGraphOverrideRepository
  ) {}

  async execute(input: DeleteCustomAgentInput): Promise<void> {
    if (!input.agentType.trim()) throw new Error('agentType is required');
    if (listBuiltinAgentTypes().some((t) => t.agentType === input.agentType)) {
      throw new Error(`Built-in agent "${input.agentType}" cannot be deleted`);
    }

    const promptRows = await this.prompts.listForAgent(input.agentType);
    for (const row of promptRows) {
      await this.prompts.delete(row.agentType, row.promptId);
    }
    await this.graphs.delete(input.agentType);
    await this.agents.delete(input.agentType);
  }
}
