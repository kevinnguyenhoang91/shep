/**
 * ListAgentQuestionsUseCase
 *
 * Scope-safe read for the unified agent-question inbox. Always filters
 * by `appId` (NFR-7 cross-app isolation). Optional `featureId`,
 * `agentRunId`, and `status` narrow the result. The collaboration
 * feature flag does NOT gate reads — when the flag is off, no rows have
 * been written, so the repository naturally returns an empty list.
 */

import { inject, injectable } from 'tsyringe';

import type { IAgentQuestionRepository } from '../../ports/output/repositories/agent-question-repository.interface.js';
import type { ListAgentQuestionsFilter } from '../../ports/output/agents/agent-question-service.interface.js';
import type { AgentQuestion } from '../../../domain/generated/output.js';

@injectable()
export class ListAgentQuestionsUseCase {
  constructor(
    @inject('IAgentQuestionRepository')
    private readonly questionRepository: IAgentQuestionRepository
  ) {}

  async execute(filter: ListAgentQuestionsFilter): Promise<AgentQuestion[]> {
    if (!filter.appId) {
      throw new Error('appId is required to list agent questions (NFR-7 scope isolation)');
    }

    if (filter.agentRunId) {
      const rows = await this.questionRepository.listByAgentRun(filter.appId, filter.agentRunId);
      return applyClientFilters(rows, filter);
    }

    return this.questionRepository.listByScope(filter.appId, filter.featureId, {
      status: filter.status,
      limit: filter.limit,
    });
  }
}

function applyClientFilters(
  rows: AgentQuestion[],
  filter: ListAgentQuestionsFilter
): AgentQuestion[] {
  let result = rows;
  if (filter.status !== undefined) {
    result = result.filter((q) => q.status === filter.status);
  }
  if (filter.featureId !== undefined) {
    result = result.filter((q) => q.featureId === filter.featureId);
  }
  if (filter.limit !== undefined) {
    result = result.slice(0, filter.limit);
  }
  return result;
}
