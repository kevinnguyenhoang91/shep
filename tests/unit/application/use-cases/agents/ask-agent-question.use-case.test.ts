/**
 * AskAgentQuestionUseCase — unit tests (spec 093, task 17).
 *
 * Verifies:
 *  - Flag-off short-circuit (no persist, no register, returns enabled=false).
 *  - Flag-on persist + return of the row for non-blocking kinds (no awaiter).
 *  - Flag-on persist + register awaiter for blocking kinds (awaiter resolves).
 *  - The persisted row stores options as JSON when supplied.
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AskAgentQuestionUseCase } from '@/application/use-cases/agents/ask-agent-question.use-case.js';
import { InMemoryAgentQuestionRepository } from '@/infrastructure/adapters/in-memory/in-memory-agent-question-repository.js';
import { DeferredQuestionRegistry } from '@/infrastructure/services/agents/agent-question-service/deferred-question-registry.js';
import type { ISettingsRepository } from '@/application/ports/output/repositories/settings.repository.interface.js';
import {
  AgentQuestionAnswerer,
  AgentQuestionKind,
  AgentQuestionStatus,
  type Settings,
} from '@/domain/generated/output.js';

function makeSettingsRepo(collaboration: boolean): ISettingsRepository {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue({ featureFlags: { collaboration } } as unknown as Settings),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AskAgentQuestionUseCase', () => {
  let repo: InMemoryAgentQuestionRepository;
  let registry: DeferredQuestionRegistry;

  beforeEach(() => {
    repo = new InMemoryAgentQuestionRepository();
    registry = new DeferredQuestionRegistry();
  });

  it('returns enabled=false and persists nothing when feature flag is off', async () => {
    const useCase = new AskAgentQuestionUseCase(repo, registry, makeSettingsRepo(false));

    const result = await useCase.execute({
      appId: 'app-1',
      agentRunId: 'run-1',
      kind: AgentQuestionKind.question,
      prompt: 'Which library?',
      answerer: AgentQuestionAnswerer.user,
    });

    expect(result.enabled).toBe(false);
    expect(result.question).toBeUndefined();
    expect(await repo.listByScope('app-1', undefined)).toHaveLength(0);
  });

  it('persists a non-blocking question and does NOT return an awaiter', async () => {
    const useCase = new AskAgentQuestionUseCase(repo, registry, makeSettingsRepo(true));

    const result = await useCase.execute({
      appId: 'app-1',
      agentRunId: 'run-1',
      kind: AgentQuestionKind.question,
      prompt: 'Which library?',
      answerer: AgentQuestionAnswerer.user,
      options: ['lib-a', 'lib-b'],
    });

    expect(result.enabled).toBe(true);
    expect(result.question).toBeDefined();
    expect(result.awaiter).toBeUndefined();
    expect(result.question?.status).toBe(AgentQuestionStatus.pending);
    expect(result.question?.optionsJson).toBe('["lib-a","lib-b"]');

    const stored = await repo.listByScope('app-1', undefined);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(result.question?.id);
  });

  it('persists a blocking question AND registers an awaiter that resolves on registry.resolve', async () => {
    const useCase = new AskAgentQuestionUseCase(repo, registry, makeSettingsRepo(true));

    const result = await useCase.execute({
      appId: 'app-1',
      agentRunId: 'run-1',
      kind: AgentQuestionKind.blocking,
      prompt: 'Approve merge?',
      answerer: AgentQuestionAnswerer.user,
    });

    expect(result.enabled).toBe(true);
    expect(result.awaiter).toBeDefined();
    expect(registry.has(result.question!.id)).toBe(true);

    registry.resolve(result.question!.id, 'approve');
    await expect(result.awaiter).resolves.toBe('approve');
  });
});
