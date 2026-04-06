/**
 * Merge Strategy Service
 *
 * Handles merge operations, conflict resolution, rebase, sync,
 * commit/push, and stash operations.
 */

import { injectable, inject } from 'tsyringe';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MergeStrategy } from '../../../application/ports/output/services/git-pr-service.interface.js';
import {
  GitPrError,
  GitPrErrorCode,
} from '../../../application/ports/output/services/git-pr-service.interface.js';
import type { ExecFunction } from './worktree.service.js';

@injectable()
export class MergeStrategyService {
  constructor(@inject('ExecFunction') private readonly execFile: ExecFunction) {}

  async hasUncommittedChanges(cwd: string): Promise<boolean> {
    const { stdout } = await this.execFile('git', ['status', '--porcelain'], { cwd });
    return stdout.trim().length > 0;
  }

  async commitAll(cwd: string, message: string): Promise<string> {
    try {
      await this.execFile('git', ['add', '-A'], { cwd });
      await this.execFile('git', ['commit', '-m', message], { cwd });
      const { stdout } = await this.execFile('git', ['rev-parse', 'HEAD'], { cwd });
      return stdout.trim();
    } catch (error) {
      throw this.parseGitError(error);
    }
  }

  async push(cwd: string, branch: string, setUpstream?: boolean): Promise<void> {
    const args = ['push'];
    if (setUpstream) args.push('--set-upstream');
    args.push('origin', branch);

    try {
      await this.execFile('git', args, { cwd });
    } catch (error) {
      throw this.parseGitError(error);
    }
  }

