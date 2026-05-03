/**
 * SQLite-backed implementation of {@link IAgentPromptResolver} (FR-36).
 *
 * Looks up the active override for (agentType, promptId). When present,
 * returns its body. When absent, returns the bundled fallback string the
 * caller passed in — the runtime never substitutes, merges, or templates
 * the fallback (NFR-16).
 */

import { inject, injectable } from 'tsyringe';
import type { IAgentPromptResolver } from '../../../../application/ports/output/agents/agent-prompt-resolver.interface.js';
import type { IAgentPromptOverrideRepository } from '../../../../application/ports/output/repositories/agent-prompt-override-repository.interface.js';

@injectable()
export class SQLiteAgentPromptResolver implements IAgentPromptResolver {
  constructor(
    @inject('IAgentPromptOverrideRepository')
    private readonly overrides: IAgentPromptOverrideRepository
  ) {}

  async resolve(agentType: string, promptId: string, fallback: string): Promise<string> {
    const override = await this.overrides.findActive(agentType, promptId);
    return override?.body ?? fallback;
  }
}
