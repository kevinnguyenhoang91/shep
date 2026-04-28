/**
 * SQLiteAgentMessageRepository — integration tests (spec 093).
 *
 * Verifies end-to-end persistence on a temp SQLite database, mirroring
 * the in-memory adapter contract.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createInMemoryDatabase } from '../../../helpers/database.helper.js';
import { runSQLiteMigrations } from '@/infrastructure/persistence/sqlite/migrations.js';
import { SQLiteAgentMessageRepository } from '@/infrastructure/repositories/sqlite-agent-message.repository.js';
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

describe('SQLiteAgentMessageRepository', () => {
  let db: Database.Database;
  let repo: SQLiteAgentMessageRepository;

  beforeEach(async () => {
    db = createInMemoryDatabase();
    await runSQLiteMigrations(db);
    repo = new SQLiteAgentMessageRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('create + findById round-trips a message', async () => {
    await repo.create(makeMessage({ id: 'm1' }));
    const found = await repo.findById('app-1', 'm1');
    expect(found?.id).toBe('m1');
    expect(found?.messageKind).toBe(AgentMessageKind.status);
  });

  it('findById returns null for cross-app reads (NFR-7)', async () => {
    await repo.create(makeMessage({ id: 'm1', appId: 'app-1' }));
    expect(await repo.findById('app-2', 'm1')).toBeNull();
  });

  it('listByScope filters by appId and featureId', async () => {
    await repo.create(makeMessage({ id: 'm1', appId: 'app-1', featureId: 'f1' }));
    await repo.create(makeMessage({ id: 'm2', appId: 'app-1', featureId: 'f2' }));
    await repo.create(makeMessage({ id: 'm3', appId: 'app-2', featureId: 'f1' }));

    const f1 = await repo.listByScope('app-1', 'f1');
    expect(f1.map((m) => m.id)).toEqual(['m1']);
    const cross = await repo.listByScope('app-2', undefined);
    expect(cross.map((m) => m.id)).toEqual(['m3']);
  });

  it('listByScope filters by since and limit', async () => {
    const old = new Date(2026, 0, 1);
    const recent = new Date(2026, 5, 1);
    await repo.create(makeMessage({ id: 'old', createdAt: old, updatedAt: old }));
    await repo.create(makeMessage({ id: 'new', createdAt: recent, updatedAt: recent }));

    const sinceResults = await repo.listByScope('app-1', undefined, {
      since: new Date(2026, 3, 1),
    });
    expect(sinceResults.map((m) => m.id)).toEqual(['new']);

    const limited = await repo.listByScope('app-1', undefined, { limit: 1 });
    expect(limited).toHaveLength(1);
  });

  it('listByScope undeliveredOnly excludes delivered messages', async () => {
    await repo.create(makeMessage({ id: 'undelivered' }));
    await repo.create(makeMessage({ id: 'delivered', deliveredAt: new Date() }));

    const undelivered = await repo.listByScope('app-1', undefined, {
      undeliveredOnly: true,
    });
    expect(undelivered.map((m) => m.id)).toEqual(['undelivered']);
  });

  it('findByCorrelationId is app-scoped', async () => {
    await repo.create(makeMessage({ id: 'req', correlationId: 'corr-1' }));
    expect(await repo.findByCorrelationId('app-1', 'corr-1')).not.toBeNull();
    expect(await repo.findByCorrelationId('app-2', 'corr-1')).toBeNull();
  });

  it('markDelivered sets delivered_at and is idempotent', async () => {
    await repo.create(makeMessage({ id: 'm1' }));
    const t = new Date();
    await repo.markDelivered('app-1', 'm1', t);
    const after = await repo.findById('app-1', 'm1');
    expect(after?.deliveredAt?.getTime()).toBe(t.getTime());

    const later = new Date(t.getTime() + 5000);
    await repo.markDelivered('app-1', 'm1', later);
    const second = await repo.findById('app-1', 'm1');
    expect(second?.deliveredAt?.getTime()).toBe(t.getTime());
  });

  it('markDelivered is a no-op for cross-app calls', async () => {
    await repo.create(makeMessage({ id: 'm1', appId: 'app-1' }));
    await repo.markDelivered('app-2', 'm1', new Date());
    const after = await repo.findById('app-1', 'm1');
    expect(after?.deliveredAt).toBeUndefined();
  });
});
