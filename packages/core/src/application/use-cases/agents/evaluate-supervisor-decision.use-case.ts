/**
 * EvaluateSupervisorDecisionUseCase
 *
 * Single entry point used by the supervisor worker (and any other caller
 * that needs an evaluation) to:
 *
 *   1. Short-circuit when the `collaboration` feature flag is off
 *      (NFR-14 byte-identical default behaviour).
 *   2. Resolve the effective {@link SupervisorPolicy} for the event's
 *      scope via {@link GetSupervisorPolicyUseCase} (feature-then-app
 *      fallback). When no policy exists the caller is told nothing was
 *      done.
 *   3. Call {@link ISupervisorAgent.evaluate} for the LLM (or stub)
 *      verdict.
 *   4. Persist the immutable {@link SupervisorDecision} via
 *      {@link ISupervisorDecisionRepository}.
 *   5. Mirror the decision into `activity_log` with `actor_id =
 *      supervisor:<supervisorRunId>` for audit reproducibility (research
 *      decision 8).
 *
 * Persistence is centralised here so the LangGraph adapter and the
 * in-memory adapter remain pure evaluators (no side effects).
 */

import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'node:crypto';

import type { IActivityLogRepository } from '../../ports/output/repositories/activity-log-repository.interface.js';
import type { ISettingsRepository } from '../../ports/output/repositories/settings.repository.interface.js';
import type { ISupervisorDecisionRepository } from '../../ports/output/repositories/supervisor-decision-repository.interface.js';
import type {
  ISupervisorAgent,
  SupervisorEvent,
} from '../../ports/output/agents/supervisor-agent.interface.js';
import type {
  ActivityEntry,
  SupervisorDecision,
  SupervisorPolicy,
} from '../../../domain/generated/output.js';
import { GetSupervisorPolicyUseCase } from './get-supervisor-policy.use-case.js';

export interface EvaluateSupervisorDecisionInput {
  /** Source event being evaluated. */
  event: SupervisorEvent;
  /**
   * AgentRun id of the supervisor itself (the worker's own run). Stored
   * on the decision row and embedded in the audit `actorId` namespace.
   */
  supervisorRunId: string;
}

export interface EvaluateSupervisorDecisionResult {
  /** True when an evaluation actually ran (flag on + policy found). */
  evaluated: boolean;
  /** The persisted decision — populated only when `evaluated` is true. */
  decision?: SupervisorDecision;
  /**
   * Diagnostic reason returned when `evaluated` is false. Stable string
   * so the caller can branch deterministically.
   */
  skippedReason?: 'flag-off' | 'no-policy';
}

@injectable()
export class EvaluateSupervisorDecisionUseCase {
  constructor(
    @inject('ISupervisorAgent')
    private readonly supervisorAgent: ISupervisorAgent,
    @inject('ISupervisorDecisionRepository')
    private readonly decisionRepository: ISupervisorDecisionRepository,
    @inject('IActivityLogRepository')
    private readonly activityLog: IActivityLogRepository,
    @inject('ISettingsRepository')
    private readonly settings: ISettingsRepository,
    private readonly getPolicy: GetSupervisorPolicyUseCase
  ) {}

  async execute(input: EvaluateSupervisorDecisionInput): Promise<EvaluateSupervisorDecisionResult> {
    if (!(await this.isCollaborationEnabled())) {
      return { evaluated: false, skippedReason: 'flag-off' };
    }

    const { event, supervisorRunId } = input;

    const policy = await this.getPolicy.execute({
      appId: event.appId,
      featureId: event.featureId,
    });
    if (!policy) {
      return { evaluated: false, skippedReason: 'no-policy' };
    }

    const result = await this.supervisorAgent.evaluate({ event, policy });

    const now = new Date();
    const decision: SupervisorDecision = {
      id: randomUUID(),
      appId: event.appId,
      featureId: event.featureId,
      supervisorRunId,
      sourceEventKind: event.kind,
      sourceEventId: event.sourceEventId,
      verdict: result.verdict,
      rationale: result.rationale,
      modelId: result.modelId,
      promptVersion: result.promptVersion,
      ruleRef: result.ruleRef,
      confidence: result.confidence,
      createdAt: now,
      updatedAt: now,
    };

    await this.decisionRepository.create(decision);
    await this.mirrorToActivityLog(decision, policy, now);

    return { evaluated: true, decision };
  }

  /**
   * Append a single audit row describing the decision. The mirror lives
   * here (rather than in the repository) so the activity-log shape is
   * not coupled to supervisor concerns and so a future audit-target
   * (PmAuditLog, structured logger, etc.) can be swapped in via DI.
   */
  private async mirrorToActivityLog(
    decision: SupervisorDecision,
    policy: SupervisorPolicy,
    timestamp: Date
  ): Promise<void> {
    const entry: ActivityEntry = {
      id: randomUUID(),
      // The source event id — gate id, question id, message id — is the
      // closest analogue to a "work item" in the supervisor flow. We
      // intentionally reuse this field so the audit drawer can list every
      // decision attached to the same source event.
      workItemId: decision.sourceEventId,
      fieldName: `supervisor.${decision.sourceEventKind}`,
      oldValue: undefined,
      newValue: decision.verdict,
      actorId: `supervisor:${decision.supervisorRunId}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.activityLog.create(entry);
    // Touch policy so static type-checkers know the parameter is used —
    // future auditing rules may reference policy.id / autonomyLevel.
    void policy.id;
  }

  private async isCollaborationEnabled(): Promise<boolean> {
    const settings = await this.settings.load();
    return settings?.featureFlags?.collaboration === true;
  }
}
