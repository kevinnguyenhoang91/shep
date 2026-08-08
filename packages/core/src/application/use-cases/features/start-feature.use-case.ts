/**
 * Start Feature Use Case
 *
 * Transitions a Pending feature to its active lifecycle and spawns
 * the agent. Validates lifecycle state, checks parent dependency
 * gates, and reuses the existing AgentRun record.
 *
 * Before the agent is spawned the branch is brought in sync: everything
 * already in the worktree is committed and the branch is rebased onto the
 * latest base branch, so the agent starts from up-to-date code and no
 * pre-existing work is lost.
 */

import { injectable, inject } from 'tsyringe';
import type { Feature, AgentRun } from '../../../domain/generated/output.js';
import { SdlcLifecycle, BuildMode } from '../../../domain/generated/output.js';
import type { IFeatureRepository } from '../../ports/output/repositories/feature-repository.interface.js';
import type { IAgentRunRepository } from '../../ports/output/agents/agent-run-repository.interface.js';
import type { IFeatureAgentProcessService } from '../../ports/output/agents/feature-agent-process.interface.js';
import type { IWorktreeService } from '../../ports/output/services/worktree-service.interface.js';
import type { ISettingsRepository } from '../../ports/output/repositories/settings.repository.interface.js';
import { satisfiesDependencyGate } from '../../../domain/lifecycle-gates.js';
import { SyncFeatureBranchUseCase } from './sync-feature-branch.use-case.js';

export interface StartFeatureResult {
  feature: Feature;
  agentRun: AgentRun;
  /** True when the dependency gate held the feature back instead of starting it. */
  blocked: boolean;
  /** The parent that holds this feature back, present only when `blocked`. */
  blockedBy?: {
    id: string;
    name: string;
    lifecycle: SdlcLifecycle;
  };
}

@injectable()
export class StartFeatureUseCase {
  constructor(
    @inject('IFeatureRepository')
    private readonly featureRepo: IFeatureRepository,
    @inject('IAgentRunRepository')
    private readonly runRepo: IAgentRunRepository,
    @inject('IFeatureAgentProcessService')
    private readonly processService: IFeatureAgentProcessService,
    @inject('IWorktreeService')
    private readonly worktreeService: IWorktreeService,
    @inject('ISettingsRepository')
    private readonly settingsRepository: ISettingsRepository,
    @inject(SyncFeatureBranchUseCase)
    private readonly syncFeatureBranch: SyncFeatureBranchUseCase
  ) {}

  async execute(featureId: string): Promise<StartFeatureResult> {
    // Resolve feature by exact ID or prefix
    const feature =
      (await this.featureRepo.findById(featureId)) ??
      (await this.featureRepo.findByIdPrefix(featureId));
    if (!feature) {
      throw new Error(`Feature not found: ${featureId}`);
    }

    // Validate lifecycle is Pending
    if (feature.lifecycle !== SdlcLifecycle.Pending) {
      throw new Error(
        `Feature "${feature.name}" is not in Pending state (current: ${feature.lifecycle}). Only pending features can be started.`
      );
    }

    // Validate agentRunId exists
    if (!feature.agentRunId) {
      throw new Error(`No agent run found for feature "${feature.name}"`);
    }

    const agentRun = await this.runRepo.findById(feature.agentRunId);
    if (!agentRun) {
      throw new Error(`No agent run found for feature "${feature.name}"`);
    }

    // Wait for specPath — the web UI creates features in two phases: a fast
    // DB record (specPath: '') followed by background initialization that
    // populates specPath. If the user clicks "Start" before Phase 2 finishes,
    // specPath will still be empty. Poll the DB briefly to let it complete.
    let resolved = feature;
    if (!resolved.specPath) {
      const MAX_POLLS = 20;
      const POLL_INTERVAL_MS = 500;
      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const refreshed = await this.featureRepo.findById(resolved.id);
        if (refreshed?.specPath) {
          resolved = refreshed;
          break;
        }
      }
      if (!resolved.specPath) {
        throw new Error(
          `Feature "${resolved.name}" is still being initialized — please try again shortly`
        );
      }
    }

    // Check parent gate if feature has a parent. A feature may only start once
    // the work it depends on has landed — otherwise it goes (back) to Blocked
    // and waits for CheckAndUnblockFeaturesUseCase to release it.
    let targetLifecycle =
      resolved.fast === true || resolved.buildMode === BuildMode.Fast
        ? SdlcLifecycle.Implementation
        : SdlcLifecycle.Requirements;
    let shouldSpawn = true;
    let parent: Feature | null = null;

    if (resolved.parentId) {
      parent = await this.featureRepo.findById(resolved.parentId);
      if (!parent || !satisfiesDependencyGate(parent)) {
        targetLifecycle = SdlcLifecycle.Blocked;
        shouldSpawn = false;
      }
    }

    // Transition lifecycle
    const updatedFeature: Feature = {
      ...resolved,
      lifecycle: targetLifecycle,
      updatedAt: new Date(),
    };
    await this.featureRepo.update(updatedFeature);

    // Spawn agent if not blocked
    if (shouldSpawn) {
      // Commit whatever is already in the worktree and rebase so the agent
      // starts in sync — onto the parent's work when this feature depends on
      // another, onto the base branch otherwise. Best-effort: a repo without a
      // remote, or a rebase that needs a human, must not block the agent.
      try {
        await this.syncFeatureBranch.execute({
          repositoryPath: resolved.repositoryPath,
          branch: resolved.branch,
          ...(parent ? { parentBranch: parent.branch } : {}),
        });
      } catch {
        // Sync failure is non-fatal — the agent starts from the current tree.
        // Any work in progress was either committed or left untouched.
      }

      const worktreePath = this.worktreeService.getWorktreePath(
        resolved.repositoryPath,
        resolved.branch
      );

      this.processService.spawn(
        resolved.id,
        resolved.agentRunId!,
        resolved.repositoryPath,
        resolved.specPath!,
        worktreePath,
        {
          approvalGates: resolved.approvalGates,
          threadId: agentRun.threadId,
          push: resolved.push,
          openPr: resolved.openPr,
          forkAndPr: resolved.forkAndPr,
          commitSpecs: resolved.commitSpecs,
          ciWatchEnabled: resolved.ciWatchEnabled,
          enableEvidence: resolved.enableEvidence,
          commitEvidence: resolved.commitEvidence,
          agentType: agentRun.agentType,
          ...(resolved.fast ? { fast: true } : {}),
          ...(resolved.buildMode === BuildMode.Exploration ? { exploration: true } : {}),
          ...(agentRun.modelId ? { model: agentRun.modelId } : {}),
          securityMode: (await this.settingsRepository.load())?.security?.mode,
        }
      );
    }

    return {
      feature: updatedFeature,
      agentRun,
      blocked: !shouldSpawn,
      ...(!shouldSpawn && parent
        ? { blockedBy: { id: parent.id, name: parent.name, lifecycle: parent.lifecycle } }
        : {}),
    };
  }
}
