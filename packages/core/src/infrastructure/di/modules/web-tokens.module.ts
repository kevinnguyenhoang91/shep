/**
 * Web Tokens module — String-token aliases for Turbopack.
 *
 * Turbopack can't resolve .js->.ts imports inside @shepai/core, so web
 * routes use string tokens instead of class refs.  Each alias here
 * delegates to the class-token singleton registered in use-cases.module.ts.
 */

import type { DependencyContainer } from 'tsyringe';

// Use case classes — needed only as resolution targets for `c.resolve(Cls)`
import { CreateFeatureUseCase } from '../../../application/use-cases/features/create/create-feature.use-case.js';
import { ListFeaturesUseCase } from '../../../application/use-cases/features/list-features.use-case.js';
import { ShowFeatureUseCase } from '../../../application/use-cases/features/show-feature.use-case.js';
import { DeleteFeatureUseCase } from '../../../application/use-cases/features/delete-feature.use-case.js';
import { ResumeFeatureUseCase } from '../../../application/use-cases/features/resume-feature.use-case.js';
import { StartFeatureUseCase } from '../../../application/use-cases/features/start-feature.use-case.js';
import { UpdateFeaturePinnedConfigUseCase } from '../../../application/use-cases/features/update-feature-pinned-config.use-case.js';
import { AdoptBranchUseCase } from '../../../application/use-cases/features/adopt-branch.use-case.js';
import { GetFeatureArtifactUseCase } from '../../../application/use-cases/features/get-feature-artifact.use-case.js';
import { GetResearchArtifactUseCase } from '../../../application/use-cases/features/get-research-artifact.use-case.js';
import { GetPlanArtifactUseCase } from '../../../application/use-cases/features/get-plan-artifact.use-case.js';
import { CreateFeatureFromRemoteUseCase } from '../../../application/use-cases/features/create/create-feature-from-remote.use-case.js';
import { CheckAndUnblockFeaturesUseCase } from '../../../application/use-cases/features/check-and-unblock-features.use-case.js';
import { UpdateFeatureLifecycleUseCase } from '../../../application/use-cases/features/update/update-feature-lifecycle.use-case.js';
import { CleanupFeatureWorktreeUseCase } from '../../../application/use-cases/features/cleanup-feature-worktree.use-case.js';
import { ArchiveFeatureUseCase } from '../../../application/use-cases/features/archive-feature.use-case.js';
import { UnarchiveFeatureUseCase } from '../../../application/use-cases/features/unarchive-feature.use-case.js';
import { RebaseFeatureOnMainUseCase } from '../../../application/use-cases/features/rebase-feature-on-main.use-case.js';
import { GetBranchSyncStatusUseCase } from '../../../application/use-cases/features/get-branch-sync-status.use-case.js';
import { AutoResolveMergedBranchesUseCase } from '../../../application/use-cases/features/auto-resolve-merged-branches.use-case.js';

import { StopAgentRunUseCase } from '../../../application/use-cases/agents/stop-agent-run.use-case.js';
import { ApproveAgentRunUseCase } from '../../../application/use-cases/agents/approve-agent-run.use-case.js';
import { RejectAgentRunUseCase } from '../../../application/use-cases/agents/reject-agent-run.use-case.js';

import { InstallToolUseCase } from '../../../application/use-cases/tools/install-tool.use-case.js';
import { ListToolsUseCase } from '../../../application/use-cases/tools/list-tools.use-case.js';
import { LaunchToolUseCase } from '../../../application/use-cases/tools/launch-tool.use-case.js';
import { LaunchIdeUseCase } from '../../../application/use-cases/ide/launch-ide.use-case.js';

