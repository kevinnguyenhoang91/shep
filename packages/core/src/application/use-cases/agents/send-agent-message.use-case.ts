/**
 * SendAgentMessageUseCase
 *
 * Application-layer entry point for publishing an {@link AgentMessage} to
 * the {@link IAgentMessageBus}. Enforces:
 *
 *  - The hub-and-spoke addressing rule (peer addressing rejected at the
 *    use-case boundary so the error is surfaced before any persistence).
 *  - The collaboration feature flag short-circuit (NFR-14): with the flag
 *    off, no message is written and consumers receive `enabled: false`.
 *
 * The use case generates the message id and timestamps so callers do not
 * need to know about the persistence shape. Payload may be passed as a
 * string (already-serialized) or a structured object (auto-stringified).
 */

import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'node:crypto';
import type { IAgentMessageBus } from '../../ports/output/agents/agent-message-bus.interface.js';
import { ALLOWED_AGENT_MESSAGE_TARGET_KINDS } from '../../ports/output/agents/agent-message-bus.interface.js';
import type { ISettingsRepository } from '../../ports/output/repositories/settings.repository.interface.js';
import type { AgentMessage, AgentMessageKind } from '../../../domain/generated/output.js';
import { PeerAddressingForbiddenError } from '../../../domain/errors/peer-addressing-forbidden.error.js';

export interface SendAgentMessageInput {
  appId: string;
  featureId?: string;
  fromActor: string;
  fromAgentRunId?: string;
  toTarget: string;
  toKind: string;
  messageKind: AgentMessageKind;
  payload: unknown;
  correlationId?: string;
}

export interface SendAgentMessageResult {
  /** True when the collaboration feature flag is on and the publish was attempted. */
  enabled: boolean;
  /** The persisted message — populated only when `enabled` is true. */
  message?: AgentMessage;
}

@injectable()
export class SendAgentMessageUseCase {
  constructor(
    @inject('IAgentMessageBus')
    private readonly bus: IAgentMessageBus,
    @inject('ISettingsRepository')
    private readonly settings: ISettingsRepository
  ) {}

  async execute(input: SendAgentMessageInput): Promise<SendAgentMessageResult> {
    if (input.toKind === 'peer' || !ALLOWED_AGENT_MESSAGE_TARGET_KINDS.includes(input.toKind)) {
      throw new PeerAddressingForbiddenError(input.toKind);
    }

    const flagOn = await this.isCollaborationEnabled();
    if (!flagOn) {
      return { enabled: false };
    }

    const now = new Date();
    const message: AgentMessage = {
      id: randomUUID(),
      appId: input.appId,
      featureId: input.featureId,
      fromAgentRunId: input.fromAgentRunId,
      fromActor: input.fromActor,
      toTarget: input.toTarget,
      toKind: input.toKind,
      messageKind: input.messageKind,
      payload: typeof input.payload === 'string' ? input.payload : JSON.stringify(input.payload),
      correlationId: input.correlationId,
      deliveredAt: undefined,
      createdAt: now,
      updatedAt: now,
    };

    await this.bus.publish(message);
    return { enabled: true, message };
  }

  private async isCollaborationEnabled(): Promise<boolean> {
    const settings = await this.settings.load();
    return settings?.featureFlags?.collaboration === true;
  }
}
