/**
 * FeatureAgentLifecyclePublisher
 *
 * Thin wrapper around {@link SendAgentMessageUseCase} so the feature-agent
 * worker can broadcast lifecycle messages (started, phase-changed, blocked,
 * completed) on the agent message bus without touching bus internals or
 * the feature-flag check (the use case owns both).
 *
 * Scope derivation: messages are scoped by `appId`. We try to resolve a
 * registered {@link Application} for the worker's repository path; if none
 * exists we use the repository path itself as the stable scope key. This
 * keeps cross-worktree messages consistent without requiring the Feature
 * model to know about Applications.
 *
 * Failures are swallowed: the lifecycle publisher must NOT crash a feature
 * agent if the bus is unavailable. The worker logs each lifecycle event
 * separately for crash diagnosis.
 */

import { inject, injectable } from 'tsyringe';
import type { IApplicationRepository } from '@/application/ports/output/repositories/application-repository.interface.js';
import { SendAgentMessageUseCase } from '@/application/use-cases/agents/send-agent-message.use-case.js';
import { AgentMessageKind } from '@/domain/generated/output.js';

interface BaseInput {
  runId: string;
  featureId: string;
  repositoryPath: string;
}

export interface PhaseChangedInput extends BaseInput {
  phase: string;
}

export interface BlockedInput extends BaseInput {
  reason: string;
}

@injectable()
export class FeatureAgentLifecyclePublisher {
  constructor(
    @inject(SendAgentMessageUseCase)
    private readonly sendAgentMessage: SendAgentMessageUseCase,
    @inject('IApplicationRepository')
    private readonly applicationRepo: IApplicationRepository
  ) {}

  async publishStarted(input: BaseInput): Promise<void> {
    await this.publish(input, AgentMessageKind.status, { event: 'started' });
  }

  async publishPhaseChanged(input: PhaseChangedInput): Promise<void> {
    await this.publish(input, AgentMessageKind.status, {
      event: 'phase-changed',
      phase: input.phase,
    });
  }

  async publishBlocked(input: BlockedInput): Promise<void> {
    await this.publish(input, AgentMessageKind.blocked, {
      event: 'blocked',
      reason: input.reason,
    });
  }

  async publishCompleted(input: BaseInput): Promise<void> {
    await this.publish(input, AgentMessageKind.status, { event: 'completed' });
  }

  private async publish(
    input: BaseInput,
    messageKind: AgentMessageKind,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      const appId = await this.resolveAppId(input.repositoryPath);
      await this.sendAgentMessage.execute({
        appId,
        featureId: input.featureId,
        fromActor: `agent:${input.runId}`,
        fromAgentRunId: input.runId,
        toTarget: 'broadcast',
        toKind: 'broadcast',
        messageKind,
        payload,
      });
    } catch {
      // Swallow — bus outages must not crash the feature-agent worker.
    }
  }

  private async resolveAppId(repositoryPath: string): Promise<string> {
    try {
      const app = await this.applicationRepo.findByPath(repositoryPath);
      if (app?.id) return app.id;
    } catch {
      // Fall through to path-based scope.
    }
    return repositoryPath;
  }
}
