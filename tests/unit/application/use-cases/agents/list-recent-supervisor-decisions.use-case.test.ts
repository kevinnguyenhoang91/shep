/**
 * ListRecentSupervisorDecisionsUseCase — unit tests (spec 093, task 48).
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';

import { ListRecentSupervisorDecisionsUseCase } from '@/application/use-cases/agents/list-recent-supervisor-decisions.use-case.js';
import { InMemorySupervisorDecisionRepository } from '@/infrastructure/adapters/in-memory/in-memory-supervisor-decision-repository.js';
import { SupervisorScopeType, SupervisorVerdict } from '@/domain/generated/output.js';
import type { SupervisorDecision } from '@/domain/generated/output.js';

function makeDecision(overrides: Partial<SupervisorDecision> = {}): SupervisorDecision {
  const now = new Date();
  return {
    id: randomUUID(),
    scopeType: SupervisorScopeType.global,
    supervisorRunId: 'sup-run-1',
    sourceEventKind: 'gate',
    sourceEventId: 'gate-1',
    verdict: SupervisorVerdict.advise,
    rationale: 'looks fine to me',
    modelId: 'claude-sonnet-4',
    promptVersion: 'v1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('ListRecentSupervisorDecisionsUseCase', () => {
  let repo: InMemorySupervisorDecisionRepository;
  let listRecent: ListRecentSupervisorDecisionsUseCase;

  beforeEach(() => {
    repo = new InMemorySupervisorDecisionRepository();
    listRecent = new ListRecentSupervisorDecisionsUseCase(repo);
  });

  it('returns [] when no decisions are persisted', async () => {
    expect(await listRecent.execute()).toEqual([]);
  });

  it('returns decisions newest first', async () => {
    const oldest = makeDecision({ createdAt: new Date(2026, 0, 1), rationale: 'oldest' });
    const middle = makeDecision({ createdAt: new Date(2026, 1, 1), rationale: 'middle' });
    const newest = makeDecision({ createdAt: new Date(2026, 2, 1), rationale: 'newest' });
    await repo.create(oldest);
    await repo.create(middle);
    await repo.create(newest);

    const recent = await listRecent.execute();
    expect(recent.map((d) => d.rationale)).toEqual(['newest', 'middle', 'oldest']);
  });

  it('honours an explicit limit', async () => {
    for (let i = 0; i < 5; i += 1) {
      await repo.create(
        makeDecision({ createdAt: new Date(2026, 0, i + 1), rationale: `decision-${i}` })
      );
    }
    const recent = await listRecent.execute({ limit: 2 });
    expect(recent).toHaveLength(2);
  });

  it('clamps limit to the [1, 200] range', async () => {
    await repo.create(makeDecision());
    const tooLow = await listRecent.execute({ limit: 0 });
    const tooHigh = await listRecent.execute({ limit: 9999 });
    expect(tooLow.length).toBeGreaterThanOrEqual(1);
    expect(tooHigh.length).toBeLessThanOrEqual(200);
  });
});
