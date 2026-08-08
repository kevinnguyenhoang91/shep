/**
 * CheckAndUnblockFeaturesUseCase
 *
 * Evaluates whether blocked direct children of a parent feature are now
 * eligible to start, and if so transitions them to Started, rebases their
 * branches onto the parent branch, and spawns their agents.
 *
 * Business Rules:
 * - Only direct children of parentFeatureId are evaluated (no recursive traversal).
 *   Grandchildren stay Blocked until their own direct parent progresses.
 * - Gate: satisfiesDependencyGate(parent) — Maintain, or Archived-after-completion.
 *   This is the ONLY place the dependency gate is evaluated for a Blocked -> Started
 *   transition — callers delegate here instead of re-deriving it.
 * - Idempotent: already-Started children are not touched; calling execute() twice is safe.
 * - Soft-deleted children are never resurrected (findByParentId includes them so it
 *   can serve cascade deletes).
 * - spawn() is skipped for children missing agentRunId or specPath (defensive guard).
 * - Auto-rebase: each blocked child is brought in sync before its agent spawns, via
 *   SyncFeatureBranchUseCase — onto the base branch once the parent's work landed
 *   there, onto the parent branch while it has not. Rebase failures are isolated
 *   per-child and recorded in the activity timeline. Agent spawns regardless of
 *   rebase outcome.
 * - NFR-3: rebase is skipped if the child has an active (running) agent run.
 *
 * Called from: UpdateFeatureLifecycleUseCase after every lifecycle transition.
 */

import { injectable, inject } from 'tsyringe';
import { randomUUID } from 'node:crypto';
import {
  SdlcLifecycle,
  BuildMode,
  AgentRunStatus,
  AgentType,
} from '../../../domain/generated/output.js';
import type { Feature } from '../../../domain/generated/output.js';
import type { IFeatureRepository } from '../../ports/output/repositories/feature-repository.interface.js';
import type { IFeatureAgentProcessService } from '../../ports/output/agents/feature-agent-process.interface.js';
import type { ISettingsRepository } from '../../ports/output/repositories/settings.repository.interface.js';
import type { IWorktreeService } from '../../ports/output/services/worktree-service.interface.js';
import type { IAgentRunRepository } from '../../ports/output/agents/agent-run-repository.interface.js';
import type { IPhaseTimingRepository } from '../../ports/output/agents/phase-timing-repository.interface.js';
import { satisfiesDependencyGate } from '../../../domain/lifecycle-gates.js';
import { SyncFeatureBranchUseCase } from './sync-feature-branch.use-case.js';

/** Maximum time (ms) to wait for a single child rebase before aborting. */
const REBASE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

@injectable()
export class CheckAndUnblockFeaturesUseCase {
  constructor(
    @inject('IFeatureRepository') private readonly featureRepo: IFeatureRepository,
    @inject('IFeatureAgentProcessService')
    private readonly agentProcess: IFeatureAgentProcessService,
    @inject('ISettingsRepository')
    private readonly settingsRepository: ISettingsRepository,
    @inject('IWorktreeService')
    private readonly worktreeService: IWorktreeService,
    @inject(SyncFeatureBranchUseCase)
    private readonly syncFeatureBranch: SyncFeatureBranchUseCase,
    @inject('IAgentRunRepository')
    private readonly agentRunRepo: IAgentRunRepository,
    @inject('IPhaseTimingRepository')
    private readonly phaseTimingRepo: IPhaseTimingRepository
  ) {}

