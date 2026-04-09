/**
 * Services module — All service registrations (Version, Worktree, ToolInstaller,
 * Git services, IDE, Daemon, Deployment, Attachments, etc.).
 */

import type { DependencyContainer } from 'tsyringe';
import type Database from 'better-sqlite3';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

import { IS_WINDOWS } from '../../platform.js';
import { createSafeExecFileFn } from '../../services/exec/windows-safe-exec.js';

import type { IAgentValidator } from '../../../application/ports/output/agents/agent-validator.interface.js';
import { AgentValidatorService } from '../../services/agents/common/agent-validator.service.js';
import type { IVersionService } from '../../../application/ports/output/services/version-service.interface.js';
import { VersionService } from '../../services/version.service.js';
import type { IWebServerService } from '../../../application/ports/output/services/web-server-service.interface.js';
import type { IWorktreeService } from '../../../application/ports/output/services/worktree-service.interface.js';
import { WorktreeService } from '../../services/git/worktree.service.js';
import type { IToolInstallerService } from '../../../application/ports/output/services/tool-installer.service.js';
import { ToolInstallerServiceImpl } from '../../services/tool-installer/tool-installer.service.js';
import type { IGitPrService } from '../../../application/ports/output/services/git-pr-service.interface.js';
import { GitPrService } from '../../services/git/git-pr.service.js';
import { DiffAnalyzerService } from '../../services/git/diff-analyzer.service.js';
import { BranchDiscoveryService } from '../../services/git/branch-discovery.service.js';
import { CiStatusService } from '../../services/git/ci-status.service.js';
import { PrCreationService } from '../../services/git/pr-creation.service.js';
import { MergeStrategyService } from '../../services/git/merge-strategy.service.js';
import type { IGitForkService } from '../../../application/ports/output/services/git-fork-service.interface.js';
import { GitForkService } from '../../services/git/git-fork.service.js';
import type { ISkillInjectorService } from '../../../application/ports/output/services/skill-injector.interface.js';
import { SkillInjectorService } from '../../services/skill-injector.service.js';
import type { IIdeLauncherService } from '../../../application/ports/output/services/ide-launcher-service.interface.js';
import { JsonDrivenIdeLauncherService } from '../../services/ide-launchers/json-driven-ide-launcher.service.js';
import type { IDaemonService } from '../../../application/ports/output/services/daemon-service.interface.js';
import { DaemonPidService } from '../../services/daemon/daemon-pid.service.js';
import type { IDeploymentService } from '../../../application/ports/output/services/deployment-service.interface.js';
import { DeploymentService } from '../../services/deployment/deployment.service.js';
import { AttachmentStorageService } from '../../services/attachment-storage.service.js';
import type { IGitHubRepositoryService } from '../../../application/ports/output/services/github-repository-service.interface.js';
import { GitHubRepositoryService } from '../../services/external/github-repository.service.js';
import type { ISpecInitializerService } from '../../../application/ports/output/services/spec-initializer.interface.js';
import { SpecInitializerService } from '../../services/spec/spec-initializer.service.js';
import type { IProcessMonitorService } from '../../../application/ports/output/services/process-monitor.interface.js';
import { ProcessMonitorService } from '../../services/process/process-monitor.service.js';
import type { IFileSystemService } from '../../../application/ports/output/services/file-system.interface.js';
import { FileSystemService } from '../../services/filesystem/file-system.service.js';
import type { ISettingsReader } from '../../../application/ports/output/services/settings-reader.interface.js';
import { SettingsReaderAdapter } from '../../services/settings-reader.adapter.js';

export function registerServices(container: DependencyContainer, db: Database.Database): void {
  // Register external dependencies as tokens.
  // On Windows, agent CLIs ship as .cmd/.ps1 scripts (e.g. cursor's `agent.cmd`),
  // so we need `shell: true` to resolve them. Because shell:true makes Node hand
  // args to cmd.exe unquoted, args containing whitespace (e.g. a commit message
  // like "Initial commit") get re-split and break commands. `createSafeExecFileFn`
  // wraps the base execFile so every arg is quoted for cmd.exe before the shell
  // sees it.
  const execFileAsync = promisify(execFile);
  const execFn = createSafeExecFileFn(execFileAsync, IS_WINDOWS);
  container.registerInstance('ExecFunction', execFn);

  // Register services (singletons via @injectable + token)
  container.registerSingleton<IAgentValidator>('IAgentValidator', AgentValidatorService);
  container.registerSingleton<IVersionService>('IVersionService', VersionService);
  // IWebServerService is registered as a lazy proxy to avoid importing `next`
  // (~80ms) for non-web commands. The actual service is loaded on first method call.
  container.register<IWebServerService>('IWebServerService', {
    useFactory: () => {
      let instance: IWebServerService | null = null;
      const getInstance = async (): Promise<IWebServerService> => {
        if (!instance) {
          const { WebServerService } = await import('../../services/web-server.service.js');
          instance = new WebServerService();
        }
        return instance;
      };
      return new Proxy({} as IWebServerService, {
        get: (_target, prop) => {
          return async (...args: unknown[]) => {
            const svc = await getInstance();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (svc as any)[prop](...args);
          };
        },
      });
    },
  });
  container.registerSingleton<IWorktreeService>('IWorktreeService', WorktreeService);
  container.registerSingleton<ISkillInjectorService>('ISkillInjectorService', SkillInjectorService);
  container.registerSingleton<IToolInstallerService>(
    'IToolInstallerService',
    ToolInstallerServiceImpl
  );
  // Git PR sub-services (focused responsibilities, independently injectable)
  container.registerSingleton(DiffAnalyzerService);
  container.registerSingleton(BranchDiscoveryService);
  container.registerSingleton(CiStatusService);
  container.registerSingleton(PrCreationService);
  container.registerSingleton(MergeStrategyService);
  // GitPrService facade — delegates to sub-services, preserves IGitPrService contract
  container.registerSingleton<IGitPrService>('IGitPrService', GitPrService);
  container.registerSingleton<IGitForkService>('IGitForkService', GitForkService);
  container.registerSingleton<IGitHubRepositoryService>(
    'IGitHubRepositoryService',
    GitHubRepositoryService
  );
  container.registerSingleton<IIdeLauncherService>(
    'IIdeLauncherService',
    JsonDrivenIdeLauncherService
  );
  container.registerSingleton<IDaemonService>('IDaemonService', DaemonPidService);
  container.registerSingleton(AttachmentStorageService);
  container.register('AttachmentStorageService', { useToken: AttachmentStorageService });
  const deploymentService = new DeploymentService();
  deploymentService.setDatabase(db);
  deploymentService.recoverAll();
  container.registerInstance<IDeploymentService>('IDeploymentService', deploymentService);

  container.register<ISpecInitializerService>('ISpecInitializerService', {
    useFactory: () => new SpecInitializerService(),
  });

  // Process & filesystem infrastructure adapters
  container.registerSingleton<IProcessMonitorService>(
    'IProcessMonitorService',
    ProcessMonitorService
  );
  container.registerSingleton<IFileSystemService>('IFileSystemService', FileSystemService);

  // Settings reader — port interface wrapping the globalThis singleton
  container.registerSingleton<ISettingsReader>('ISettingsReader', SettingsReaderAdapter);
}