import { AddRepositoryUseCase } from '../../../application/use-cases/repositories/add-repository.use-case.js';
import { ListRepositoriesUseCase } from '../../../application/use-cases/repositories/list-repositories.use-case.js';
import { DeleteRepositoryUseCase } from '../../../application/use-cases/repositories/delete-repository.use-case.js';
import { ImportGitHubRepositoryUseCase } from '../../../application/use-cases/repositories/import-github-repository.use-case.js';
import { InitRemoteRepositoryUseCase } from '../../../application/use-cases/repositories/init-remote-repository.use-case.js';
import { ListGitHubRepositoriesUseCase } from '../../../application/use-cases/repositories/list-github-repositories.use-case.js';
import { ListGitHubOrganizationsUseCase } from '../../../application/use-cases/repositories/list-github-organizations.use-case.js';
import { SyncRepositoryMainUseCase } from '../../../application/use-cases/repositories/sync-repository-main.use-case.js';

import { LoadSettingsUseCase } from '../../../application/use-cases/settings/load-settings.use-case.js';
import { UpdateSettingsUseCase } from '../../../application/use-cases/settings/update-settings.use-case.js';
import { CompleteWebOnboardingUseCase } from '../../../application/use-cases/settings/complete-web-onboarding.use-case.js';

import { UpgradeCliUseCase } from '../../../application/use-cases/upgrade/upgrade-cli.use-case.js';

// Interactive use cases
import { StartInteractiveSessionUseCase } from '../../../application/use-cases/interactive/start-interactive-session.use-case.js';
import { SendInteractiveMessageUseCase } from '../../../application/use-cases/interactive/send-interactive-message.use-case.js';
import { StopInteractiveSessionUseCase } from '../../../application/use-cases/interactive/stop-interactive-session.use-case.js';
import { GetInteractiveChatStateUseCase } from '../../../application/use-cases/interactive/get-interactive-chat-state.use-case.js';
import { RespondToInteractionUseCase } from '../../../application/use-cases/interactive/respond-to-interaction.use-case.js';

