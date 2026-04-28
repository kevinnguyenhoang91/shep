/**
 * AskAgentQuestionUseCase
 *
 * Persists a new {@link AgentQuestion} and, for blocking-kind questions,
 * registers an in-process awaiter so the caller (typically the SDK V2
 * `canUseTool` callback) can `await` until {@link AnswerAgentQuestionUseCase}
 * settles it.
 *
 * Feature-flag short-circuit: with `featureFlags.collaboration` off, the
 * use case returns `{ enabled: false }` without persisting or registering
 * anything (NFR-14 byte-identical default).
 */

import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'node:crypto';

import type { IAgentQuestionRepository } from '../../ports/output/repositories/agent-question-repository.interface.js';
import type { ISettingsRepository } from '../../ports/output/repositories/settings.repository.interface.js';
import type {
  IDeferredQuestionRegistry,
  AskAgentQuestionInput,
} from '../../ports/output/agents/agent-question-service.interface.js';
import {
  AgentQuestionKind,
  AgentQuestionStatus,
  type AgentQuestion,
} from '../../../domain/generated/output.js';

export interface AskAgentQuestionResult {
  /** True when the collaboration feature flag is on and the question was persisted. */
  enabled: boolean;
  /** The persisted question — populated only when `enabled` is true. */
  question?: AgentQuestion;
  /**
   * Awaiter Promise — populated only for blocking-kind questions when the
   * flag is on. Resolves with the answer string when an
   * {@link AnswerAgentQuestionUseCase} call settles the deferred entry,
   * rejects on cancel/timeout.
   */
  awaiter?: Promise<string>;
}

@injectable()
export class AskAgentQuestionUseCase {
  constructor(
    @inject('IAgentQuestionRepository')
    private readonly questionRepository: IAgentQuestionRepository,
    @inject('IDeferredQuestionRegistry')
    private readonly deferredRegistry: IDeferredQuestionRegistry,
    @inject('ISettingsRepository')
    private readonly settings: ISettingsRepository
  ) {}

  async execute(input: AskAgentQuestionInput): Promise<AskAgentQuestionResult> {
    const flagOn = await this.isCollaborationEnabled();
    if (!flagOn) return { enabled: false };

    const now = new Date();
    const question: AgentQuestion = {
      id: randomUUID(),
      appId: input.appId,
      featureId: input.featureId,
      agentRunId: input.agentRunId,
      kind: input.kind,
      prompt: input.prompt,
      optionsJson:
        input.options && input.options.length > 0 ? JSON.stringify(input.options) : undefined,
      defaultAnswer: input.defaultAnswer,
      answerer: input.answerer,
      status: AgentQuestionStatus.pending,
      answer: undefined,
      answeredBy: undefined,
      answeredAt: undefined,
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
    };

    await this.questionRepository.create(question);

    const result: AskAgentQuestionResult = { enabled: true, question };
    if (input.kind === AgentQuestionKind.blocking) {
      const timeoutMs =
        input.expiresAt instanceof Date
          ? Math.max(input.expiresAt.getTime() - now.getTime(), 1)
          : undefined;
      result.awaiter = this.deferredRegistry.register(
        question.id,
        {
          appId: input.appId,
          featureId: input.featureId,
          agentRunId: input.agentRunId,
        },
        timeoutMs
      );
    }
    return result;
  }

  private async isCollaborationEnabled(): Promise<boolean> {
    const settings = await this.settings.load();
    return settings?.featureFlags?.collaboration === true;
  }
}
