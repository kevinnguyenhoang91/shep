/**
 * CI Status Service
 *
 * Handles CI-related operations: checking CI status, watching CI runs,
 * retrieving failure logs, and verifying merges.
 */

import { injectable, inject } from 'tsyringe';
import type { CiStatusResult } from '../../../application/ports/output/services/git-pr-service.interface.js';
import {
  GitPrError,
  GitPrErrorCode,
} from '../../../application/ports/output/services/git-pr-service.interface.js';
import type { ExecFunction } from './worktree.service.js';

@injectable()
export class CiStatusService {
  constructor(@inject('ExecFunction') private readonly execFile: ExecFunction) {}

  async getCiStatus(cwd: string, branch: string): Promise<CiStatusResult> {
    try {
      const { stdout } = await this.execFile(
        'gh',
        ['run', 'list', '--branch', branch, '--json', 'conclusion,url', '--limit', '1'],
        { cwd }
      );

      const runs = JSON.parse(stdout) as { conclusion: string | null; url: string }[];
      if (runs.length === 0 || !runs[0].conclusion) {
        return { status: 'pending', runUrl: runs[0]?.url };
      }

      return {
        status: runs[0].conclusion === 'success' ? 'success' : 'failure',
        runUrl: runs[0].url,
      };
    } catch (error) {
      throw this.parseGhError(error);
    }
  }

  async watchCi(
    cwd: string,
    branch: string,
    timeoutMs?: number,
    intervalSeconds?: number
  ): Promise<CiStatusResult> {
    // Resolve the latest run for the branch BEFORE the try/catch so the
    // runUrl is available in both success and failure return paths.
    let runUrl: string | undefined;
    try {
      // gh run watch requires a run ID — it does not support --branch.
      // First, resolve the latest run ID for the branch via gh run list.
      const { stdout: listOut } = await this.execFile(
        'gh',
        ['run', 'list', '--branch', branch, '--json', 'databaseId,url', '--limit', '1'],
        { cwd }
      );
      const runs = JSON.parse(listOut) as { databaseId: number; url: string }[];
      if (runs.length === 0 || !runs[0].databaseId) {
        return { status: 'pending' };
      }

      const runId = String(runs[0].databaseId);
      runUrl = runs[0].url;
      const interval = intervalSeconds ?? 30;
      const args = [
        'run',
        'watch',
        runId,
        '--exit-status',
        '--compact',
        '--interval',
        String(interval),
      ];
      const { stdout } = await this.execFile('gh', args, {
        cwd,
        ...(timeoutMs ? { timeout: timeoutMs } : {}),
      });

      // gh run watch --exit-status exits 0 when the run succeeds.
      // If we reach here (no exception), CI passed — no need for fragile stdout parsing.
      return {
        status: 'success',
        runUrl,
        logExcerpt: stdout.trim(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cause = error instanceof Error ? error : undefined;
      if (message.includes('timed out') || message.includes('timeout')) {
        throw new GitPrError(message, GitPrErrorCode.CI_TIMEOUT, cause);
      }
      // gh run watch --exit-status exits non-zero when the run fails.
      // Node.js execFile produces errors with a numeric `code` (exit code) and
      // stdout/stderr from the process. The error.message is typically
      // "Command failed: gh run watch <id> --exit-status\n" — detect this by
      // checking for a numeric exit code or the "Command failed" prefix.
      const exitCode = (error as NodeJS.ErrnoException)?.code;
      const hasNumericExitCode = typeof exitCode === 'number';
      const isCommandFailure = message.includes('Command failed') || message.includes('exit code');
      if (hasNumericExitCode || isCommandFailure) {
        // Build a useful log excerpt from stdout/stderr if available
        const errObj = error as { stdout?: string; stderr?: string };
        const parts = [errObj.stdout, errObj.stderr, message].filter(Boolean);
        return { status: 'failure', runUrl, logExcerpt: parts.join('\n').trim() };
      }
      throw new GitPrError(message, GitPrErrorCode.GIT_ERROR, cause);
    }
  }

  async getFailureLogs(
    cwd: string,
    runId: string,
    _branch: string,
    logMaxChars = 50_000
  ): Promise<string> {
    try {
      const { stdout } = await this.execFile('gh', ['run', 'view', runId, '--log-failed'], {
        cwd,
      });
      return this.truncateLog(stdout, logMaxChars, runId);
    } catch (error) {
      throw this.parseGhError(error);
    }
  }

  async verifyMerge(
    cwd: string,
    featureBranch: string,
    baseBranch: string,
    premergeBaseSha?: string
  ): Promise<boolean> {
    // Resolve the feature branch ref — the local branch may have been deleted
    // after a squash merge (git branch -d succeeds when pushed to remote).
    // Fall back to the remote tracking branch if the local ref is gone.
    const resolvedRef = await this.resolveRef(cwd, featureBranch);
    if (!resolvedRef) return false;

    // First try: true merge (feature branch is ancestor of base)
    try {
      await this.execFile('git', ['merge-base', '--is-ancestor', resolvedRef, baseBranch], {
        cwd,
      });
      return true;
    } catch {
      // Not a true merge — check for squash merge by comparing tree content.
      // After a squash merge, all changes from the feature branch are on the base
      // branch, so `git diff featureBranch baseBranch` should produce no output.
    }

    try {
      await this.execFile('git', ['diff', '--quiet', resolvedRef, baseBranch], { cwd });
      // --quiet exits 0 when there's no diff → squash merge verified
      return true;
    } catch {
      // Exit code 1 = diff exists (not merged), other errors also mean unverified.
      // Fall through to premergeBaseSha check if available.
    }

    // Third fallback: if the caller recorded the base branch HEAD before the merge
    // agent ran, check whether it advanced. This handles agents that legitimately
    // modify the tree during squash merge (e.g. adding .gitignore, removing
    // node_modules). If baseBranch HEAD moved forward, the agent committed something.
    if (premergeBaseSha) {
      try {
        const { stdout } = await this.execFile('git', ['rev-parse', baseBranch], { cwd });
        const currentSha = stdout.trim();
        return currentSha !== premergeBaseSha;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Resolve a branch name to a valid git ref, falling back to the remote
   * tracking branch if the local ref has been deleted.
   */
  private async resolveRef(cwd: string, branch: string): Promise<string | null> {
    // Try local ref first
    try {
      await this.execFile('git', ['rev-parse', '--verify', branch], { cwd });
      return branch;
    } catch {
      // Local ref doesn't exist
    }

    // Try remote tracking branch
    const remoteRef = `origin/${branch}`;
    try {
      await this.execFile('git', ['rev-parse', '--verify', remoteRef], { cwd });
      return remoteRef;
    } catch {
      return null;
    }
  }

  private truncateLog(output: string, maxChars: number, runId: string): string {
    if (output.length <= maxChars) return output;
    return `${output.slice(
      0,
      maxChars
    )}\n[Log truncated at ${maxChars} chars — full log available via gh run view ${runId}]`;
  }

  private parseGhError(error: unknown): GitPrError {
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? error : undefined;
    const errnoCode = (error as NodeJS.ErrnoException)?.code;

    if (errnoCode === 'ENOENT' || message.includes('ENOENT')) {
      return new GitPrError(message, GitPrErrorCode.GH_NOT_FOUND, cause);
    }
    if (message.includes('Authentication') || message.includes('auth') || message.includes('403')) {
      return new GitPrError(message, GitPrErrorCode.AUTH_FAILURE, cause);
    }

    return new GitPrError(message, GitPrErrorCode.GIT_ERROR, cause);
  }
}
