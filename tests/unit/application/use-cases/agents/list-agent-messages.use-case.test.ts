/**
 * ListAgentMessagesUseCase — unit tests (spec 093, task 12).
 *
 * Verifies app-scope filtering and feature/agentRun narrowing through the
 * IAgentMessageBus. The flag is intentionally NOT a hard gate for reads —
 * if no rows exist (because writes were short-circuited), the read returns
 * an empty list naturally.
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListAgentMessagesUseCase } from '@/application/use-cases/agents/list-agent-messages.use-case.js';
import type { IAgentMessageBus } from '@/application/ports/output/agents/agent-message-bus.interface.js';
import type { AgentMessage } from '@/domain/generated/output.js';
import { AgentMessageKind } from '@/domain/generated/output.js';

function makeMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
  const now = new Date();
  return {
    id: overrides.id ?? `msg-${Math.random().toString(36).slice(2, 9)}`,
    appId: 'app-1',
    featureId: undefined,
    fromAgentRunId: 'run-1',
    fromActor: 'agent:run-1',
    toTarget: 'broadcast',
    toKind: 'broadcast',
    messageKind: AgentMessageKind.status,
    payload: '{}',
    correlationId: undefined,
    deliveredAt: undefined,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as AgentMessage;
}

function makeBus(): IAgentMessageBus & {
  listFor: ReturnType<typeof vi.fn>;
} {
  const listFor = vi.fn();
  return {
    publish: vi.fn(),
    subscribe: vi.fn(),
    listFor,
  } as IAgentMessageBus & { listFor: typeof listFor };
}

describe('ListAgentMessagesUseCase', () => {
  let bus: ReturnType<typeof makeBus>;
  let useCase: ListAgentMessagesUseCase;

  beforeEach(() => {
    bus = makeBus();
    useCase = new ListAgentMessagesUseCase(bus);
  });

  it('forwards appId / featureId / agentRunId / since to the bus filter', async () => {
    bus.listFor.mockResolvedValue([]);
    const since = new Date('2026-01-01T00:00:00Z');

    await useCase.execute({
      appId: 'app-7',
      featureId: 'feat-3',
      agentRunId: 'run-9',
      since,
      limit: 50,
    });

    expect(bus.listFor).toHaveBeenCalledTimes(1);
    expect(bus.listFor).toHaveBeenCalledWith(
      { appId: 'app-7', featureId: 'feat-3', agentRunId: 'run-9', since },
      50
    );
  });

  it('returns rows from the bus', async () => {
    const rows = [makeMessage({ id: 'a' }), makeMessage({ id: 'b' })];
    bus.listFor.mockResolvedValue(rows);

    const out = await useCase.execute({ appId: 'app-1' });
    expect(out.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('rejects when appId is missing or empty (NFR-7 invariant)', async () => {
    await expect(useCase.execute({ appId: '' })).rejects.toThrow();
  });
});
