/**
 * SQLiteSupervisorDecisionRepository — integration tests (spec 093).
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createInMemoryDatabase } from '../../../helpers/database.helper.js';
import { runSQLiteMigrations } from '@/infrastructure/persistence/sqlite/migrations.js';
import { SQLiteSupervisorDecisionRepository } from '@/infrastructure/repositories/sqlite-supervisor-decision.repository.js';
import type { SupervisorDecision } from '@/domain/generated/output.js';
import { SupervisorVerdict } from '@/domain/generated/output.js';

function makeDecision(overrides: Partial<SupervisorDecision> = {}): SupervisorDecision {
  const now = new Date();
  return {
    id: overrides.id ?? `dec-${Math.random().toString(36).slice(2, 9)}`,
    scopeType: 'app',
    scopeId: 'app-1',
    featureId: undefined,
    supervisorRunId: 'sup-1',
    sourceEventKind: 'gate',
    sourceEventId: 'gate-1',
    verdict: SupervisorVerdict.advise,
    rationale: 'looks fine',
    modelId: 'claude-sonnet-4-6',
    promptVersion: 'v1',
    ruleRef: undefined,
    confidence: undefined,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as SupervisorDecision;
}

describe('SQLiteSupervisorDecisionRepository', () => {
  let db: Database.Database;
  let repo: SQLiteSupervisorDecisionRepository;

  beforeEach(async () => {
    db = createInMemoryDatabase();
    await runSQLiteMigrations(db);
    repo = new SQLiteSupervisorDecisionRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('create + findById round-trips a decision (with confidence + rule)', async () => {
    await repo.create(makeDecision({ id: 'd1', confidence: 0.92, ruleRef: 'rule:safe-merge' }));
    const found = await repo.findById('d1');
    expect(found?.id).toBe('d1');
    expect(found?.confidence).toBeCloseTo(0.92);
    expect(found?.ruleRef).toBe('rule:safe-merge');
  });

  it('rejects duplicate ids (append-only)', async () => {
    await repo.create(makeDecision({ id: 'd1' }));
    await expect(repo.create(makeDecision({ id: 'd1' }))).rejects.toThrow();
  });

  it('listBySourceEvent returns decisions ascending', async () => {
    await repo.create(
      makeDecision({
        id: 'd2',
        sourceEventKind: 'gate',
        sourceEventId: 'g1',
        createdAt: new Date(2026, 1, 1),
        updatedAt: new Date(2026, 1, 1),
      })
    );
    await repo.create(
      makeDecision({
        id: 'd1',
        sourceEventKind: 'gate',
        sourceEventId: 'g1',
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 0, 1),
      })
    );
    const result = await repo.listBySourceEvent('gate', 'g1');
    expect(result.map((d) => d.id)).toEqual(['d1', 'd2']);
  });

  it('listBySupervisorRun filters by supervisor_run_id', async () => {
    await repo.create(makeDecision({ id: 'd1', supervisorRunId: 'r1' }));
    await repo.create(makeDecision({ id: 'd2', supervisorRunId: 'r2' }));
    const result = await repo.listBySupervisorRun('r1');
    expect(result.map((d) => d.id)).toEqual(['d1']);
  });

  it('listByScope is app-scoped (no leakage)', async () => {
    await repo.create(makeDecision({ id: 'd1', scopeType: 'app', scopeId: 'app-1' }));
    await repo.create(makeDecision({ id: 'd2', scopeType: 'app', scopeId: 'app-2' }));
    const a = await repo.listByScope('app', 'app-1', undefined);
    expect(a.map((d) => d.id)).toEqual(['d1']);
  });

  it('listByScope filters by feature, since, and limit', async () => {
    const old = new Date(2026, 0, 1);
    const recent = new Date(2026, 5, 1);
    await repo.create(makeDecision({ id: 'old', createdAt: old, updatedAt: old, featureId: 'f1' }));
    await repo.create(
      makeDecision({ id: 'new', createdAt: recent, updatedAt: recent, featureId: 'f1' })
    );
    await repo.create(
      makeDecision({ id: 'other', featureId: 'f2', createdAt: recent, updatedAt: recent })
    );

    const since = await repo.listByScope('app', 'app-1', 'f1', { since: new Date(2026, 3, 1) });
    expect(since.map((d) => d.id)).toEqual(['new']);

    const limited = await repo.listByScope('app', 'app-1', undefined, { limit: 1 });
    expect(limited).toHaveLength(1);
  });
});
