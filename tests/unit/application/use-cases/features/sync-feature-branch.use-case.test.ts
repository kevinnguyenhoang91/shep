/**
 * SyncFeatureBranchUseCase Unit Tests
 *
 * The commit-then-rebase workflow: any work in progress is committed before
 * the branch is rebased onto the base branch, so a dirty worktree can never
 * fail the rebase and nothing is left in a stash.
 *
 * TDD Phase: RED-GREEN-REFACTOR
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SyncFeatureBranchUseCase,
  buildAutoCommitMessage,
} from '@/application/use-cases/features/sync-feature-branch.use-case.js';
import type { IGitPrService } from '@/application/ports/output/services/git-pr-service.interface.js';
import {
  GitPrError,
  GitPrErrorCode,
} from '@/application/ports/output/services/git-pr-service.interface.js';
import type { IWorktreeService } from '@/application/ports/output/services/worktree-service.interface.js';
import type { IConflictResolutionService } from '@/application/ports/output/services/conflict-resolution.interface.js';

const REPO_PATH = '/home/user/my-project';
const WORKTREE_PATH = '/home/user/my-project/.worktrees/feat-my-feature';
const BRANCH = 'feat/my-feature';

function createMockGitPrService(): IGitPrService {
  return {
    getDefaultBranch: vi.fn().mockResolvedValue('main'),
    hasUncommittedChanges: vi.fn().mockResolvedValue(false),
    commitAll: vi.fn().mockResolvedValue('abc1234'),
    syncMain: vi.fn().mockResolvedValue(undefined),
    rebaseOnMain: vi.fn().mockResolvedValue(undefined),
    rebaseOnBranch: vi.fn().mockResolvedValue(undefined),
    hasRemote: vi.fn().mockResolvedValue(true),
    verifyMerge: vi.fn().mockResolvedValue(true),
    revParse: vi.fn().mockResolvedValue('abc1234'),
  } as unknown as IGitPrService;
}

function createMockWorktreeService(): IWorktreeService {
  return {
    exists: vi.fn().mockResolvedValue(false),
    getWorktreePath: vi.fn().mockReturnValue(WORKTREE_PATH),
  } as unknown as IWorktreeService;
}

function createMockConflictResolution(): IConflictResolutionService {
  return {
    resolve: vi.fn().mockResolvedValue(undefined),
    resolveStashPop: vi.fn().mockResolvedValue(undefined),
  } as unknown as IConflictResolutionService;
}

describe('SyncFeatureBranchUseCase', () => {
  let useCase: SyncFeatureBranchUseCase;
  let gitPrService: IGitPrService;
  let worktreeService: IWorktreeService;
  let conflictResolution: IConflictResolutionService;

  beforeEach(() => {
    vi.clearAllMocks();
    gitPrService = createMockGitPrService();
    worktreeService = createMockWorktreeService();
    conflictResolution = createMockConflictResolution();
    useCase = new SyncFeatureBranchUseCase(gitPrService, worktreeService, conflictResolution);
  });

  // -------------------------------------------------------------------------
  // Auto-commit
  // -------------------------------------------------------------------------

  it('should commit uncommitted changes before rebasing', async () => {
    vi.mocked(gitPrService.hasUncommittedChanges).mockResolvedValue(true);

    const result = await useCase.execute({ repositoryPath: REPO_PATH, branch: BRANCH });

    expect(gitPrService.commitAll).toHaveBeenCalledWith(
      REPO_PATH,
      buildAutoCommitMessage(BRANCH, 'main'),
      { noVerify: true }
    );
    expect(result.committed).toBe(true);
    expect(result.commitSha).toBe('abc1234');
  });

  it('should commit before syncing and rebasing, never after', async () => {
    vi.mocked(gitPrService.hasUncommittedChanges).mockResolvedValue(true);

    await useCase.execute({ repositoryPath: REPO_PATH, branch: BRANCH });

    const commitOrder = vi.mocked(gitPrService.commitAll).mock.invocationCallOrder[0];
    const syncOrder = vi.mocked(gitPrService.syncMain).mock.invocationCallOrder[0];
    const rebaseOrder = vi.mocked(gitPrService.rebaseOnMain).mock.invocationCallOrder[0];

    expect(commitOrder).toBeLessThan(syncOrder);
    expect(syncOrder).toBeLessThan(rebaseOrder);
  });

  it('should skip the commit when the worktree is clean', async () => {
    vi.mocked(gitPrService.hasUncommittedChanges).mockResolvedValue(false);

    const result = await useCase.execute({ repositoryPath: REPO_PATH, branch: BRANCH });

    expect(gitPrService.commitAll).not.toHaveBeenCalled();
    expect(result.committed).toBe(false);
    expect(result.commitSha).toBeUndefined();
    expect(gitPrService.rebaseOnMain).toHaveBeenCalled();
  });

  it('should never stash — work in progress becomes a commit', async () => {
    vi.mocked(gitPrService.hasUncommittedChanges).mockResolvedValue(true);
    const stash = vi.fn();
    (gitPrService as unknown as { stash: unknown }).stash = stash;

    await useCase.execute({ repositoryPath: REPO_PATH, branch: BRANCH });

    expect(stash).not.toHaveBeenCalled();
  });

  it('should build an auto-commit message that names the branches and the undo command', () => {
    const message = buildAutoCommitMessage(BRANCH, 'main');

    expect(message).toContain(BRANCH);
    expect(message).toContain('main');
    expect(message).toContain('git reset --soft HEAD~1');
    // Subject line must stay within conventional-commit limits
    const subject = message.split('\n')[0];
    expect(subject.length).toBeLessThanOrEqual(100);
  });

  // -------------------------------------------------------------------------
  // Working directory resolution
  // -------------------------------------------------------------------------

  it('should operate in the worktree when one exists', async () => {
    vi.mocked(worktreeService.exists).mockResolvedValue(true);
    vi.mocked(gitPrService.hasUncommittedChanges).mockResolvedValue(true);

    const result = await useCase.execute({ repositoryPath: REPO_PATH, branch: BRANCH });

    expect(worktreeService.exists).toHaveBeenCalledWith(REPO_PATH, BRANCH);
    expect(gitPrService.commitAll).toHaveBeenCalledWith(
      WORKTREE_PATH,
      expect.any(String),
      expect.anything()
    );
    expect(gitPrService.syncMain).toHaveBeenCalledWith(WORKTREE_PATH, 'main');
    expect(gitPrService.rebaseOnMain).toHaveBeenCalledWith(WORKTREE_PATH, BRANCH, 'main');
    expect(result.cwd).toBe(WORKTREE_PATH);
  });

  it('should fall back to the repository root when no worktree exists', async () => {
    vi.mocked(worktreeService.exists).mockResolvedValue(false);

    const result = await useCase.execute({ repositoryPath: REPO_PATH, branch: BRANCH });

    expect(gitPrService.syncMain).toHaveBeenCalledWith(REPO_PATH, 'main');
    expect(result.cwd).toBe(REPO_PATH);
  });

  it('should resolve the base branch from the repository', async () => {
    vi.mocked(gitPrService.getDefaultBranch).mockResolvedValue('develop');

    const result = await useCase.execute({ repositoryPath: REPO_PATH, branch: BRANCH });

    expect(gitPrService.getDefaultBranch).toHaveBeenCalledWith(REPO_PATH);
    expect(gitPrService.rebaseOnMain).toHaveBeenCalledWith(REPO_PATH, BRANCH, 'develop');
    expect(result.baseBranch).toBe('develop');
  });

  // -------------------------------------------------------------------------
  // Conflicts and failures
  // -------------------------------------------------------------------------

  it('should delegate to conflict resolution on REBASE_CONFLICT', async () => {
    vi.mocked(gitPrService.rebaseOnMain).mockRejectedValue(
      new GitPrError('Rebase conflicts detected', GitPrErrorCode.REBASE_CONFLICT)
    );

    const result = await useCase.execute({ repositoryPath: REPO_PATH, branch: BRANCH });

    expect(conflictResolution.resolve).toHaveBeenCalledWith(REPO_PATH, BRANCH, 'main');
    expect(result.conflictsResolved).toBe(true);
  });

  it('should propagate conflict resolution failure', async () => {
    vi.mocked(gitPrService.rebaseOnMain).mockRejectedValue(
      new GitPrError('Rebase conflicts', GitPrErrorCode.REBASE_CONFLICT)
    );
    vi.mocked(conflictResolution.resolve).mockRejectedValue(
      new GitPrError('Failed to resolve after 3 attempts', GitPrErrorCode.REBASE_CONFLICT)
    );

    const error = await useCase
      .execute({ repositoryPath: REPO_PATH, branch: BRANCH })
      .catch((e) => e);

    expect(error).toBeInstanceOf(GitPrError);
    expect(error.code).toBe(GitPrErrorCode.REBASE_CONFLICT);
  });

  it('should propagate non-conflict rebase errors without invoking the agent', async () => {
    vi.mocked(gitPrService.rebaseOnMain).mockRejectedValue(
      new GitPrError('Unexpected git failure', GitPrErrorCode.GIT_ERROR)
    );

    const error = await useCase
      .execute({ repositoryPath: REPO_PATH, branch: BRANCH })
      .catch((e) => e);

    expect(error).toBeInstanceOf(GitPrError);
    expect(error.code).toBe(GitPrErrorCode.GIT_ERROR);
    expect(conflictResolution.resolve).not.toHaveBeenCalled();
  });

  it('should propagate SYNC_FAILED without attempting the rebase', async () => {
    vi.mocked(gitPrService.syncMain).mockRejectedValue(
      new GitPrError('Cannot fast-forward', GitPrErrorCode.SYNC_FAILED)
    );

    const error = await useCase
      .execute({ repositoryPath: REPO_PATH, branch: BRANCH })
      .catch((e) => e);

    expect(error).toBeInstanceOf(GitPrError);
    expect(error.code).toBe(GitPrErrorCode.SYNC_FAILED);
    expect(gitPrService.rebaseOnMain).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Parent branch — a child must start from its parent's work
  // -------------------------------------------------------------------------

  const PARENT_BRANCH = 'feat/parent-feature';

  it('should rebase onto the base branch when the parent branch already landed there', async () => {
    vi.mocked(gitPrService.verifyMerge).mockResolvedValue(true);

    const result = await useCase.execute({
      repositoryPath: REPO_PATH,
      branch: BRANCH,
      parentBranch: PARENT_BRANCH,
    });

    expect(gitPrService.rebaseOnMain).toHaveBeenCalledWith(REPO_PATH, BRANCH, 'main');
    expect(gitPrService.rebaseOnBranch).not.toHaveBeenCalled();
    expect(result.rebasedOnto).toBe('main');
  });

  it('should rebase onto the parent branch when the parent has not landed on base', async () => {
    vi.mocked(gitPrService.verifyMerge).mockResolvedValue(false);

    const result = await useCase.execute({
      repositoryPath: REPO_PATH,
      branch: BRANCH,
      parentBranch: PARENT_BRANCH,
    });

    expect(gitPrService.rebaseOnBranch).toHaveBeenCalledWith(REPO_PATH, BRANCH, PARENT_BRANCH);
    expect(gitPrService.rebaseOnMain).not.toHaveBeenCalled();
    expect(result.rebasedOnto).toBe(PARENT_BRANCH);
  });

  it('should test the parent against the freshly fetched remote base ref', async () => {
    await useCase.execute({
      repositoryPath: REPO_PATH,
      branch: BRANCH,
      parentBranch: PARENT_BRANCH,
    });

    expect(gitPrService.verifyMerge).toHaveBeenCalledWith(REPO_PATH, PARENT_BRANCH, 'origin/main');
    // The fetch must happen first, or the ancestry check reads a stale ref.
    expect(vi.mocked(gitPrService.syncMain).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(gitPrService.verifyMerge).mock.invocationCallOrder[0]
    );
  });

  it('should test against the local base branch when the repository has no remote', async () => {
    vi.mocked(gitPrService.hasRemote).mockResolvedValue(false);

    await useCase.execute({
      repositoryPath: REPO_PATH,
      branch: BRANCH,
      parentBranch: PARENT_BRANCH,
    });

    expect(gitPrService.verifyMerge).toHaveBeenCalledWith(REPO_PATH, PARENT_BRANCH, 'main');
  });

  it('should fall back to the base branch when the parent branch no longer exists', async () => {
    // Post-merge cleanup deletes the parent branch, locally and on the remote.
    // `verifyMerge` reports an unresolvable branch as NOT merged, so relying on
    // it alone would aim the rebase at a branch that cannot even be fetched.
    vi.mocked(gitPrService.revParse).mockRejectedValue(new Error('unknown revision'));
    vi.mocked(gitPrService.verifyMerge).mockResolvedValue(false);

    const result = await useCase.execute({
      repositoryPath: REPO_PATH,
      branch: BRANCH,
      parentBranch: PARENT_BRANCH,
    });

    expect(result.rebasedOnto).toBe('main');
    expect(gitPrService.rebaseOnMain).toHaveBeenCalled();
    expect(gitPrService.rebaseOnBranch).not.toHaveBeenCalled();
  });

  it('should use the parent branch when only its remote-tracking ref resolves', async () => {
    vi.mocked(gitPrService.revParse).mockImplementation(async (_cwd: string, ref: string) => {
      if (ref === `origin/${PARENT_BRANCH}`) return 'abc1234';
      throw new Error('unknown revision');
    });
    vi.mocked(gitPrService.verifyMerge).mockResolvedValue(false);

    const result = await useCase.execute({
      repositoryPath: REPO_PATH,
      branch: BRANCH,
      parentBranch: PARENT_BRANCH,
    });

    expect(result.rebasedOnto).toBe(PARENT_BRANCH);
  });

  it('should fall back to the base branch when ancestry cannot be established', async () => {
    vi.mocked(gitPrService.verifyMerge).mockRejectedValue(
      new GitPrError('bad revision', GitPrErrorCode.GIT_ERROR)
    );

    const result = await useCase.execute({
      repositoryPath: REPO_PATH,
      branch: BRANCH,
      parentBranch: PARENT_BRANCH,
    });

    expect(result.rebasedOnto).toBe('main');
  });

  it('should rebase onto the base branch when the parent branch IS the base branch', async () => {
    const result = await useCase.execute({
      repositoryPath: REPO_PATH,
      branch: BRANCH,
      parentBranch: 'main',
    });

    expect(gitPrService.verifyMerge).not.toHaveBeenCalled();
    expect(gitPrService.rebaseOnMain).toHaveBeenCalledWith(REPO_PATH, BRANCH, 'main');
    expect(result.rebasedOnto).toBe('main');
  });

  it('should not consult the parent when no parentBranch is given', async () => {
    const result = await useCase.execute({ repositoryPath: REPO_PATH, branch: BRANCH });

    expect(gitPrService.verifyMerge).not.toHaveBeenCalled();
    expect(result.rebasedOnto).toBe('main');
  });

  it('should resolve conflicts against the parent branch when rebasing onto it', async () => {
    vi.mocked(gitPrService.verifyMerge).mockResolvedValue(false);
    vi.mocked(gitPrService.rebaseOnBranch).mockRejectedValue(
      new GitPrError('Rebase conflicts detected', GitPrErrorCode.REBASE_CONFLICT)
    );

    const result = await useCase.execute({
      repositoryPath: REPO_PATH,
      branch: BRANCH,
      parentBranch: PARENT_BRANCH,
    });

    expect(conflictResolution.resolve).toHaveBeenCalledWith(REPO_PATH, BRANCH, PARENT_BRANCH);
    expect(result.conflictsResolved).toBe(true);
  });

  it('should checkpoint work in progress before rebasing onto the parent branch', async () => {
    // The commit must land before the target is even resolved — nothing about
    // the parent may put the child's uncommitted work at risk.
    vi.mocked(gitPrService.hasUncommittedChanges).mockResolvedValue(true);
    vi.mocked(gitPrService.verifyMerge).mockResolvedValue(false);

    await useCase.execute({
      repositoryPath: REPO_PATH,
      branch: BRANCH,
      parentBranch: PARENT_BRANCH,
    });

    expect(vi.mocked(gitPrService.commitAll).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(gitPrService.rebaseOnBranch).mock.invocationCallOrder[0]
    );
  });

  it('should propagate a failing auto-commit without rebasing over the work', async () => {
    vi.mocked(gitPrService.hasUncommittedChanges).mockResolvedValue(true);
    vi.mocked(gitPrService.commitAll).mockRejectedValue(
      new GitPrError('nothing to commit', GitPrErrorCode.GIT_ERROR)
    );

    const error = await useCase
      .execute({ repositoryPath: REPO_PATH, branch: BRANCH })
      .catch((e) => e);

    expect(error).toBeInstanceOf(GitPrError);
    expect(gitPrService.syncMain).not.toHaveBeenCalled();
    expect(gitPrService.rebaseOnMain).not.toHaveBeenCalled();
  });
});
