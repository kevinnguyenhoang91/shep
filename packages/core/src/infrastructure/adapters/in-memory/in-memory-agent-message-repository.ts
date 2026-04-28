/**
 * In-Memory AgentMessage Repository
 *
 * Test-friendly adapter for {@link IAgentMessageRepository}. Backed by a
 * single Map keyed by message id. Every list/find query is filtered by
 * appId at the entry point — there is no cross-app leakage by construction.
 */

import { injectable } from 'tsyringe';
import type {
  AgentMessageListFilters,
  IAgentMessageRepository,
} from '@/application/ports/output/repositories/agent-message-repository.interface.js';
import type { AgentMessage } from '@/domain/generated/output.js';

function toMillis(value: AgentMessage['createdAt']): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  return 0;
}

@injectable()
export class InMemoryAgentMessageRepository implements IAgentMessageRepository {
  private readonly messages = new Map<string, AgentMessage>();

  async create(message: AgentMessage): Promise<void> {
    if (this.messages.has(message.id)) {
      throw new Error(`AgentMessage with id "${message.id}" already exists`);
    }
    this.messages.set(message.id, { ...message });
  }

  async findById(appId: string, id: string): Promise<AgentMessage | null> {
    const row = this.messages.get(id);
    if (!row || row.appId !== appId) return null;
    return { ...row };
  }

  async findByCorrelationId(appId: string, correlationId: string): Promise<AgentMessage | null> {
    for (const row of this.messages.values()) {
      if (row.appId === appId && row.correlationId === correlationId) {
        return { ...row };
      }
    }
    return null;
  }

  async listByScope(
    appId: string,
    featureId: string | undefined,
    filters: AgentMessageListFilters = {}
  ): Promise<AgentMessage[]> {
    const sinceMillis = filters.since ? filters.since.getTime() : undefined;
    const result: AgentMessage[] = [];

    for (const row of this.messages.values()) {
      if (row.appId !== appId) continue;
      if (featureId !== undefined && row.featureId !== featureId) continue;
      if (filters.undeliveredOnly && row.deliveredAt) continue;
      if (sinceMillis !== undefined && toMillis(row.createdAt) < sinceMillis) {
        continue;
      }
      result.push({ ...row });
    }

    result.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));

    return filters.limit !== undefined ? result.slice(0, filters.limit) : result;
  }

  async markDelivered(appId: string, id: string, deliveredAt: Date): Promise<void> {
    const row = this.messages.get(id);
    if (!row || row.appId !== appId) return;
    if (row.deliveredAt) return;
    this.messages.set(id, { ...row, deliveredAt });
  }
}
