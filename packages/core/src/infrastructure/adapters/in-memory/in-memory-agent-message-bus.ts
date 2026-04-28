/**
 * InMemoryAgentMessageBus — test-time adapter for {@link IAgentMessageBus}.
 *
 * Persists through a wrapped {@link InMemoryAgentMessageRepository} and
 * delivers to in-process subscribers synchronously. Cross-process delivery
 * is the SQLite adapter's job — this class is intentionally process-local
 * and is the bus used by every unit/integration test that does not need a
 * real database.
 */

import { inject, injectable } from 'tsyringe';
import type {
  AgentMessageBusFilter,
  AgentMessageHandler,
  AgentMessageUnsubscribe,
  IAgentMessageBus,
} from '@/application/ports/output/agents/agent-message-bus.interface.js';
import type { IAgentMessageRepository } from '@/application/ports/output/repositories/agent-message-repository.interface.js';
import { PeerAddressingForbiddenError } from '@/domain/errors/peer-addressing-forbidden.error.js';
import type { AgentMessage } from '@/domain/generated/output.js';

interface Subscription {
  filter: AgentMessageBusFilter;
  handler: AgentMessageHandler;
}

function matches(filter: AgentMessageBusFilter, message: AgentMessage): boolean {
  if (filter.appId !== message.appId) return false;
  if (filter.featureId !== undefined && filter.featureId !== message.featureId) return false;
  if (filter.agentRunId !== undefined) {
    const runMatches =
      message.fromAgentRunId === filter.agentRunId ||
      (message.toKind === 'agent' && message.toTarget === filter.agentRunId);
    if (!runMatches) return false;
  }
  return true;
}

@injectable()
export class InMemoryAgentMessageBus implements IAgentMessageBus {
  private readonly subscriptions = new Set<Subscription>();

  constructor(
    @inject('IAgentMessageRepository')
    private readonly repository: IAgentMessageRepository
  ) {}

  async publish(message: AgentMessage): Promise<void> {
    if (message.toKind === 'peer') {
      throw new PeerAddressingForbiddenError(message.toKind);
    }

    await this.repository.create(message);

    for (const sub of this.subscriptions) {
      if (matches(sub.filter, message)) {
        await sub.handler(message);
      }
    }
  }

  subscribe(filter: AgentMessageBusFilter, handler: AgentMessageHandler): AgentMessageUnsubscribe {
    const sub: Subscription = { filter, handler };
    this.subscriptions.add(sub);
    return () => {
      this.subscriptions.delete(sub);
    };
  }

  async listFor(filter: AgentMessageBusFilter, limit?: number): Promise<AgentMessage[]> {
    const rows = await this.repository.listByScope(filter.appId, filter.featureId, {
      since: filter.since,
      limit,
    });

    if (filter.agentRunId === undefined) return rows;

    return rows.filter(
      (m) =>
        m.fromAgentRunId === filter.agentRunId ||
        (m.toKind === 'agent' && m.toTarget === filter.agentRunId)
    );
  }
}
