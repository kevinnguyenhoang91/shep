/**
 * Agent prompt override use cases — unit tests (spec 093, task 52).
 *
 * Round-trip: list → upsert → list (override visible) → delete → list
 * (back to bundled). Validates that unknown slots are rejected.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';

import { ListAgentPromptsUseCase } from '@/application/use-cases/agents/list-agent-prompts.use-case.js';
import { UpsertAgentPromptOverrideUseCase } from '@/application/use-cases/agents/upsert-agent-prompt-override.use-case.js';
import { DeleteAgentPromptOverrideUseCase } from '@/application/use-cases/agents/delete-agent-prompt-override.use-case.js';
import { InMemoryAgentPromptOverrideRepository } from '@/infrastructure/adapters/in-memory/in-memory-agent-prompt-override.repository.js';
import { InMemoryCustomAgentRepository } from '@/infrastructure/adapters/in-memory/in-memory-custom-agent.repository.js';

describe('Agent prompt override use cases', () => {
  let repo: InMemoryAgentPromptOverrideRepository;
  let listPrompts: ListAgentPromptsUseCase;
  let upsert: UpsertAgentPromptOverrideUseCase;
  let remove: DeleteAgentPromptOverrideUseCase;

  beforeEach(() => {
    repo = new InMemoryAgentPromptOverrideRepository();
    const customAgentRepo = new InMemoryCustomAgentRepository();
    listPrompts = new ListAgentPromptsUseCase(repo, customAgentRepo);
    upsert = new UpsertAgentPromptOverrideUseCase(repo, customAgentRepo);
    remove = new DeleteAgentPromptOverrideUseCase(repo);
  });

  it('lists builtin agent types', () => {
    const types = listPrompts.listAgentTypes();
    const names = types.map((t) => t.agentType);
    expect(names).toContain('feature-agent');
    expect(names).toContain('supervisor-agent');
  });

  it('returns bundled prompts when no override exists', async () => {
    const entries = await listPrompts.execute({ agentType: 'supervisor-agent' });
    expect(entries.length).toBeGreaterThan(0);
    const evaluator = entries.find((e) => e.promptId === 'evaluator.system');
    expect(evaluator).toBeDefined();
    expect(evaluator?.hasOverride).toBe(false);
    expect(evaluator?.bundledBody).toBe(evaluator?.effectiveBody);
  });

  it('returns the override body in effectiveBody after upsert', async () => {
    await upsert.execute({
      agentType: 'supervisor-agent',
      promptId: 'evaluator.system',
      body: 'YOU ARE A NEW SUPERVISOR',
    });

    const entries = await listPrompts.execute({ agentType: 'supervisor-agent' });
    const evaluator = entries.find((e) => e.promptId === 'evaluator.system');
    expect(evaluator?.hasOverride).toBe(true);
    expect(evaluator?.effectiveBody).toBe('YOU ARE A NEW SUPERVISOR');
    expect(evaluator?.bundledBody).not.toBe('YOU ARE A NEW SUPERVISOR');
  });

  it('upserts twice — second call updates in place and bumps version', async () => {
    const first = await upsert.execute({
      agentType: 'feature-agent',
      promptId: 'implement.system',
      body: 'v1',
    });
    const second = await upsert.execute({
      agentType: 'feature-agent',
      promptId: 'implement.system',
      body: 'v2',
    });

    expect(first.id).toBe(second.id);
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(second.body).toBe('v2');
  });

  it('rejects unknown prompt slots', async () => {
    await expect(
      upsert.execute({
        agentType: 'feature-agent',
        promptId: 'totally-made-up',
        body: 'irrelevant',
      })
    ).rejects.toThrow(/Unknown prompt slot/);
  });

  it('rejects empty body', async () => {
    await expect(
      upsert.execute({
        agentType: 'feature-agent',
        promptId: 'implement.system',
        body: '',
      })
    ).rejects.toThrow(/non-empty/);
  });

  it('delete returns the slot to bundled', async () => {
    await upsert.execute({
      agentType: 'feature-agent',
      promptId: 'implement.system',
      body: 'overridden',
    });
    let entries = await listPrompts.execute({ agentType: 'feature-agent' });
    expect(entries.find((e) => e.promptId === 'implement.system')?.effectiveBody).toBe(
      'overridden'
    );

    await remove.execute({ agentType: 'feature-agent', promptId: 'implement.system' });
    entries = await listPrompts.execute({ agentType: 'feature-agent' });
    const slot = entries.find((e) => e.promptId === 'implement.system');
    expect(slot?.hasOverride).toBe(false);
    expect(slot?.effectiveBody).toBe(slot?.bundledBody);
  });

  it('delete is a no-op when no override exists', async () => {
    await expect(
      remove.execute({ agentType: 'feature-agent', promptId: 'implement.system' })
    ).resolves.toBeUndefined();
  });
});