  /**
   * Check and unblock direct children of the given parent feature.
   *
   * @param parentFeatureId - ID of the feature whose children should be evaluated.
   * @returns IDs of the children that were unblocked (empty when the gate is closed).
   */
  async execute(parentFeatureId: string): Promise<string[]> {
    // Load parent and verify gate
    const parent = await this.featureRepo.findById(parentFeatureId);
    if (!parent || !satisfiesDependencyGate(parent)) {
      return [];
    }

    // Load direct children
    const children = await this.featureRepo.findByParentId(parentFeatureId);
    const unblockedIds: string[] = [];

    // Unblock each blocked child
    for (const child of children) {
      if (child.lifecycle !== SdlcLifecycle.Blocked || child.deletedAt) {
        continue;
      }

      // Transition to Started
      child.lifecycle = SdlcLifecycle.Started;
      child.updatedAt = new Date();
      await this.featureRepo.update(child);
      unblockedIds.push(child.id);

      // Rebase child branch onto parent branch (isolated per-child)
      await this.rebaseChildOntoParent(child, parent);

      // Spawn agent using fields set at feature creation time
      if (child.agentRunId && child.specPath) {
        // A feature created as Blocked never went through worktree setup, so the
        // stored path is often empty — derive it rather than letting the child
        // agent run in the repository root.
        const storedWorktreePath = child.worktreePath ?? '';
        const worktreePath =
          storedWorktreePath.length > 0
            ? storedWorktreePath
            : this.worktreeService.getWorktreePath(child.repositoryPath, child.branch);

        this.agentProcess.spawn(
          child.id,
          child.agentRunId,
          child.repositoryPath,
          child.specPath,
          worktreePath,
          {
            approvalGates: child.approvalGates,
            push: child.push,
            openPr: child.openPr,
            forkAndPr: child.forkAndPr,
            commitSpecs: child.commitSpecs,
            ciWatchEnabled: child.ciWatchEnabled,
            enableEvidence: child.enableEvidence,
            commitEvidence: child.commitEvidence,
            ...(child.fast ? { fast: true } : {}),
            securityMode: (await this.settingsRepository.load())?.security?.mode,
            ...(child.buildMode === BuildMode.Exploration ? { exploration: true } : {}),
          }
        );
      }
    }

    return unblockedIds;
  }

  /**
   * Bring a child feature branch in sync with the work it depends on.
   *
   * Creates an agent run + phase timing for activity timeline tracking, then
   * delegates the git work to SyncFeatureBranchUseCase, which commits work in
   * progress (never stashes — `git stash push` ignores untracked files),
   * chooses between the base branch and the parent branch, and hands conflicts
   * to the agent. Failures are recorded but do not prevent agent spawn.
   *
   * Skips the rebase if the child has an active (running) agent run (NFR-3).
   */
  private async rebaseChildOntoParent(child: Feature, parent: Feature): Promise<void> {
    // NFR-3: skip rebase if child has an active agent run
    if (child.agentRunId) {
      const existingRun = await this.agentRunRepo.findById(child.agentRunId);
      if (existingRun && existingRun.status === AgentRunStatus.running) {
        return;
      }
    }

    // Create standalone agent run + phase timing for activity timeline
    const now = new Date().toISOString();
    const agentRunId = randomUUID();
    const phaseTimingId = randomUUID();

    await this.agentRunRepo.create({
      id: agentRunId,
      agentType: AgentType.ClaudeCode,
      agentName: 'rebase',
      status: AgentRunStatus.running,
      prompt: `Rebase ${child.branch} onto parent ${parent.branch}`,
      threadId: agentRunId,
      startedAt: now,
      featureId: child.id,
      repositoryPath: child.repositoryPath,
      createdAt: now,
      updatedAt: now,
    });

    await this.phaseTimingRepo.save({
      id: phaseTimingId,
      agentRunId,
      phase: 'rebase-on-parent',
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const startMs = Date.now();

    try {
      await Promise.race([
        this.syncFeatureBranch.execute({
          repositoryPath: child.repositoryPath,
          branch: child.branch,
          parentBranch: parent.branch,
        }),
        this.createTimeout(REBASE_TIMEOUT_MS, child.branch),
      ]);

      // Rebase succeeded
      await this.completeTiming(agentRunId, phaseTimingId, startMs, 'success');
    } catch (error) {
      // Record failure in activity timeline but do not throw —
      // agent spawn proceeds regardless of rebase outcome
      const message = error instanceof Error ? error.message : String(error);
      await this.completeTiming(agentRunId, phaseTimingId, startMs, 'error', message);
    }
  }

  /**
   * Create a timeout promise that rejects after the specified duration.
   */
  private createTimeout(ms: number, childBranch: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Rebase timeout: ${childBranch} exceeded ${ms}ms`)), ms);
    });
  }

  /**
   * Complete the phase timing and update agent run status.
   */
  private async completeTiming(
    agentRunId: string,
    phaseTimingId: string,
    startMs: number,
    exitCode: 'success' | 'error',
    errorMessage?: string
  ): Promise<void> {
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;

    await this.phaseTimingRepo.update(phaseTimingId, {
      completedAt,
      durationMs: BigInt(durationMs),
      exitCode,
      ...(errorMessage && { errorMessage }),
    });

    await this.agentRunRepo.updateStatus(
      agentRunId,
      exitCode === 'success' ? AgentRunStatus.completed : AgentRunStatus.failed,
      { completedAt, ...(errorMessage && { error: errorMessage }) }
    );
  }
}
