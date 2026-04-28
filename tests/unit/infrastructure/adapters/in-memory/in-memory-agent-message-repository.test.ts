/**
 * InMemoryAgentMessageRepository — unit tests
 *
 * Verifies create/find/list semantics, app-scope isolation, correlationId
 * lookups, undelivered filtering, and markDelivered behavior.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAgentMessageRepository } from '@/infrastructure/adapters/in-memory/in-memory-agent-message-repository.js';
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

describe('InMemoryAgentMessageRepository', () => {
  let repo: InMemoryAgentMessageRepository;

  beforeEach(() => {
    repo = new InMemoryAgentMessageRepository();
  });

  it('create + findById round-trips a message', async () => {
    const msg = makeMessage({ id: 'm1' });
    await repo.create(msg);
    const found = await repo.findById('app-1', 'm1');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('m1');
    expect(found!.appId).toBe('app-1');
  });

  it('rejects duplicate id on create', async () => {
    await repo.create(makeMessage({ id: 'm1' }));
    await expect(repo.create(makeMessage({ id: 'm1' }))).rejects.toThrow();
  });

  it('findById returns null for cross-app reads (NFR-7)', async () => {
    await repo.create(makeMessage({ id: 'm1', appId: 'app-1' }));
    const found = await repo.findById('app-2', 'm1');
    expect(found).toBeNull();
  });

  it('listByScope filters by appId', async () => {
    await repo.create(makeMessage({ id: 'm1', appId: 'app-1' }));
    await repo.create(makeMessage({ id: 'm2', appId: 'app-2' }));
    const a = await repo.listByScope('app-1', undefined);
    expect(a.map((m) => m.id)).toEqual(['m1']);
    const b = await repo.listByScope('app-2', undefined);
    expect(b.map((m) => m.id)).toEqual(['m2']);
  });

  it('listByScope filters by featureId when supplied', async () => {
    await repo.create(makeMessage({ id: 'm1', appId: 'app-1', featureId: 'f1' }));
    await repo.create(makeMessage({ id: 'm2', appId: 'app-1', featureId: 'f2' }));
    const onlyF1 = await repo.listByScope('app-1', 'f1');
    expect(onlyF1.map((m) => m.id)).toEqual(['m1']);
  });

  it('listByScope filters by since', async () => {
    const old = new Date(2026, 0, 1);
    const recent = new Date(2026, 5, 1);
    await repo.create(makeMessage({ id: 'old', createdAt: old, updatedAt: old }));
    await repo.create(makeMessage({ id: 'new', createdAt: recent, updatedAt: recent }));
    const result = await repo.listByScope('app-1', undefined, {
      since: new Date(2026, 3, 1),
    });
    expect(result.map((m) => m.id)).toEqual(['new']);
  });

  it('listByScope undeliveredOnly excludes delivered messages', async () => {
    await repo.create(makeMessage({ id: 'undelivered', deliveredAt: undefined }));
    await repo.create(makeMessage({ id: 'delivered', deliveredAt: new Date() }));
    const result = await repo.listByScope('app-1', undefined, {
      undeliveredOnly: true,
    });
    expect(result.map((m) => m.id)).toEqual(['undelivered']);
  });

  it('listByScope respects limit', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.create(makeMessage({ id: `m${i}` }));
    }
    const result = await repo.listByScope('app-1', undefined, { limit: 3 });
    expect(result).toHaveLength(3);
  });

  it('findByCorrelationId returns the matching message', async () => {
    await repo.create(makeMessage({ id: 'req', correlationId: 'corr-1' }));
    await repo.create(makeMessage({ id: 'reply', correlationId: 'corr-1' }));
    const found = await repo.findByCorrelationId('app-1', 'corr-1');
    expect(found).not.toBeNull();
  });

  it('findByCorrelationId is app-scoped', async () => {
    await repo.create(makeMessage({ id: 'req', appId: 'app-1', correlationId: 'corr-1' }));
    const found = await repo.findByCorrelationId('app-2', 'corr-1');
    expect(found).toBeNull();
  });

  it('markDelivered sets deliveredAt and is idempotent', async () => {
    await repo.create(makeMessage({ id: 'm1' }));
    const t = new Date();
    await repo.markDelivered('app-1', 'm1', t);
    const after = await repo.findById('app-1', 'm1');
    expect(after!.deliveredAt).toBe(t);

    await repo.markDelivered('app-1', 'm1', new Date(t.getTime() + 1000));
    const second = await repo.findById('app-1', 'm1');
    expect(second!.deliveredAt).toBe(t);
  });

  it('markDelivered does nothing for cross-app calls', async () => {
    await repo.create(makeMessage({ id: 'm1', appId: 'app-1' }));
    await repo.markDelivered('app-2', 'm1', new Date());
    const after = await repo.findById('app-1', 'm1');
    expect(after!.deliveredAt).toBeUndefined();
  });
});
