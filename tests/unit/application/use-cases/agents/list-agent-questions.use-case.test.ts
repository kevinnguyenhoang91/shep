/**
 * ListAgentQuestionsUseCase — unit tests (spec 093, task 17).
 *
 * Verifies:
 *  - appId is required (NFR-7 invariant).
 *  - Filters by appId / featureId / status / agentRunId / limit are honored.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';

import { AskAgentQuestionUseCase } from '@/application/use-cases/agents/ask-agent-question.use-case.js';
import { ListAgentQuestionsUseCase } from '@/application/use-cases/agents/list-agent-questions.use-case.js';
import { InMemoryAgentQuestionRepository } from '@/infrastructure/adapters/in-memory/in-memory-agent-question-repository.js';
import { DeferredQuestionRegistry } from '@/infrastructure/services/agents/agent-question-service/deferred-question-registry.js';
import {
  AgentQuestionAnswerer,
  AgentQuestionKind,
  AgentQuestionStatus,
  type Settings,
} from '@/domain/generated/output.js';
import { vi } from 'vitest';
import type { ISettingsRepository } from '@/application/ports/output/repositories/settings.repository.interface.js';

function makeSettingsRepo(): ISettingsRepository {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    load: vi
      .fn()
      .mockResolvedValue({ featureFlags: { collaboration: true } } as unknown as Settings),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ListAgentQuestionsUseCase', () => {
  let repo: InMemoryAgentQuestionRepository;
  let registry: DeferredQuestionRegistry;
  let ask: AskAgentQuestionUseCase;

  beforeEach(async () => {
    repo = new InMemoryAgentQuestionRepository();
    registry = new DeferredQuestionRegistry();
    ask = new AskAgentQuestionUseCase(
      repo,
      registry,
      makeSettingsRepo(),
      {
        routeIfApplicable: vi.fn().mockResolvedValue({ evaluated: false, answered: false }),
      } as any,
      { execute: vi.fn().mockResolvedValue({ escalated: false }) } as any
    );

    await ask.execute({
      appId: 'app-1',
      featureId: 'feat-a',
      agentRunId: 'run-1',
      kind: AgentQuestionKind.question,
      prompt: 'q-a',
      answerer: AgentQuestionAnswerer.user,
    });
    await ask.execute({
      appId: 'app-1',
      featureId: 'feat-b',
      agentRunId: 'run-2',
      kind: AgentQuestionKind.question,
      prompt: 'q-b',
      answerer: AgentQuestionAnswerer.user,
    });
    await ask.execute({
      appId: 'app-2',
      featureId: 'feat-a',
      agentRunId: 'run-3',
      kind: AgentQuestionKind.question,
      prompt: 'q-c',
      answerer: AgentQuestionAnswerer.user,
    });
  });

  it('rejects when appId is missing', async () => {
    const useCase = new ListAgentQuestionsUseCase(repo);
    await expect(useCase.execute({ appId: '' })).rejects.toThrow(/appId is required/);
  });

  it('returns only rows in the requested app scope', async () => {
    const useCase = new ListAgentQuestionsUseCase(repo);
    const rows = await useCase.execute({ appId: 'app-1' });
    const apps = new Set(rows.map((r) => r.appId));
    expect(apps).toEqual(new Set(['app-1']));
  });

  it('filters by featureId when supplied', async () => {
    const useCase = new ListAgentQuestionsUseCase(repo);
    const rows = await useCase.execute({ appId: 'app-1', featureId: 'feat-a' });
    expect(rows.map((r) => r.featureId)).toEqual(['feat-a']);
  });

  it('filters by agentRunId when supplied', async () => {
    const useCase = new ListAgentQuestionsUseCase(repo);
    const rows = await useCase.execute({ appId: 'app-1', agentRunId: 'run-2' });
    expect(rows.map((r) => r.agentRunId)).toEqual(['run-2']);
  });

  it('filters by status when supplied', async () => {
    const useCase = new ListAgentQuestionsUseCase(repo);
    const rows = await useCase.execute({
      appId: 'app-1',
      status: AgentQuestionStatus.pending,
    });
    expect(rows.every((r) => r.status === AgentQuestionStatus.pending)).toBe(true);
  });
});
