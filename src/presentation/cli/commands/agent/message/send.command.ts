/**
 * shep agent message send
 *
 * Dev-only debug aid that publishes a single message on the
 * IAgentMessageBus via SendAgentMessageUseCase. The command is
 * blocked in production builds (see dev-mode.ts) so end users do
 * not accidentally inject traffic onto the bus.
 *
 * The hub-and-spoke addressing rule is enforced inside the use case:
 * `--to-kind peer` is rejected with PeerAddressingForbiddenError so
 * any debug attempt at peer addressing surfaces as a typed failure.
 */

import { Command, Option } from 'commander';
import { container } from '@/infrastructure/di/container.js';
import { SendAgentMessageUseCase } from '@/application/use-cases/agents/send-agent-message.use-case.js';
import { AgentMessageKind } from '@/domain/generated/output.js';
import { colors, messages } from '../../../ui/index.js';
import { isDevModeEnabled } from './dev-mode.js';

interface SendOptions {
  app: string;
  feature?: string;
  fromActor: string;
  fromAgentRunId?: string;
  toTarget: string;
  toKind: string;
  messageKind: AgentMessageKind;
  payload: string;
  correlationId?: string;
}

const KIND_VALUES = Object.values(AgentMessageKind) as string[];

export function createSendCommand(): Command {
  return new Command('send')
    .description('[dev] publish a single inter-agent message on the bus')
    .requiredOption('--app <id>', 'Application id (required for scope isolation)')
    .option('--feature <id>', 'Feature id (optional)')
    .requiredOption('--from-actor <actor>', 'Actor namespace (e.g. agent:run-1, user:cli)')
    .option('--from-agent-run-id <id>', 'Optional agentRunId for the sender')
    .requiredOption(
      '--to-target <target>',
      "Recipient — agentRunId, 'broadcast', 'supervisor', or 'user'"
    )
    .addOption(
      new Option('--to-kind <kind>', 'Target kind').choices([
        'broadcast',
        'supervisor',
        'user',
        'agent',
      ])
    )
    .addOption(
      new Option('--message-kind <kind>', 'Message kind')
        .choices(KIND_VALUES)
        .default(AgentMessageKind.info)
    )
    .requiredOption('--payload <json>', 'JSON string to publish as the payload')
    .option('--correlation-id <id>', 'Optional correlation id for request/reply')
    .action(async (options: SendOptions) => {
      try {
        if (!isDevModeEnabled()) {
          throw new Error(
            'shep agent message send is disabled in production builds — set SHEP_DEV_TOOLS=1 to enable'
          );
        }

        const useCase = container.resolve(SendAgentMessageUseCase);
        const result = await useCase.execute({
          appId: options.app,
          featureId: options.feature,
          fromActor: options.fromActor,
          fromAgentRunId: options.fromAgentRunId,
          toTarget: options.toTarget,
          toKind: options.toKind ?? 'broadcast',
          messageKind: options.messageKind,
          payload: parsePayload(options.payload),
          correlationId: options.correlationId,
        });

        if (!result.enabled) {
          throw new Error('Collaboration feature flag is off — enable it before sending messages');
        }

        messages.newline();
        messages.success(`Published agent message ${colors.info(result.message?.id ?? '')}`);
        messages.newline();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        messages.error('Failed to send agent message', err);
        process.exitCode = 1;
      }
    });
}

function parsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // Bus accepts pre-serialized strings, so fall through with the raw value.
    return raw;
  }
}
