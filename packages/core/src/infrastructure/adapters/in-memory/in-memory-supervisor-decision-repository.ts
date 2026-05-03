/**
 * In-Memory SupervisorDecision Repository
 *
 * Test-friendly adapter for {@link ISupervisorDecisionRepository}.
 * Append-only — no update or delete.
 */

import { injectable } from 'tsyringe';
import type {
  ISupervisorDecisionRepository,
  SupervisorDecisionListFilters,
} from '@/application/ports/output/repositories/supervisor-decision-repository.interface.js';
import type { SupervisorDecision } from '@/domain/generated/output.js';

function toMillis(value: SupervisorDecision['createdAt']): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  return 0;
}

@injectable()
export class InMemorySupervisorDecisionRepository implements ISupervisorDecisionRepository {
  private readonly decisions = new Map<string, SupervisorDecision>();

  async create(decision: SupervisorDecision): Promise<void> {
    if (this.decisions.has(decision.id)) {
      throw new Error(`SupervisorDecision with id "${decision.id}" already exists`);
    }
    this.decisions.set(decision.id, { ...decision });
  }

  async findById(id: string): Promise<SupervisorDecision | null> {
    const row = this.decisions.get(id);
    return row ? { ...row } : null;
  }

  async listBySourceEvent(
    sourceEventKind: string,
    sourceEventId: string
  ): Promise<SupervisorDecision[]> {
    const result: SupervisorDecision[] = [];
    for (const row of this.decisions.values()) {
      if (row.sourceEventKind !== sourceEventKind) continue;
      if (row.sourceEventId !== sourceEventId) continue;
      result.push({ ...row });
    }
    result.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    return result;
  }

  async listBySupervisorRun(supervisorRunId: string): Promise<SupervisorDecision[]> {
    const result: SupervisorDecision[] = [];
    for (const row of this.decisions.values()) {
      if (row.supervisorRunId !== supervisorRunId) continue;
      result.push({ ...row });
    }
    result.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    return result;
  }

  async listByScope(
    scopeType: string,
    scopeId: string | undefined,
    featureId: string | undefined,
    filters: SupervisorDecisionListFilters = {}
  ): Promise<SupervisorDecision[]> {
    const sinceMillis = filters.since ? filters.since.getTime() : undefined;
    const result: SupervisorDecision[] = [];

    for (const row of this.decisions.values()) {
      if (row.scopeType !== scopeType) continue;
      if ((row.scopeId ?? undefined) !== (scopeId ?? undefined)) continue;
      if (featureId !== undefined && row.featureId !== featureId) continue;
      if (sinceMillis !== undefined && toMillis(row.createdAt) < sinceMillis) continue;
      result.push({ ...row });
    }

    result.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return filters.limit !== undefined ? result.slice(0, filters.limit) : result;
  }

  async listRecent(limit: number): Promise<SupervisorDecision[]> {
    return [...this.decisions.values()]
      .map((row) => ({ ...row }))
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      .slice(0, Math.max(0, limit));
  }
}
