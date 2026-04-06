/**
 * Agent Infrastructure module — Agent executor factory, provider, caller,
 * registry, runner, process monitor.
 */

import type { DependencyContainer } from 'tsyringe';
import type Database from 'better-sqlite3';
import { spawn } from 'node:child_process';

import type { ISettingsRepository } from '../../../application/ports/output/repositories/settings.repository.interface.js';
import type { IAgentExecutorFactory } from '../../../application/ports/output/agents/agent-executor-factory.interface.js';
import type { IAgentExecutorProvider } from '../../../application/ports/output/agents/agent-executor-provider.interface.js';
import type { IStructuredAgentCaller } from '../../../application/ports/output/agents/structured-agent-caller.interface.js';
import type { IAgentRegistry } from '../../../application/ports/output/agents/agent-registry.interface.js';
import type { IAgentRunner } from '../../../application/ports/output/agents/agent-runner.interface.js';
import type { IAgentRunRepository } from '../../../application/ports/output/agents/agent-run-repository.interface.js';
import type { IPhaseTimingRepository } from '../../../application/ports/output/agents/phase-timing-repository.interface.js';
import type { IFeatureAgentProcessService } from '../../../application/ports/output/agents/feature-agent-process.interface.js';
import { AgentExecutorFactory } from '../../services/agents/common/agent-executor-factory.service.js';
import { AgentExecutorProvider } from '../../services/agents/common/agent-executor-provider.service.js';
import { StructuredAgentCallerService } from '../../services/agents/common/structured-agent-caller.service.js';
import { MockAgentExecutorFactory } from '../../services/agents/common/executors/mock-executor-factory.service.js';
import { AgentRegistryService } from '../../services/agents/common/agent-registry.service.js';
import { AgentRunnerService } from '../../services/agents/common/agent-runner.service.js';
import { SQLiteAgentRunRepository } from '../../repositories/agent-run.repository.js';
import { SQLitePhaseTimingRepository } from '../../repositories/sqlite-phase-timing.repository.js';
import { FeatureAgentProcessService } from '../../services/agents/feature-agent/feature-agent-process.service.js';

export function registerAgentInfrastructure(container: DependencyContainer): void {
  container.register<IAgentRunRepository>('IAgentRunRepository', {
    useFactory: (c) => {
      const database = c.resolve<Database.Database>('Database');
      return new SQLiteAgentRunRepository(database);
    },
  });

  container.register<IPhaseTimingRepository>('IPhaseTimingRepository', {
    useFactory: (c) => {
      const database = c.resolve<Database.Database>('Database');
      return new SQLitePhaseTimingRepository(database);
    },
  });

  if (process.env.SHEP_MOCK_EXECUTOR === '1') {
    container.register<IAgentExecutorFactory>('IAgentExecutorFactory', {
      useFactory: () => new MockAgentExecutorFactory(),
    });
  } else {
    container.register<IAgentExecutorFactory>('IAgentExecutorFactory', {
      useFactory: () => {
        // Wrap spawn with sensible defaults: stdio piped and windowsHide on Win32.
        // Each executor controls its own `shell` option — cursor needs shell: true
        // for .cmd scripts, but claude-code must NOT use shell (DEP0190 / prompt mangling).
        const spawnWithPipe = (command: string, args: string[], options?: object) => {
          return spawn(command, args, {
            stdio: 'pipe',
            ...(process.platform === 'win32' ? { windowsHide: true } : {}),
            ...options,
          });
        };
        return new AgentExecutorFactory(spawnWithPipe);
      },
    });
  }

  container.register<IAgentExecutorProvider>('IAgentExecutorProvider', {
    useFactory: (c) => {
      const factory = c.resolve<IAgentExecutorFactory>('IAgentExecutorFactory');
      const settingsRepo = c.resolve<ISettingsRepository>('ISettingsRepository');
      return new AgentExecutorProvider(factory, settingsRepo);
    },
  });

  container.register<IStructuredAgentCaller>('IStructuredAgentCaller', {
    useFactory: (c) => {
      const provider = c.resolve<IAgentExecutorProvider>('IAgentExecutorProvider');
      const factory = c.resolve<IAgentExecutorFactory>('IAgentExecutorFactory');
      return new StructuredAgentCallerService(provider, factory);
    },
  });

  container.register<IAgentRegistry>('IAgentRegistry', {
    useFactory: () => new AgentRegistryService(),
  });

  container.register<IAgentRunner>('IAgentRunner', {
    useFactory: (c) => {
      const registry = c.resolve<IAgentRegistry>('IAgentRegistry');
      const executorProvider = c.resolve<IAgentExecutorProvider>('IAgentExecutorProvider');
      const runRepository = c.resolve<IAgentRunRepository>('IAgentRunRepository');
      // Checkpointer is lazy-loaded to avoid ~240ms startup cost from
      // @langchain/langgraph-checkpoint-sqlite on every CLI invocation.
      return new AgentRunnerService(registry, executorProvider, runRepository);
    },
  });

  container.register<IFeatureAgentProcessService>('IFeatureAgentProcessService', {
    useFactory: (c) => {
      const runRepository = c.resolve<IAgentRunRepository>('IAgentRunRepository');
      return new FeatureAgentProcessService(runRepository);
    },
  });
}
