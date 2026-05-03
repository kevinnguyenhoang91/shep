/**
 * DeleteAgentPromptOverrideUseCase
 *
 * Removes the active override for (agentType, promptId). Restores the
 * runtime to the bundled body byte-identically (NFR-16). No-op when
 * no override exists.
 */

import { inject, injectable } from 'tsyringe';

import type { IAgentPromptOverrideRepository } from '../../ports/output/repositories/agent-prompt-override-repository.interface.js';

export interface DeleteAgentPromptOverrideInput {
  agentType: string;
  promptId: string;
}

@injectable()
export class DeleteAgentPromptOverrideUseCase {
  constructor(
    @inject('IAgentPromptOverrideRepository')
    private readonly overrides: IAgentPromptOverrideRepository
  ) {}

  async execute(input: DeleteAgentPromptOverrideInput): Promise<void> {
    if (!input.agentType.trim()) throw new Error('agentType is required');
    if (!input.promptId.trim()) throw new Error('promptId is required');
    await this.overrides.delete(input.agentType, input.promptId);
  }
}
