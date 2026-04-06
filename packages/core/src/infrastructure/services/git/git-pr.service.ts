/**
 * Git PR Service — Facade
 *
 * Thin facade that delegates to focused sub-services:
 * - DiffAnalyzerService — diff analysis
 * - BranchDiscoveryService — branch/remote discovery
 * - CiStatusService — CI status, watch, failure logs, merge verification
 * - PrCreationService — PR creation, GitHub repo creation, PR status
 * - MergeStrategyService — merge, rebase, sync, conflict resolution, stash
 *
 * Preserves the IGitPrService contract and backward-compatible constructor
 * signature so all existing callers (including tests using `new GitPrService(execFn)`)
 * continue to work without modification.
 */

import { injectable, inject } from 'tsyringe';
import type { IGitPrService } from '../../../application/ports/output/services/git-pr-service.interface.js';
import type {
  CiStatusResult,
  DiffSummary,
  FileDiff,
  MergeStrategy,
  PrCreateResult,
  PrStatusInfo,
} from '../../../application/ports/output/services/git-pr-service.interface.js';
import type { ExecFunction } from './worktree.service.js';
import { DiffAnalyzerService } from './diff-analyzer.service.js';
import { BranchDiscoveryService } from './branch-discovery.service.js';
import { CiStatusService } from './ci-status.service.js';
import { PrCreationService } from './pr-creation.service.js';
import { MergeStrategyService } from './merge-strategy.service.js';

@injectable()
export class GitPrService implements IGitPrService {
  private readonly diffAnalyzer: DiffAnalyzerService;
  private readonly branchDiscovery: BranchDiscoveryService;
  private readonly ciStatus: CiStatusService;
  private readonly prCreation: PrCreationService;
  private readonly mergeStrategy: MergeStrategyService;

  /**
   * Accepts either:
   * 1. A single ExecFunction (backward-compatible — creates sub-services internally)
   * 2. Five pre-built sub-services (used by DI container)
   */
  constructor(
    @inject('ExecFunction') execFileOrDiffAnalyzer: ExecFunction | DiffAnalyzerService,
    branchDiscovery?: BranchDiscoveryService,
    ciStatus?: CiStatusService,
    prCreation?: PrCreationService,
    mergeStrategy?: MergeStrategyService
  ) {
    if (
      typeof execFileOrDiffAnalyzer === 'function' &&
      !branchDiscovery &&
      !ciStatus &&
      !prCreation &&
      !mergeStrategy
    ) {
      // Backward-compatible: single ExecFunction — build sub-services internally
      const execFile = execFileOrDiffAnalyzer;
      this.diffAnalyzer = new DiffAnalyzerService(execFile);
      this.branchDiscovery = new BranchDiscoveryService(execFile);
      this.ciStatus = new CiStatusService(execFile);
      this.prCreation = new PrCreationService(execFile);
      this.mergeStrategy = new MergeStrategyService(execFile);
    } else {
      // DI path: pre-built sub-services
      this.diffAnalyzer = execFileOrDiffAnalyzer as unknown as DiffAnalyzerService;
      this.branchDiscovery = branchDiscovery!;
      this.ciStatus = ciStatus!;
      this.prCreation = prCreation!;
      this.mergeStrategy = mergeStrategy!;
    }
  }

  // --- Branch Discovery ---

  hasRemote(cwd: string): Promise<boolean> {
    return this.branchDiscovery.hasRemote(cwd);
  }

  getRemoteUrl(cwd: string): Promise<string | null> {
    return this.branchDiscovery.getRemoteUrl(cwd);
  }

  getDefaultBranch(cwd: string): Promise<string> {
    return this.branchDiscovery.getDefaultBranch(cwd);
  }

  revParse(cwd: string, ref: string): Promise<string> {
    return this.branchDiscovery.revParse(cwd, ref);
  }

  addRemote(cwd: string, remoteName: string, remoteUrl: string): Promise<void> {
    return this.branchDiscovery.addRemote(cwd, remoteName, remoteUrl);
  }

  deleteBranch(cwd: string, branch: string, deleteRemote?: boolean): Promise<void> {
    return this.branchDiscovery.deleteBranch(cwd, branch, deleteRemote);
  }

  getBranchSyncStatus(
    cwd: string,
    featureBranch: string,
    baseBranch: string
  ): Promise<{ ahead: number; behind: number }> {
    return this.branchDiscovery.getBranchSyncStatus(cwd, featureBranch, baseBranch);
  }

  // --- Diff Analysis ---

