/**
 * shep supervisor status
 *
 * Shows the effective SupervisorPolicy for the (appId, featureId?)
 * scope, falling back from feature → app per the resolution rules in
 * GetSupervisorPolicyUseCase.
 */

import { Command } from 'commander';
import { container } from '@/infrastructure/di/container.js';
import { GetSupervisorPolicyUseCase } from '@/application/use-cases/agents/get-supervisor-policy.use-case.js';
import { colors, messages, symbols } from '../../ui/index.js';

interface StatusOptions {
  app: string;
  feature?: string;
}

export function createStatusCommand(): Command {
  return new Command('status')
    .description('Show the effective supervisor policy for an app or feature')
    .requiredOption('--app <id>', 'Application id (required)')
    .option('--feature <id>', 'Feature id for a per-feature override')
    .action(async (options: StatusOptions) => {
      try {
        const useCase = container.resolve(GetSupervisorPolicyUseCase);
        const policy = await useCase.execute({
          appId: options.app,
          featureId: options.feature,
        });

        if (!policy) {
          messages.newline();
          console.log(`  ${colors.muted(symbols.dotEmpty)} No supervisor policy configured`);
          messages.newline();
          return;
        }

        messages.newline();
        console.log(
          `  ${colors.muted('scope')}      ${policy.appId}${policy.featureId ? `/${policy.featureId}` : ' (app-wide)'}`
        );
        console.log(
          `  ${colors.muted('enabled')}    ${policy.enabled ? colors.success('yes') : colors.muted('no')}`
        );
        console.log(`  ${colors.muted('autonomy')}   ${colors.info(policy.autonomyLevel)}`);
        if (policy.modelId) {
          console.log(`  ${colors.muted('model')}      ${policy.modelId}`);
        }
        if (policy.promptVersion) {
          console.log(`  ${colors.muted('prompt')}     ${policy.promptVersion}`);
        }
        if (policy.gateAuthorityJson) {
          console.log(`  ${colors.muted('gates')}      ${policy.gateAuthorityJson}`);
        }
        messages.newline();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        messages.error('Failed to load supervisor status', err);
        process.exitCode = 1;
      }
    });
}