export function registerWebTokens(container: DependencyContainer): void {
  // Feature use cases
  container.register('CreateFeatureUseCase', {
    useFactory: (c) => c.resolve(CreateFeatureUseCase),
  });
  container.register('ListFeaturesUseCase', {
    useFactory: (c) => c.resolve(ListFeaturesUseCase),
  });
  container.register('ShowFeatureUseCase', {
    useFactory: (c) => c.resolve(ShowFeatureUseCase),
  });
  container.register('DeleteFeatureUseCase', {
    useFactory: (c) => c.resolve(DeleteFeatureUseCase),
  });
  container.register('ResumeFeatureUseCase', {
    useFactory: (c) => c.resolve(ResumeFeatureUseCase),
  });
  container.register('StartFeatureUseCase', {
    useFactory: (c) => c.resolve(StartFeatureUseCase),
  });
  container.register('UpdateFeaturePinnedConfigUseCase', {
    useFactory: (c) => c.resolve(UpdateFeaturePinnedConfigUseCase),
  });
  container.register('AdoptBranchUseCase', {
    useFactory: (c) => c.resolve(AdoptBranchUseCase),
  });
  container.register('GetFeatureArtifactUseCase', {
    useFactory: (c) => c.resolve(GetFeatureArtifactUseCase),
  });
  container.register('GetResearchArtifactUseCase', {
    useFactory: (c) => c.resolve(GetResearchArtifactUseCase),
  });
  container.register('GetPlanArtifactUseCase', {
    useFactory: (c) => c.resolve(GetPlanArtifactUseCase),
  });
  container.register('CreateFeatureFromRemoteUseCase', {
    useFactory: (c) => c.resolve(CreateFeatureFromRemoteUseCase),
  });
  container.register('CheckAndUnblockFeaturesUseCase', {
    useFactory: (c) => c.resolve(CheckAndUnblockFeaturesUseCase),
  });
  container.register('UpdateFeatureLifecycleUseCase', {
    useFactory: (c) => c.resolve(UpdateFeatureLifecycleUseCase),
  });
  container.register('CleanupFeatureWorktreeUseCase', {
    useFactory: (c) => c.resolve(CleanupFeatureWorktreeUseCase),
  });
  container.register('ArchiveFeatureUseCase', {
    useFactory: (c) => c.resolve(ArchiveFeatureUseCase),
  });
  container.register('UnarchiveFeatureUseCase', {
    useFactory: (c) => c.resolve(UnarchiveFeatureUseCase),
  });
  container.register('RebaseFeatureOnMainUseCase', {
    useFactory: (c) => c.resolve(RebaseFeatureOnMainUseCase),
  });
  container.register('GetBranchSyncStatusUseCase', {
    useFactory: (c) => c.resolve(GetBranchSyncStatusUseCase),
  });
  container.register('AutoResolveMergedBranchesUseCase', {
    useFactory: (c) => c.resolve(AutoResolveMergedBranchesUseCase),
  });

  // Agent use cases
  container.register('StopAgentRunUseCase', {
    useFactory: (c) => c.resolve(StopAgentRunUseCase),
  });
  container.register('ApproveAgentRunUseCase', {
    useFactory: (c) => c.resolve(ApproveAgentRunUseCase),
  });
  container.register('RejectAgentRunUseCase', {
    useFactory: (c) => c.resolve(RejectAgentRunUseCase),
  });

  // Tool use cases
  container.register('InstallToolUseCase', {
    useFactory: (c) => c.resolve(InstallToolUseCase),
  });
  container.register('ListToolsUseCase', {
    useFactory: (c) => c.resolve(ListToolsUseCase),
  });
  container.register('LaunchToolUseCase', {
    useFactory: (c) => c.resolve(LaunchToolUseCase),
  });
  container.register('LaunchIdeUseCase', {
    useFactory: (c) => c.resolve(LaunchIdeUseCase),
  });

  // Repository use cases
  container.register('AddRepositoryUseCase', {
    useFactory: (c) => c.resolve(AddRepositoryUseCase),
  });
  container.register('ListRepositoriesUseCase', {
    useFactory: (c) => c.resolve(ListRepositoriesUseCase),
  });
  container.register('DeleteRepositoryUseCase', {
    useFactory: (c) => c.resolve(DeleteRepositoryUseCase),
  });
  container.register('ImportGitHubRepositoryUseCase', {
    useFactory: (c) => c.resolve(ImportGitHubRepositoryUseCase),
  });
  container.register('InitRemoteRepositoryUseCase', {
    useFactory: (c) => c.resolve(InitRemoteRepositoryUseCase),
  });
  container.register('ListGitHubRepositoriesUseCase', {
    useFactory: (c) => c.resolve(ListGitHubRepositoriesUseCase),
  });
  container.register('ListGitHubOrganizationsUseCase', {
    useFactory: (c) => c.resolve(ListGitHubOrganizationsUseCase),
  });
  container.register('SyncRepositoryMainUseCase', {
    useFactory: (c) => c.resolve(SyncRepositoryMainUseCase),
  });

  // Settings use cases
  container.register('LoadSettingsUseCase', {
    useFactory: (c) => c.resolve(LoadSettingsUseCase),
  });
  container.register('UpdateSettingsUseCase', {
    useFactory: (c) => c.resolve(UpdateSettingsUseCase),
  });
  container.register('CompleteWebOnboardingUseCase', {
    useFactory: (c) => c.resolve(CompleteWebOnboardingUseCase),
  });

  // Upgrade use cases
  container.register('UpgradeCliUseCase', {
    useFactory: (c) => c.resolve(UpgradeCliUseCase),
  });

  // Interactive use cases
  container.register('StartInteractiveSessionUseCase', {
    useFactory: (c) => c.resolve(StartInteractiveSessionUseCase),
  });
  container.register('SendInteractiveMessageUseCase', {
    useFactory: (c) => c.resolve(SendInteractiveMessageUseCase),
  });
  container.register('StopInteractiveSessionUseCase', {
    useFactory: (c) => c.resolve(StopInteractiveSessionUseCase),
  });
  container.register('GetInteractiveChatStateUseCase', {
    useFactory: (c) => c.resolve(GetInteractiveChatStateUseCase),
  });
  container.register('RespondToInteractionUseCase', {
    useFactory: (c) => c.resolve(RespondToInteractionUseCase),
  });
}
