/**
 * shep supervisor disable
 *
 * Flips the `enabled` flag off on the SupervisorPolicy for the
 * (appId, featureId?) scope. Idempotent.
 */

import { Command } from 'commander';
import { container } from '@/infrastructure/di/container.js';
import { DisableSupervisorUseCase } from '@/application/use-cases/agents/disable-supervisor.use-case.js';
import { messages } from '../../ui/index.js';

interface DisableOptions {
  app: string;
  feature?: string;
}

export function createDisableCommand(): Command {
  return new Command('disable')
    .description('Disable an existing supervisor policy')
    .requiredOption('--app <id>', 'Application id (required)')
    .option('--feature <id>', 'Feature id for a per-feature override')
    .action(async (options: DisableOptions) => {
      try {
        const useCase = container.resolve(DisableSupervisorUseCase);
        const policy = await useCase.execute({
          appId: options.app,
          featureId: options.feature,
        });
        messages.newline();
        messages.warning(
          `Supervisor disabled for ${policy.appId}${policy.featureId ? `/${policy.featureId}` : ''}`
        );
        messages.newline();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        messages.error('Failed to disable supervisor', err);
        process.exitCode = 1;
      }
    });
}
