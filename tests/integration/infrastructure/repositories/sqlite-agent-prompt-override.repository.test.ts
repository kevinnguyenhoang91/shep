/**
 * SQLiteAgentPromptOverrideRepository — integration tests (spec 093, task 51).
 *
 * Verifies the unique constraint, persistence round-trip, ordering, and
 * delete semantics against a real (in-memory) SQLite database with
 * migration 098 applied.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createInMemoryDatabase } from '../../../helpers/database.helper.js';
import { runSQLiteMigrations } from '@/infrastructure/persistence/sqlite/migrations.js';
import { SQLiteAgentPromptOverrideRepository } from '@/infrastructure/repositories/sqlite-agent-prompt-override.repository.js';
import type { AgentPromptOverride } from '@/domain/generated/output.js';

function makeOverride(overrides: Partial<AgentPromptOverride> = {}): AgentPromptOverride {
  const now = new Date();
  return {
    id: overrides.id ?? `ovr-${Math.random().toString(36).slice(2, 9)}`,
    agentType: 'feature-agent',
    promptId: 'implement.system',
    body: 'overridden body',
    version: 1,
    createdBy: 'user',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as AgentPromptOverride;
}

describe('SQLiteAgentPromptOverrideRepository', () => {
  let db: Database.Database;
  let repo: SQLiteAgentPromptOverrideRepository;

  beforeEach(async () => {
    db = createInMemoryDatabase();
    await runSQLiteMigrations(db);
    repo = new SQLiteAgentPromptOverrideRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('create + findActive round-trips body and metadata', async () => {
    await repo.create(makeOverride({ id: 'o1', body: 'hello world' }));
    const found = await repo.findActive('feature-agent', 'implement.system');
    expect(found?.id).toBe('o1');
    expect(found?.body).toBe('hello world');
    expect(found?.version).toBe(1);
    expect(found?.createdBy).toBe('user');
  });

  it('findActive returns null when no row exists', async () => {
    expect(await repo.findActive('feature-agent', 'implement.system')).toBeNull();
  });

  it('rejects duplicate (agent_type, prompt_id) via the unique index', async () => {
    await repo.create(
      makeOverride({ id: 'o1', agentType: 'feature-agent', promptId: 'implement.system' })
    );
    await expect(
      repo.create(
        makeOverride({ id: 'o2', agentType: 'feature-agent', promptId: 'implement.system' })
      )
    ).rejects.toThrow();
  });

  it('update replaces body and bumps version in place', async () => {
    const initial = makeOverride({ id: 'o1', body: 'v1', version: 1 });
    await repo.create(initial);
    await repo.update({ ...initial, body: 'v2', version: 2, updatedAt: new Date() });
    const found = await repo.findActive('feature-agent', 'implement.system');
    expect(found?.body).toBe('v2');
    expect(found?.version).toBe(2);
  });

  it('delete removes the row and is idempotent', async () => {
    await repo.create(makeOverride({ id: 'o1' }));
    await repo.delete('feature-agent', 'implement.system');
    expect(await repo.findActive('feature-agent', 'implement.system')).toBeNull();
    await expect(repo.delete('feature-agent', 'implement.system')).resolves.toBeUndefined();
  });

  it('listForAgent returns rows sorted by promptId', async () => {
    await repo.create(makeOverride({ id: 'o1', promptId: 'b.system' }));
    await repo.create(makeOverride({ id: 'o2', promptId: 'a.system' }));
    await repo.create(
      makeOverride({ id: 'o3', agentType: 'supervisor-agent', promptId: 'evaluator.system' })
    );

    const result = await repo.listForAgent('feature-agent');
    expect(result.map((r) => r.promptId)).toEqual(['a.system', 'b.system']);
  });

  it('listAll groups by agentType then promptId', async () => {
    await repo.create(makeOverride({ id: 'o1', agentType: 'feature-agent', promptId: 'b' }));
    await repo.create(makeOverride({ id: 'o2', agentType: 'feature-agent', promptId: 'a' }));
    await repo.create(makeOverride({ id: 'o3', agentType: 'supervisor-agent', promptId: 'a' }));

    const result = await repo.listAll();
    expect(result.map((r) => `${r.agentType}/${r.promptId}`)).toEqual([
      'feature-agent/a',
      'feature-agent/b',
      'supervisor-agent/a',
    ]);
  });

  it('listAll returns empty array when nothing is configured', async () => {
    expect(await repo.listAll()).toEqual([]);
  });
});
