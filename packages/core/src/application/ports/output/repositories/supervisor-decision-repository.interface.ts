/**
 * SupervisorDecision Repository Interface (Output Port)
 *
 * Defines the contract for SupervisorDecision persistence (spec 093).
 * Append-only audit records — no `update` method, no soft-delete.
 * Every list query MUST be scoped by scopeType/scopeId (NFR-7).
 */

import type { SupervisorDecision } from '../../../../domain/generated/output.js';

/** Filter options for listing supervisor decisions. */
export interface SupervisorDecisionListFilters {
  /** Limit results to decisions with `created_at >= since` */
  since?: Date;
  /** Maximum number of rows to return */
  limit?: number;
}

/**
 * Repository contract for SupervisorDecision persistence.
 *
 * Implementations MUST treat rows as immutable — no update, no delete.
 */
export interface ISupervisorDecisionRepository {
  /** Persist a new decision. Throws on duplicate id. */
  create(decision: SupervisorDecision): Promise<void>;

  /** Find one decision by id. */
  findById(id: string): Promise<SupervisorDecision | null>;

  /**
   * List all decisions for a given source event ordered by createdAt asc
   * (so the audit drawer can show them chronologically).
   */
  listBySourceEvent(sourceEventKind: string, sourceEventId: string): Promise<SupervisorDecision[]>;

  /**
   * List decisions produced by a specific supervisor run.
   * Used by the per-run audit view.
   */
  listBySupervisorRun(supervisorRunId: string): Promise<SupervisorDecision[]>;

  /**
   * List decisions for a scope (and optionally a feature) ordered by
   * createdAt desc. Always scope-qualified.
   */
  listByScope(
    scopeType: string,
    scopeId: string | undefined,
    featureId: string | undefined,
    filters?: SupervisorDecisionListFilters
  ): Promise<SupervisorDecision[]>;

  /**
   * List the most recent decisions across every scope, newest first.
   *
   * Powers the top-level /supervisor dashboard (FR-32). The audit log
   * still owns long-term retention; this is a convenience for the
   * "what just happened?" view.
   */
  listRecent(limit: number): Promise<SupervisorDecision[]>;
}
