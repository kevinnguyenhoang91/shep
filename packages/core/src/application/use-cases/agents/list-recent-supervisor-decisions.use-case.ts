/**
 * ListRecentSupervisorDecisionsUseCase
 *
 * Returns the most recent {@link SupervisorDecision} rows across every
 * scope, newest first. Powers the "Recent decisions" section of the
 * top-level /supervisor dashboard (FR-32).
 *
 * Long-term audit retention is owned by activity_log; this is a thin
 * convenience read for the dashboard.
 */

import { inject, injectable } from 'tsyringe';

import type { ISupervisorDecisionRepository } from '../../ports/output/repositories/supervisor-decision-repository.interface.js';
import type { SupervisorDecision } from '../../../domain/generated/output.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

export interface ListRecentSupervisorDecisionsInput {
  limit?: number;
}

@injectable()
export class ListRecentSupervisorDecisionsUseCase {
  constructor(
    @inject('ISupervisorDecisionRepository')
    private readonly decisionRepository: ISupervisorDecisionRepository
  ) {}

  async execute(input: ListRecentSupervisorDecisionsInput = {}): Promise<SupervisorDecision[]> {
    const requested = input.limit ?? DEFAULT_LIMIT;
    const limit = Math.min(MAX_LIMIT, Math.max(1, requested));
    return this.decisionRepository.listRecent(limit);
  }
}
