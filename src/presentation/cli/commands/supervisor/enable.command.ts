/**
 * shep supervisor enable
 *
 * Flips the `enabled` flag on the SupervisorPolicy for the
 * (appId, featureId?) scope without touching any other field. Idempotent.
 */

import { Command } from 'commander';
import { container } from '@/infrastructure/di/container.js';
import { EnableSupervisorUseCase } from '@/application/use-cases/agents/enable-supervisor.use-case.js';
import { messages } from '../../ui/index.js';

interface EnableOptions {
  app: string;
  feature?: string;
}

export function createEnableCommand(): Command {
  return new Command('enable')
    .description('Enable an existing supervisor policy')
    .requiredOption('--app <id>', 'Application id (required)')
    .option('--feature <id>', 'Feature id for a per-feature override')
    .action(async (options: EnableOptions) => {
      try {
        const useCase = container.resolve(EnableSupervisorUseCase);
        const policy = await useCase.execute({
          appId: options.app,
          featureId: options.feature,
        });
        messages.newline();
        messages.success(
          `Supervisor enabled for ${policy.appId}${policy.featureId ? `/${policy.featureId}` : ''}`
        );
        messages.newline();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        messages.error('Failed to enable supervisor', err);
        process.exitCode = 1;
      }
    });
}
