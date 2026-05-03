/**
 * InMemorySupervisorDecisionRepository — unit tests
 *
 * Verifies append-only semantics, scope isolation, and the source-event
 * / supervisor-run lookups used by the audit drawer.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemorySupervisorDecisionRepository } from '@/infrastructure/adapters/in-memory/in-memory-supervisor-decision-repository.js';
import type { SupervisorDecision } from '@/domain/generated/output.js';
import { SupervisorVerdict } from '@/domain/generated/output.js';

function makeDecision(overrides: Partial<SupervisorDecision> = {}): SupervisorDecision {
  const now = new Date();
  return {
    id: overrides.id ?? `dec-${Math.random().toString(36).slice(2, 9)}`,
    scopeType: 'app',
    scopeId: 'app-1',
    featureId: undefined,
    supervisorRunId: 'sup-run-1',
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

describe('InMemorySupervisorDecisionRepository', () => {
  let repo: InMemorySupervisorDecisionRepository;

  beforeEach(() => {
    repo = new InMemorySupervisorDecisionRepository();
  });

  it('create + findById round-trips a decision', async () => {
    await repo.create(makeDecision({ id: 'd1' }));
    const found = await repo.findById('d1');
    expect(found?.id).toBe('d1');
  });

  it('rejects duplicate id (append-only)', async () => {
    await repo.create(makeDecision({ id: 'd1' }));
    await expect(repo.create(makeDecision({ id: 'd1' }))).rejects.toThrow();
  });

  it('listBySourceEvent returns decisions in createdAt asc order', async () => {
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

  it('listBySupervisorRun filters by supervisorRunId', async () => {
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

  it('listByScope filters by featureId when supplied', async () => {
    await repo.create(makeDecision({ id: 'd1', featureId: 'f1' }));
    await repo.create(makeDecision({ id: 'd2', featureId: 'f2' }));
    const result = await repo.listByScope('app', 'app-1', 'f1');
    expect(result.map((d) => d.id)).toEqual(['d1']);
  });

  it('listByScope respects since and limit', async () => {
    const old = new Date(2026, 0, 1);
    const recent = new Date(2026, 5, 1);
    await repo.create(makeDecision({ id: 'old', createdAt: old, updatedAt: old }));
    await repo.create(makeDecision({ id: 'new1', createdAt: recent, updatedAt: recent }));
    await repo.create(
      makeDecision({
        id: 'new2',
        createdAt: new Date(2026, 6, 1),
        updatedAt: new Date(2026, 6, 1),
      })
    );

    const since = await repo.listByScope('app', 'app-1', undefined, {
      since: new Date(2026, 3, 1),
    });
    expect(since.map((d) => d.id).sort()).toEqual(['new1', 'new2']);

    const limited = await repo.listByScope('app', 'app-1', undefined, { limit: 1 });
    expect(limited).toHaveLength(1);
  });
});
