/**
 * InMemoryAgentMessageBus — unit tests (spec 093, task 10).
 *
 * Verifies hub-and-spoke addressing, scope isolation (NFR-7), correlationId
 * lookup, and subscriber fan-out. The in-memory bus is the test-time
 * adapter for IAgentMessageBus; cross-process delivery lives in the SQLite
 * adapter (task 11).
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryAgentMessageBus } from '@/infrastructure/adapters/in-memory/in-memory-agent-message-bus.js';
import { InMemoryAgentMessageRepository } from '@/infrastructure/adapters/in-memory/in-memory-agent-message-repository.js';
import { PeerAddressingForbiddenError } from '@/domain/errors/peer-addressing-forbidden.error.js';
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

describe('InMemoryAgentMessageBus', () => {
  let repo: InMemoryAgentMessageRepository;
  let bus: InMemoryAgentMessageBus;

  beforeEach(() => {
    repo = new InMemoryAgentMessageRepository();
    bus = new InMemoryAgentMessageBus(repo);
  });

  it('publish then listFor round-trips a message', async () => {
    const msg = makeMessage({ id: 'm1', appId: 'app-1' });
    await bus.publish(msg);

    const rows = await bus.listFor({ appId: 'app-1' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('m1');
  });

  it('rejects peer addressing with a typed error', async () => {
    const peerMsg = makeMessage({ toKind: 'peer', toTarget: 'run-2' });
    await expect(bus.publish(peerMsg)).rejects.toBeInstanceOf(PeerAddressingForbiddenError);
  });

  it('subscribe handler is called on each subsequent publish that matches the filter', async () => {
    const handler = vi.fn();
    const unsubscribe = bus.subscribe({ appId: 'app-1' }, handler);

    await bus.publish(makeMessage({ id: 'm1', appId: 'app-1' }));
    await bus.publish(makeMessage({ id: 'm2', appId: 'app-1', featureId: 'feat-7' }));

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0]?.[0]?.id).toBe('m1');
    expect(handler.mock.calls[1]?.[0]?.id).toBe('m2');

    unsubscribe();
    await bus.publish(makeMessage({ id: 'm3', appId: 'app-1' }));
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('cross-app subscribers do not receive messages from another app (NFR-7)', async () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    bus.subscribe({ appId: 'app-1' }, handlerA);
    bus.subscribe({ appId: 'app-2' }, handlerB);

    await bus.publish(makeMessage({ id: 'm1', appId: 'app-1' }));

    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).not.toHaveBeenCalled();
  });

  it('feature-scoped subscribers ignore other features in the same app', async () => {
    const handler = vi.fn();
    bus.subscribe({ appId: 'app-1', featureId: 'feat-A' }, handler);

    await bus.publish(makeMessage({ id: 'm1', appId: 'app-1', featureId: 'feat-B' }));
    await bus.publish(makeMessage({ id: 'm2', appId: 'app-1', featureId: 'feat-A' }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]?.id).toBe('m2');
  });

  it('agentRunId filter matches sender or target run', async () => {
    const handler = vi.fn();
    bus.subscribe({ appId: 'app-1', agentRunId: 'run-7' }, handler);

    await bus.publish(makeMessage({ id: 'm1', appId: 'app-1', fromAgentRunId: 'run-7' }));
    await bus.publish(
      makeMessage({ id: 'm2', appId: 'app-1', toKind: 'agent', toTarget: 'run-7' })
    );
    await bus.publish(
      makeMessage({ id: 'm3', appId: 'app-1', fromAgentRunId: 'run-9', toTarget: 'broadcast' })
    );

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('listFor honors since cursor and is ordered by createdAt asc', async () => {
    const t0 = new Date('2026-01-01T00:00:00Z');
    const t1 = new Date('2026-01-01T00:01:00Z');
    const t2 = new Date('2026-01-01T00:02:00Z');

    await bus.publish(makeMessage({ id: 'm1', appId: 'app-1', createdAt: t0, updatedAt: t0 }));
    await bus.publish(makeMessage({ id: 'm2', appId: 'app-1', createdAt: t1, updatedAt: t1 }));
    await bus.publish(makeMessage({ id: 'm3', appId: 'app-1', createdAt: t2, updatedAt: t2 }));

    const rows = await bus.listFor({ appId: 'app-1', since: t1 });
    expect(rows.map((r) => r.id)).toEqual(['m2', 'm3']);
  });

  it('publish persists through the underlying repository', async () => {
    await bus.publish(makeMessage({ id: 'm-persist', appId: 'app-1' }));
    const direct = await repo.findById('app-1', 'm-persist');
    expect(direct?.id).toBe('m-persist');
  });
});
