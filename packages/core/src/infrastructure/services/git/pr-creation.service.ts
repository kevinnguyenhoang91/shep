/**
 * PR Creation Service
 *
 * Handles pull request creation, GitHub repo creation,
 * PR status listing, and mergeable status checks.
 */

import { injectable, inject } from 'tsyringe';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import type {
  PrCreateResult,
  PrStatusInfo,
} from '../../../application/ports/output/services/git-pr-service.interface.js';
import {
  GitPrError,
  GitPrErrorCode,
} from '../../../application/ports/output/services/git-pr-service.interface.js';
import { PrStatus } from '../../../domain/generated/output.js';
import type { ExecFunction } from './worktree.service.js';
import { applyPrBranding } from './pr-branding.js';

@injectable()
export class PrCreationService {
  constructor(@inject('ExecFunction') private readonly execFile: ExecFunction) {}

  async createPr(cwd: string, prYamlPath: string): Promise<PrCreateResult> {
    try {
      // Parse pr.yaml to extract PR metadata
      const prYamlContent = readFileSync(prYamlPath, 'utf-8');
      const prData = yaml.load(prYamlContent) as {
        title?: string;
        body?: string;
        baseBranch?: string;
        headBranch?: string;
        labels?: string[];
        draft?: boolean;
      };

      const title = prData.title ?? 'Untitled PR';
      const body = applyPrBranding(prData.body ?? '');
      const args = ['pr', 'create', '--title', title, '--body', body];

      if (prData.baseBranch) {
        args.push('--base', prData.baseBranch);
      }
      if (prData.headBranch) {
        args.push('--head', prData.headBranch);
      }
      if (prData.labels?.length) {
        args.push('--label', prData.labels.join(','));
      }
      if (prData.draft) {
        args.push('--draft');
      }

      const { stdout } = await this.execFile('gh', args, { cwd });
      const url = stdout.trim();
      const number = this.parsePrNumberFromUrl(url);
      return { url, number };
    } catch (error) {
      throw this.parseGhError(error);
    }
  }

  async createGitHubRepo(
    cwd: string,
    name: string,
    options: { isPrivate: boolean; org?: string }
  ): Promise<string> {
    const repoName = options.org ? `${options.org}/${name}` : name;
    const visibilityFlag = options.isPrivate ? '--private' : '--public';
    const args = [
      'repo',
      'create',
      repoName,
      visibilityFlag,
      '--source=.',
      '--remote=origin',
      '--push',
    ];

    try {
      const { stdout, stderr } = await this.execFile('gh', args, { cwd });
      // `gh repo create` emits status lines to stdout/stderr that include the
      // created repo URL somewhere in the output (e.g. "✓ Created repository
      // org/name on GitHub\n  https://github.com/org/name"). Scrape the first
      // github.com URL we can find rather than returning the raw multi-line blob.
      const combined = `${stdout}\n${stderr}`;
      const parsedUrl = this.extractGitHubUrl(combined);
      if (parsedUrl) {
        return parsedUrl;
      }

      // Fall back to `gh repo view` from the cwd — after --push, origin is the
      // authoritative source of the repo URL.
      return await this.queryRepoUrl(cwd);
    } catch (error) {
      const ghError = this.parseGhError(error);
      if (ghError.code === GitPrErrorCode.GIT_ERROR) {
        throw new GitPrError(ghError.message, GitPrErrorCode.REPO_CREATE_FAILED, ghError.cause);
      }
      throw ghError;
    }
  }

  async listPrStatuses(cwd: string): Promise<PrStatusInfo[]> {
    try {
      const { stdout } = await this.execFile(
        'gh',
        [
          'pr',
          'list',
          '--json',
          'number,state,url,headRefName,mergeable',
          '--state',
          'all',
          '--limit',
          '100',
        ],
        { cwd }
      );

      const prs = JSON.parse(stdout) as {
        number: number;
        state: string;
        url: string;
        headRefName: string;
        mergeable?: string;
      }[];
      return prs.map((pr) => ({
        number: pr.number,
        state: this.normalizeGhState(pr.state),
        url: pr.url,
        headRefName: pr.headRefName,
        mergeable: this.parseMergeable(pr.mergeable),
      }));
    } catch (error) {
      throw this.parseGhError(error);
    }
  }

  async getMergeableStatus(cwd: string, prNumber: number): Promise<boolean | undefined> {
    try {
      const { stdout } = await this.execFile(
        'gh',
        ['pr', 'view', String(prNumber), '--json', 'mergeable'],
        { cwd }
      );
      const result = JSON.parse(stdout) as { mergeable?: string };
      return this.parseMergeable(result.mergeable);
    } catch (error) {
      throw this.parseGhError(error);
    }
  }

  private parseMergeable(value: string | undefined): boolean | undefined {
    if (value === 'MERGEABLE') return true;
    if (value === 'CONFLICTING') return false;
    return undefined; // UNKNOWN or missing
  }

  private normalizeGhState(state: string): PrStatus {
    const normalized = state.charAt(0).toUpperCase() + state.slice(1).toLowerCase();
    return normalized as PrStatus;
  }

  private parsePrNumberFromUrl(url: string): number {
    const match = url.match(/\/pull\/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Extracts the first github.com repository URL from a blob of text.
   * Returns a normalized URL without a trailing `.git` suffix or punctuation.
   */
  private extractGitHubUrl(text: string): string | null {
    const match = text.match(/https:\/\/github\.com\/[\w.-]+\/[\w.-]+/);
    if (!match) {
      return null;
    }
    return match[0].replace(/\.git$/, '').replace(/[).,;]+$/, '');
  }

  /**
   * Queries the current repo's URL via `gh repo view --json url`. Used as a
   * fallback when URL parsing from `gh repo create` output fails.
   */
  private async queryRepoUrl(cwd: string): Promise<string> {
    const { stdout } = await this.execFile(
      'gh',
      ['repo', 'view', '--json', 'url', '--jq', '.url'],
      { cwd }
    );
    return stdout.trim();
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
