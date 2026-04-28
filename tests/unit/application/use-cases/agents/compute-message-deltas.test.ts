/**
 * computeMessageDeltas Unit Tests (spec 093, task 13).
 *
 * Pure helper that converts new {@link AgentMessage} rows into
 * {@link AgentMessageStreamEvent} entries while honoring a since cursor so
 * already-seen messages are NOT re-emitted across poll cycles.
 */

import { describe, it, expect } from 'vitest';
import { computeMessageDeltas } from '@/application/use-cases/agents/stream-agent-events/compute-message-deltas.js';
import type { AgentMessage } from '@/domain/generated/output.js';
import { AgentMessageKind } from '@/domain/generated/output.js';

function makeMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
  const now = new Date('2026-04-01T10:00:00Z');
  return {
    id: 'm-1',
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

describe('computeMessageDeltas', () => {
  it('returns one event per message when no messages have been seen yet', () => {
    const cache = { lastSeenAt: 0, deliveredIds: new Set<string>() };
    const events = computeMessageDeltas({
      messages: [
        makeMessage({ id: 'a', createdAt: new Date('2026-04-01T10:00:00Z') }),
        makeMessage({ id: 'b', createdAt: new Date('2026-04-01T10:00:01Z') }),
      ],
      cache,
    });

    expect(events).toHaveLength(2);
    expect(events.map((e) => e.kind)).toEqual(['agent_message', 'agent_message']);
    expect(cache.deliveredIds.has('a')).toBe(true);
    expect(cache.deliveredIds.has('b')).toBe(true);
    expect(cache.lastSeenAt).toBe(new Date('2026-04-01T10:00:01Z').getTime());
  });

  it('does not re-emit already-seen messages on subsequent calls', () => {
    const cache = { lastSeenAt: 0, deliveredIds: new Set<string>() };
    const message = makeMessage({ id: 'a', createdAt: new Date('2026-04-01T10:00:00Z') });

    computeMessageDeltas({ messages: [message], cache });
    const second = computeMessageDeltas({ messages: [message], cache });

    expect(second).toHaveLength(0);
  });

  it('exposes id, scope, kind, and createdAt on the produced event', () => {
    const cache = { lastSeenAt: 0, deliveredIds: new Set<string>() };
    const created = new Date('2026-04-01T10:00:05Z');

    const events = computeMessageDeltas({
      messages: [
        makeMessage({
          id: 'msg-x',
          appId: 'app-7',
          featureId: 'feat-3',
          fromActor: 'agent:run-9',
          fromAgentRunId: 'run-9',
          toKind: 'supervisor',
          toTarget: 'supervisor',
          messageKind: AgentMessageKind.blocked,
          payload: '{"reason":"need help"}',
          correlationId: 'corr-42',
          createdAt: created,
        }),
      ],
      cache,
    });

    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.kind).toBe('agent_message');
    if (event.kind !== 'agent_message') return;
    expect(event.messageId).toBe('msg-x');
    expect(event.appId).toBe('app-7');
    expect(event.featureId).toBe('feat-3');
    expect(event.fromActor).toBe('agent:run-9');
    expect(event.fromAgentRunId).toBe('run-9');
    expect(event.toKind).toBe('supervisor');
    expect(event.messageKind).toBe(AgentMessageKind.blocked);
    expect(event.payload).toBe('{"reason":"need help"}');
    expect(event.correlationId).toBe('corr-42');
    expect(event.createdAt).toBe(created.toISOString());
  });

  it('handles string and number createdAt values', () => {
    const cache = { lastSeenAt: 0, deliveredIds: new Set<string>() };
    const messages = [
      makeMessage({ id: 'a', createdAt: '2026-04-01T10:00:00Z' as unknown as Date }),
      makeMessage({ id: 'b', createdAt: 1700000001000 as unknown as Date }),
    ];
    const events = computeMessageDeltas({ messages, cache });
    expect(events).toHaveLength(2);
  });

  it('returns zero events when no messages are passed', () => {
    const cache = { lastSeenAt: 0, deliveredIds: new Set<string>() };
    expect(computeMessageDeltas({ messages: [], cache })).toEqual([]);
  });
});
