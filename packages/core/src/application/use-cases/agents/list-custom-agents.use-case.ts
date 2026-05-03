/**
 * ListCustomAgentsUseCase
 *
 * Returns every persisted custom agent. The agent editor merges these
 * with the built-in registry to produce the full agent list shown on
 * /agents.
 */

import { inject, injectable } from 'tsyringe';

import type { ICustomAgentRepository } from '../../ports/output/repositories/custom-agent-repository.interface.js';
import type { CustomAgent } from '../../../domain/generated/output.js';

@injectable()
export class ListCustomAgentsUseCase {
  constructor(
    @inject('ICustomAgentRepository')
    private readonly agents: ICustomAgentRepository
  ) {}

  async execute(): Promise<CustomAgent[]> {
    return this.agents.listAll();
  }
}
