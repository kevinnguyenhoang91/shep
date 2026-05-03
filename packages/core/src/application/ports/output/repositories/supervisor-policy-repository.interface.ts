/**
 * SupervisorPolicy Repository Interface (Output Port)
 *
 * Defines the contract for SupervisorPolicy persistence (spec 093).
 * Resolution is per-scope (global/repo/app) with optional per-feature override:
 * {@link findPolicyForScope} returns the feature-scoped policy first
 * and falls back to the scope-level policy when no feature row exists.
 */

import type { SupervisorPolicy } from '../../../../domain/generated/output.js';

/**
 * Repository contract for SupervisorPolicy persistence.
 *
 * Implementations MUST:
 * - Enforce uniqueness on (scopeType, scopeId, featureId) at the storage layer.
 * - Implement scope fallback in {@link findPolicyForScope} —
 *   feature row first, then scope-level row.
 */
export interface ISupervisorPolicyRepository {
  /** Create a new policy. Throws on uniqueness conflict. */
  create(policy: SupervisorPolicy): Promise<void>;

  /** Replace an existing policy in place by id. */
  update(policy: SupervisorPolicy): Promise<void>;

  /** Delete a policy by id. No-op if it does not exist. */
  delete(id: string): Promise<void>;

  /** Find one policy by id. */
  findById(id: string): Promise<SupervisorPolicy | null>;

  /** Find the scope-level policy (featureId IS NULL) for the given scope. */
  findByScope(scopeType: string, scopeId?: string): Promise<SupervisorPolicy | null>;

  /** Find the feature-scoped policy within a given scope. */
  findByScopeAndFeature(
    scopeType: string,
    scopeId: string | undefined,
    featureId: string
  ): Promise<SupervisorPolicy | null>;

  /**
   * Resolve the effective policy for a scope: feature-scoped row first,
   * falling back to the scope-level row when no feature override exists.
   * Returns null when neither is configured.
   */
  findPolicyForScope(
    scopeType: string,
    scopeId: string | undefined,
    featureId: string | undefined
  ): Promise<SupervisorPolicy | null>;

  /** List all policies for a scope (both scope-level and feature-scoped). */
  listByScope(scopeType: string, scopeId?: string): Promise<SupervisorPolicy[]>;

  /**
   * List every persisted policy across all scope kinds.
   *
   * Powers the top-level /supervisor dashboard (FR-31). Implementations
   * SHOULD return rows ordered by `(scopeType, scopeId NULLS FIRST, featureId NULLS FIRST)`
   * so the dashboard renders deterministically.
   */
  listAll(): Promise<SupervisorPolicy[]>;
}
