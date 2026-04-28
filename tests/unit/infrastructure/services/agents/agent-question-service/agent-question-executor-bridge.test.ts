/**
 * AgentQuestionExecutorBridge — integration test (spec 093, task 19).
 *
 * Wires the real AskAgentQuestionUseCase + InMemoryAgentQuestionRepository
 * + DeferredQuestionRegistry to verify the canUseTool round-trip:
 *  - With flag ON, an AskUserQuestion-style call writes one
 *    agent_questions row of kind=blocking and awaits answer resolution.
 *  - With flag OFF, the bridge returns null (caller falls through to
 *    legacy onUserQuestion path).
 *  - Resolving via AnswerAgentQuestionUseCase makes the bridge return
 *    the SDK-shaped answers map.
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AgentQuestionExecutorBridge } from '@/infrastructure/services/agents/agent-question-service/agent-question-executor-bridge.js';
import { AskAgentQuestionUseCase } from '@/application/use-cases/agents/ask-agent-question.use-case.js';
import { AnswerAgentQuestionUseCase } from '@/application/use-cases/agents/answer-agent-question.use-case.js';
import { InMemoryAgentQuestionRepository } from '@/infrastructure/adapters/in-memory/in-memory-agent-question-repository.js';
import { DeferredQuestionRegistry } from '@/infrastructure/services/agents/agent-question-service/deferred-question-registry.js';
import type { ISettingsRepository } from '@/application/ports/output/repositories/settings.repository.interface.js';
import type { IAgentRunRepository } from '@/application/ports/output/agents/agent-run-repository.interface.js';
import type { ApproveAgentRunUseCase } from '@/application/use-cases/agents/approve-agent-run.use-case.js';
import type { RejectAgentRunUseCase } from '@/application/use-cases/agents/reject-agent-run.use-case.js';
import {
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

const noopApprove: ApproveAgentRunUseCase = {
  execute: vi.fn().mockResolvedValue({ approved: true, reason: 'ok' }),
} as unknown as ApproveAgentRunUseCase;
const noopReject: RejectAgentRunUseCase = {
  execute: vi.fn().mockResolvedValue({ rejected: true, reason: 'ok' }),
} as unknown as RejectAgentRunUseCase;

const noopAgentRunRepo: IAgentRunRepository = {
  findById: vi.fn().mockResolvedValue(null),
} as unknown as IAgentRunRepository;

describe('AgentQuestionExecutorBridge', () => {
  let repo: InMemoryAgentQuestionRepository;
  let registry: DeferredQuestionRegistry;

  beforeEach(() => {
    repo = new InMemoryAgentQuestionRepository();
    registry = new DeferredQuestionRegistry();
  });

  it('writes a blocking AgentQuestion and resolves on AnswerAgentQuestionUseCase (flag on)', async () => {
    const settings = makeSettingsRepo(true);
    const ask = new AskAgentQuestionUseCase(
      repo,
      registry,
      settings,
      {
        routeIfApplicable: vi.fn().mockResolvedValue({ evaluated: false, answered: false }),
      } as any,
      { execute: vi.fn().mockResolvedValue({ escalated: false }) } as any
    );
    const answer = new AnswerAgentQuestionUseCase(
      repo,
      registry,
      settings,
      noopAgentRunRepo,
      noopApprove,
      noopReject
    );
    const bridge = new AgentQuestionExecutorBridge(ask, {
      appId: 'app-1',
      featureId: 'feat-1',
      agentRunId: 'run-1',
    });

    const askPromise = bridge.ask({
      toolCallId: 'tu_1',
      questions: [{ question: 'go?', header: 'Go', options: [], multiSelect: false }],
    });

    // Allow the use case to persist + register.
    await Promise.resolve();
    await Promise.resolve();

    const stored = await repo.listByScope('app-1', undefined);
    expect(stored).toHaveLength(1);
    expect(stored[0].kind).toBe(AgentQuestionKind.blocking);

    await answer.execute({
      appId: 'app-1',
      questionId: stored[0].id,
      answer: 'yes',
      answeredBy: 'user:tester',
    });

    const result = await askPromise;
    expect(result).toEqual({ 'go?': 'yes' });

    const after = await repo.findById('app-1', stored[0].id);
    expect(after?.status).toBe(AgentQuestionStatus.answered);
  });

  it('returns null (flag-off) so the executor falls back to legacy path', async () => {
    const settings = makeSettingsRepo(false);
    const ask = new AskAgentQuestionUseCase(
      repo,
      registry,
      settings,
      {
        routeIfApplicable: vi.fn().mockResolvedValue({ evaluated: false, answered: false }),
      } as any,
      { execute: vi.fn().mockResolvedValue({ escalated: false }) } as any
    );
    const bridge = new AgentQuestionExecutorBridge(ask, {
      appId: 'app-1',
      agentRunId: 'run-1',
    });

    const result = await bridge.ask({
      toolCallId: 'tu_1',
      questions: [{ question: 'q', header: 'Q', options: [], multiSelect: false }],
    });

    expect(result).toBeNull();
    expect(await repo.listByScope('app-1', undefined)).toHaveLength(0);
  });

  it('decodes a JSON-encoded answer object to the SDK-shaped map', async () => {
    const settings = makeSettingsRepo(true);
    const ask = new AskAgentQuestionUseCase(
      repo,
      registry,
      settings,
      {
        routeIfApplicable: vi.fn().mockResolvedValue({ evaluated: false, answered: false }),
      } as any,
      { execute: vi.fn().mockResolvedValue({ escalated: false }) } as any
    );
    const answer = new AnswerAgentQuestionUseCase(
      repo,
      registry,
      settings,
      noopAgentRunRepo,
      noopApprove,
      noopReject
    );
    const bridge = new AgentQuestionExecutorBridge(ask, {
      appId: 'app-1',
      agentRunId: 'run-1',
    });

    const askPromise = bridge.ask({
      toolCallId: 'tu_1',
      questions: [
        { question: 'name?', header: 'Name', options: [], multiSelect: false },
        { question: 'age?', header: 'Age', options: [], multiSelect: false },
      ],
    });

    await Promise.resolve();
    await Promise.resolve();
    const stored = await repo.listByScope('app-1', undefined);

    await answer.execute({
      appId: 'app-1',
      questionId: stored[0].id,
      answer: JSON.stringify({ 'name?': 'Ariel', 'age?': '40' }),
      answeredBy: 'user:tester',
    });

    await expect(askPromise).resolves.toEqual({ 'name?': 'Ariel', 'age?': '40' });
  });
});
