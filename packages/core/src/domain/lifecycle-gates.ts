/**
 * Lifecycle gate constants for feature dependency blocking and
 * exploration mode transition validation.
 *
 * Centralises membership checks used by:
 * - CreateFeatureUseCase / CheckAndUnblockFeaturesUseCase (dependency gates)
 * - PromoteExplorationUseCase (exploration mode transitions)
 */

import { SdlcLifecycle } from './generated/output';
import type { Feature } from './generated/output';

/**
 * Lifecycle values that mean a feature's work is finished and has landed.
 *
 * Only Maintain qualifies. The merge node is explicit about this: it sets
 * Maintain when the branch actually merged and Review when the PR is still
 * open (`merged ? Maintain : Review`). Every other lifecycle — including
 * Implementation and Review — describes work that can still change, or that
 * may never land at all if the PR is closed.
 *
 * A parent whose lifecycle is a member of this set satisfies Gate 1:
 * directly-blocked children may transition from Blocked to Started.
 */
export const COMPLETED_LIFECYCLES = new Set<SdlcLifecycle>([SdlcLifecycle.Maintain]);

/**
 * Does a parent feature's progress satisfy the dependency gate for its children?
 *
 * This is the single predicate every dependency decision must use — creating a
 * child, starting a Pending child, reparenting, and auto-unblocking. Comparing
 * against COMPLETED_LIFECYCLES directly misses the Archived case below.
 *
 * A child is released only once its parent's work is DONE, because the child
 * rebases onto that work before it starts: releasing early would build the
 * child on commits that are still being rewritten, or on a branch whose PR is
 * never merged.
 *
 * Archived is treated as a filing concern, not a rollback of progress: features
 * are auto-archived a configurable delay after reaching Maintain, so a parent
 * that completed and was then archived MUST still release its children —
 * `previousLifecycle` carries the progress it had when it was archived. A parent
 * archived *before* completing keeps its children blocked, because its work
 * never landed.
 *
 * @param parent - The parent feature (only its lifecycle fields are read).
 * @returns True when direct children may leave Blocked.
 */
export function satisfiesDependencyGate(
  parent: Pick<Feature, 'lifecycle'> & Partial<Pick<Feature, 'previousLifecycle'>>
): boolean {
  if (parent.lifecycle === SdlcLifecycle.Archived) {
    return (
      parent.previousLifecycle !== undefined && COMPLETED_LIFECYCLES.has(parent.previousLifecycle)
    );
  }

  return COMPLETED_LIFECYCLES.has(parent.lifecycle);
}

/**
 * Valid lifecycle transitions FROM the Exploring state.
 *
 * An exploration feature may transition to:
 * - Implementation: promote to Fast mode (skip SDLC, keep prototype code)
 * - Requirements: promote to Regular mode (full SDLC from requirements phase)
 * - Deleting: discard the exploration and clean up worktree/branch
 *
 * The self-loop (Exploring -> Exploring) for feedback iterations is implicit —
 * the lifecycle stays Exploring during iterations, so no transition occurs.
 * Exploring has no approval gates since exploration bypasses SDLC.
 */
export const EXPLORING_TRANSITIONS = new Set<SdlcLifecycle>([
  SdlcLifecycle.Implementation,
  SdlcLifecycle.Requirements,
  SdlcLifecycle.Deleting,
]);
