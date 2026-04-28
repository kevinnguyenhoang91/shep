/**
 * ListAgentMessagesUseCase
 *
 * Scope-safe read for the agent message bus. Always filters by `appId`
 * (NFR-7 cross-app isolation). Optional `featureId`, `agentRunId`, and
 * `since` cursor narrow the result. The collaboration feature flag does
 * NOT gate reads — when the flag is off, no rows have been written, so
 * the bus naturally returns an empty list.
 */

import { inject, injectable } from 'tsyringe';
import type { IAgentMessageBus } from '../../ports/output/agents/agent-message-bus.interface.js';
import type { AgentMessage } from '../../../domain/generated/output.js';

export interface ListAgentMessagesInput {
  appId: string;
  featureId?: string;
  agentRunId?: string;
  since?: Date;
  limit?: number;
}

@injectable()
export class ListAgentMessagesUseCase {
  constructor(
    @inject('IAgentMessageBus')
    private readonly bus: IAgentMessageBus
  ) {}

  async execute(input: ListAgentMessagesInput): Promise<AgentMessage[]> {
    if (!input.appId) {
      throw new Error('appId is required to list agent messages (NFR-7 scope isolation)');
    }

    return this.bus.listFor(
      {
        appId: input.appId,
        featureId: input.featureId,
        agentRunId: input.agentRunId,
        since: input.since,
      },
      input.limit
    );
  }
}
