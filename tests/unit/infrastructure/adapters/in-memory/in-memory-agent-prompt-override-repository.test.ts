/**
 * InMemoryAgentPromptOverrideRepository — unit tests (spec 093, task 51).
 *
 * Verifies the unique-(agentType, promptId) constraint, find/upsert/delete
 * round-trip behaviour, and ordering invariants used by the dashboard.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAgentPromptOverrideRepository } from '@/infrastructure/adapters/in-memory/in-memory-agent-prompt-override.repository.js';
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

describe('InMemoryAgentPromptOverrideRepository', () => {
  let repo: InMemoryAgentPromptOverrideRepository;

  beforeEach(() => {
    repo = new InMemoryAgentPromptOverrideRepository();
  });

  it('create + findActive round-trips', async () => {
    const override = makeOverride({ id: 'o1', body: 'hello' });
    await repo.create(override);
    const found = await repo.findActive('feature-agent', 'implement.system');
    expect(found?.id).toBe('o1');
    expect(found?.body).toBe('hello');
  });

  it('findActive returns null when no override exists', async () => {
    expect(await repo.findActive('feature-agent', 'implement.system')).toBeNull();
  });

  it('blocks duplicate (agentType, promptId)', async () => {
    await repo.create(
      makeOverride({ id: 'o1', agentType: 'feature-agent', promptId: 'implement.system' })
    );
    await expect(
      repo.create(
        makeOverride({ id: 'o2', agentType: 'feature-agent', promptId: 'implement.system' })
      )
    ).rejects.toThrow(/already exists/i);
  });

  it('blocks duplicate id', async () => {
    await repo.create(makeOverride({ id: 'same', promptId: 'a.b' }));
    await expect(repo.create(makeOverride({ id: 'same', promptId: 'c.d' }))).rejects.toThrow(
      /already exists/i
    );
  });

  it('update replaces fields in place', async () => {
    const override = makeOverride({ id: 'o1', body: 'v1', version: 1 });
    await repo.create(override);
    const updated = { ...override, body: 'v2', version: 2 };
    await repo.update(updated);
    const found = await repo.findActive(override.agentType, override.promptId);
    expect(found?.body).toBe('v2');
    expect(found?.version).toBe(2);
  });

  it('update throws when id is unknown', async () => {
    await expect(repo.update(makeOverride({ id: 'missing' }))).rejects.toThrow(/not found/i);
  });

  it('delete removes the active row and is a no-op afterwards', async () => {
    await repo.create(makeOverride({ id: 'o1' }));
    await repo.delete('feature-agent', 'implement.system');
    expect(await repo.findActive('feature-agent', 'implement.system')).toBeNull();
    await expect(repo.delete('feature-agent', 'implement.system')).resolves.toBeUndefined();
  });

  it('delete only removes the matching slot', async () => {
    await repo.create(
      makeOverride({ id: 'o1', agentType: 'feature-agent', promptId: 'implement.system' })
    );
    await repo.create(
      makeOverride({ id: 'o2', agentType: 'feature-agent', promptId: 'plan.system' })
    );
    await repo.delete('feature-agent', 'implement.system');
    expect(await repo.findActive('feature-agent', 'implement.system')).toBeNull();
    expect(await repo.findActive('feature-agent', 'plan.system')).not.toBeNull();
  });

  it('listForAgent returns rows sorted by promptId ascending', async () => {
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

  it('listAll returns an empty array when nothing is configured', async () => {
    expect(await repo.listAll()).toEqual([]);
  });

  it('returned rows are defensive copies (mutation does not leak back)', async () => {
    await repo.create(makeOverride({ id: 'o1', body: 'original' }));
    const found = await repo.findActive('feature-agent', 'implement.system');
    expect(found).not.toBeNull();
    found!.body = 'mutated';
    const refetched = await repo.findActive('feature-agent', 'implement.system');
    expect(refetched?.body).toBe('original');
  });
});