  async mergePr(cwd: string, prNumber: number, strategy: MergeStrategy = 'squash'): Promise<void> {
    try {
      await this.execFile('gh', ['pr', 'merge', String(prNumber), `--${strategy}`], {
        cwd,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cause = error instanceof Error ? error : undefined;
      throw new GitPrError(message, GitPrErrorCode.MERGE_FAILED, cause);
    }

    // Try to delete the remote branch gracefully — not fatal if it fails
    // (e.g. branch already deleted by GitHub auto-delete, or permissions)
    try {
      await this.execFile(
        'gh',
        [
          'api',
          '--method',
          'DELETE',
          `repos/{owner}/{repo}/git/refs/heads/${await this.getPrHeadBranch(cwd, prNumber)}`,
        ],
        { cwd }
      );
    } catch {
      // Branch deletion is best-effort — log-level concern, not an error
    }
  }

  private async getPrHeadBranch(cwd: string, prNumber: number): Promise<string> {
    const { stdout } = await this.execFile(
      'gh',
      ['pr', 'view', String(prNumber), '--json', 'headRefName', '--jq', '.headRefName'],
      { cwd }
    );
    return stdout.trim();
  }

  async localMergeSquash(
    cwd: string,
    featureBranch: string,
    baseBranch: string,
    commitMessage: string,
    hasRemote = false
  ): Promise<void> {
    try {
      // Fetch latest from remote if available
      if (hasRemote) {
        try {
          await this.execFile('git', ['fetch', 'origin'], { cwd });
        } catch {
          // Fetch failure is non-fatal — proceed with local state
        }
      }

      // Checkout base branch
      await this.execFile('git', ['checkout', baseBranch], { cwd });

      // Pull latest base if remote available
      if (hasRemote) {
        try {
          await this.execFile('git', ['pull', 'origin', baseBranch], { cwd });
        } catch {
          // Pull failure is non-fatal — proceed with local state
        }
      }

      // Clean untracked files that may conflict with the merge (e.g. files created
      // by a prior agent call that leaked into the original repo directory)
      try {
        await this.execFile('git', ['clean', '-fd'], { cwd });
      } catch {
        // Clean failure is non-fatal
      }

      // Squash merge the feature branch
      await this.execFile('git', ['merge', '--squash', featureBranch], { cwd });

      // Commit the squash merge (skip if nothing to commit — branches may be equivalent)
      const { stdout: status } = await this.execFile('git', ['status', '--porcelain'], { cwd });
      if (status.trim().length > 0) {
        // Write commit message to a temp file to avoid shell splitting on Windows
        // (DI-injected execFile uses shell: true on Windows, which splits on spaces)
        const msgFile = join(tmpdir(), `shep-merge-msg-${Date.now()}.txt`);
        try {
          writeFileSync(msgFile, commitMessage, 'utf8');
          await this.execFile('git', ['commit', '--file', msgFile], { cwd });
        } finally {
          try {
            unlinkSync(msgFile);
          } catch {
            // Cleanup failure is non-fatal
          }
        }
      }

      // Delete the feature branch after successful merge
      try {
        await this.execFile('git', ['branch', '-d', featureBranch], { cwd });
      } catch {
        // Branch deletion failure is non-fatal (branch may have already been deleted)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cause = error instanceof Error ? error : undefined;
      if (message.includes('CONFLICT') || message.includes('conflict')) {
        throw new GitPrError(
          `Merge conflict while squash-merging ${featureBranch} into ${baseBranch}: ${message}`,
          GitPrErrorCode.MERGE_CONFLICT,
          cause
        );
      }
      throw new GitPrError(
        `Local squash merge failed: ${message}`,
        GitPrErrorCode.GIT_ERROR,
        cause
      );
    }
  }

  async mergeBranch(cwd: string, sourceBranch: string, targetBranch: string): Promise<void> {
    try {
      await this.execFile('git', ['checkout', targetBranch], { cwd });
      await this.execFile('git', ['merge', sourceBranch], { cwd });
      await this.execFile('git', ['push'], { cwd });
    } catch (error) {
      throw this.parseGitError(error);
    }
  }

  async syncMain(cwd: string, baseBranch: string): Promise<void> {
    try {
      // Detect current branch
      const { stdout } = await this.execFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
      const currentBranch = stdout.trim();

      if (currentBranch === baseBranch) {
        // On the base branch — use git pull --ff-only
        await this.execFile('git', ['pull', '--ff-only', 'origin', baseBranch], { cwd });
      } else {
        // On a different branch — fetch the remote ref only (updates origin/<baseBranch>).
        // We intentionally do NOT update the local <baseBranch> ref because it may be
        // checked out in another worktree, which causes git to refuse the update with:
        //   "fatal: refusing to fetch into branch 'refs/heads/main' checked out at ..."
        await this.execFile('git', ['fetch', 'origin', baseBranch], { cwd });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cause = error instanceof Error ? error : undefined;

      if (
        message.includes('non-fast-forward') ||
        message.includes('Not possible to fast-forward') ||
        message.includes('diverged')
      ) {
        throw new GitPrError(
          `Cannot fast-forward '${baseBranch}': local branch has diverged from remote. ` +
            `Resolve the divergence manually with 'git checkout ${baseBranch} && git reset --hard origin/${baseBranch}' ` +
            `if you want to discard local changes on ${baseBranch}.`,
          GitPrErrorCode.SYNC_FAILED,
          cause
        );
      }

      throw new GitPrError(
        `Failed to sync '${baseBranch}' with remote: ${message}`,
        GitPrErrorCode.GIT_ERROR,
        cause
      );
    }
  }

  async rebaseOnMain(cwd: string, featureBranch: string, baseBranch: string): Promise<void> {
    // Check for dirty worktree before starting
    const dirty = await this.hasUncommittedChanges(cwd);
    if (dirty) {
      throw new GitPrError(
        `Cannot rebase: working directory has uncommitted changes. ` +
          `Please commit or stash your changes before rebasing.`,
        GitPrErrorCode.GIT_ERROR
      );
    }

    // Checkout the feature branch
    try {
      await this.execFile('git', ['checkout', featureBranch], { cwd });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cause = error instanceof Error ? error : undefined;
      if (
        message.includes('did not match') ||
        message.includes('not a commit') ||
        message.includes('pathspec')
      ) {
        throw new GitPrError(
          `Branch '${featureBranch}' not found.`,
          GitPrErrorCode.BRANCH_NOT_FOUND,
          cause
        );
      }
      throw new GitPrError(
        `Failed to checkout '${featureBranch}': ${message}`,
        GitPrErrorCode.GIT_ERROR,
        cause
      );
    }

    // Rebase onto origin/<baseBranch> (the remote-tracking ref).
    // We use origin/<baseBranch> rather than the local <baseBranch> because:
    // 1. syncMain fetches origin/<baseBranch> — it's always up-to-date
    // 2. The local <baseBranch> may be checked out in another worktree and stale
    const rebaseTarget = `origin/${baseBranch}`;
    try {
      await this.execFile('git', ['rebase', rebaseTarget], { cwd });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cause = error instanceof Error ? error : undefined;

      // Detect rebase conflict from git stderr/exit code
      if (message.includes('CONFLICT') || message.includes('could not apply')) {
        // Get the list of conflicted files to include in the error message
        let conflictedFiles: string[] = [];
        try {
          conflictedFiles = await this.getConflictedFiles(cwd);
        } catch {
          // Failed to get conflicted files — still report the conflict
        }

        const fileList =
          conflictedFiles.length > 0 ? ` Conflicted files: ${conflictedFiles.join(', ')}` : '';
        throw new GitPrError(
          `Rebase of '${featureBranch}' onto '${baseBranch}' encountered conflicts.${fileList}`,
          GitPrErrorCode.REBASE_CONFLICT,
          cause
        );
      }

      throw new GitPrError(
        `Rebase of '${featureBranch}' onto '${baseBranch}' failed: ${message}`,
        GitPrErrorCode.GIT_ERROR,
        cause
      );
    }
  }

  async getConflictedFiles(cwd: string): Promise<string[]> {
    try {
      const { stdout } = await this.execFile('git', ['diff', '--name-only', '--diff-filter=U'], {
        cwd,
      });
      return stdout
        .trim()
        .split('\n')
        .filter((f) => f.length > 0)
        .map((f) => f.replace(/\\/g, '/'));
    } catch (error) {
      throw this.parseGitError(error);
    }
  }

  async stageFiles(cwd: string, files: string[]): Promise<void> {
    try {
      await this.execFile('git', ['add', ...files], { cwd });
    } catch (error) {
      throw this.parseGitError(error);
    }
  }

  async rebaseContinue(cwd: string): Promise<void> {
    try {
      await this.execFile('git', ['rebase', '--continue'], {
        cwd,
        env: { ...process.env, GIT_EDITOR: 'true' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cause = error instanceof Error ? error : undefined;

      if (message.includes('CONFLICT') || message.includes('could not apply')) {
        throw new GitPrError(
          `Rebase continue encountered new conflicts: ${message}`,
          GitPrErrorCode.REBASE_CONFLICT,
          cause
        );
      }
      throw this.parseGitError(error);
    }
  }

  async rebaseAbort(cwd: string): Promise<void> {
    try {
      await this.execFile('git', ['rebase', '--abort'], { cwd });
    } catch (error) {
      throw this.parseGitError(error);
    }
  }

  async stash(cwd: string, message?: string): Promise<boolean> {
    try {
      const args = ['stash', 'push'];
      if (message) {
        args.push('-m', message);
      }
      const { stdout } = await this.execFile('git', args, { cwd });
      // git stash push outputs "No local changes to save" when clean
      return !stdout.includes('No local changes to save');
    } catch (error) {
      throw this.parseGitError(error);
    }
  }

  async stashPop(cwd: string): Promise<void> {
    try {
      await this.execFile('git', ['stash', 'pop'], { cwd });
    } catch (error) {
      throw this.parseGitError(error);
    }
  }

  async stashDrop(cwd: string): Promise<void> {
    try {
      await this.execFile('git', ['stash', 'drop'], { cwd });
    } catch (error) {
      throw this.parseGitError(error);
    }
  }

  private parseGitError(error: unknown): GitPrError {
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? error : undefined;

    if (message.includes('CONFLICT') && message.includes('rebase')) {
      return new GitPrError(message, GitPrErrorCode.REBASE_CONFLICT, cause);
    }
    if (message.includes('non-fast-forward') || message.includes('diverged')) {
      return new GitPrError(message, GitPrErrorCode.SYNC_FAILED, cause);
    }
    if (message.includes('rejected') || message.includes('conflict')) {
      return new GitPrError(message, GitPrErrorCode.MERGE_CONFLICT, cause);
    }
    if (message.includes('Authentication') || message.includes('auth') || message.includes('403')) {
      return new GitPrError(message, GitPrErrorCode.AUTH_FAILURE, cause);
    }

    return new GitPrError(message, GitPrErrorCode.GIT_ERROR, cause);
  }
}