  getPrDiffSummary(cwd: string, baseBranch: string): Promise<DiffSummary> {
    return this.diffAnalyzer.getPrDiffSummary(cwd, baseBranch);
  }

  getFileDiffs(cwd: string, baseBranch: string): Promise<FileDiff[]> {
    return this.diffAnalyzer.getFileDiffs(cwd, baseBranch);
  }

  // --- CI Status ---

  getCiStatus(cwd: string, branch: string): Promise<CiStatusResult> {
    return this.ciStatus.getCiStatus(cwd, branch);
  }

  watchCi(
    cwd: string,
    branch: string,
    timeoutMs?: number,
    intervalSeconds?: number
  ): Promise<CiStatusResult> {
    return this.ciStatus.watchCi(cwd, branch, timeoutMs, intervalSeconds);
  }

  getFailureLogs(
    cwd: string,
    runId: string,
    branch: string,
    logMaxChars?: number
  ): Promise<string> {
    return this.ciStatus.getFailureLogs(cwd, runId, branch, logMaxChars);
  }

  verifyMerge(
    cwd: string,
    featureBranch: string,
    baseBranch: string,
    premergeBaseSha?: string
  ): Promise<boolean> {
    return this.ciStatus.verifyMerge(cwd, featureBranch, baseBranch, premergeBaseSha);
  }

  // --- PR Creation ---

  createPr(cwd: string, prYamlPath: string): Promise<PrCreateResult> {
    return this.prCreation.createPr(cwd, prYamlPath);
  }

  createGitHubRepo(
    cwd: string,
    name: string,
    options: { isPrivate: boolean; org?: string }
  ): Promise<string> {
    return this.prCreation.createGitHubRepo(cwd, name, options);
  }

  listPrStatuses(cwd: string): Promise<PrStatusInfo[]> {
    return this.prCreation.listPrStatuses(cwd);
  }

  getMergeableStatus(cwd: string, prNumber: number): Promise<boolean | undefined> {
    return this.prCreation.getMergeableStatus(cwd, prNumber);
  }

  // --- Merge Strategy ---

  hasUncommittedChanges(cwd: string): Promise<boolean> {
    return this.mergeStrategy.hasUncommittedChanges(cwd);
  }

  commitAll(cwd: string, message: string): Promise<string> {
    return this.mergeStrategy.commitAll(cwd, message);
  }

  push(cwd: string, branch: string, setUpstream?: boolean): Promise<void> {
    return this.mergeStrategy.push(cwd, branch, setUpstream);
  }

  mergePr(cwd: string, prNumber: number, strategy?: MergeStrategy): Promise<void> {
    return this.mergeStrategy.mergePr(cwd, prNumber, strategy);
  }

  localMergeSquash(
    cwd: string,
    featureBranch: string,
    baseBranch: string,
    commitMessage: string,
    hasRemote?: boolean
  ): Promise<void> {
    return this.mergeStrategy.localMergeSquash(
      cwd,
      featureBranch,
      baseBranch,
      commitMessage,
      hasRemote
    );
  }

  mergeBranch(cwd: string, sourceBranch: string, targetBranch: string): Promise<void> {
    return this.mergeStrategy.mergeBranch(cwd, sourceBranch, targetBranch);
  }

  syncMain(cwd: string, baseBranch: string): Promise<void> {
    return this.mergeStrategy.syncMain(cwd, baseBranch);
  }

  rebaseOnMain(cwd: string, featureBranch: string, baseBranch: string): Promise<void> {
    return this.mergeStrategy.rebaseOnMain(cwd, featureBranch, baseBranch);
  }

  getConflictedFiles(cwd: string): Promise<string[]> {
    return this.mergeStrategy.getConflictedFiles(cwd);
  }

  stageFiles(cwd: string, files: string[]): Promise<void> {
    return this.mergeStrategy.stageFiles(cwd, files);
  }

  rebaseContinue(cwd: string): Promise<void> {
    return this.mergeStrategy.rebaseContinue(cwd);
  }

  rebaseAbort(cwd: string): Promise<void> {
    return this.mergeStrategy.rebaseAbort(cwd);
  }

  stash(cwd: string, message?: string): Promise<boolean> {
    return this.mergeStrategy.stash(cwd, message);
  }

  stashPop(cwd: string): Promise<void> {
    return this.mergeStrategy.stashPop(cwd);
  }

  stashDrop(cwd: string): Promise<void> {
    return this.mergeStrategy.stashDrop(cwd);
  }
}
