/**
 * DeleteAgentGraphOverrideUseCase
 *
 * Removes the active override for an agentType. Restores the runtime to
 * the bundled descriptor byte-identically. No-op when no override exists.
 */

import { inject, injectable } from 'tsyringe';

import type { IAgentGraphOverrideRepository } from '../../ports/output/repositories/agent-graph-override-repository.interface.js';

export interface DeleteAgentGraphOverrideInput {
  agentType: string;
}

@injectable()
export class DeleteAgentGraphOverrideUseCase {
  constructor(
    @inject('IAgentGraphOverrideRepository')
    private readonly overrides: IAgentGraphOverrideRepository
  ) {}

  async execute(input: DeleteAgentGraphOverrideInput): Promise<void> {
    if (!input.agentType.trim()) throw new Error('agentType is required');
    await this.overrides.delete(input.agentType);
  }
}
