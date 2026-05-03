/**
 * FeatureAgentSupervisorGateEvaluator
 *
 * Bridges the feature-agent worker's `waiting_approval` transition with
 * the {@link EvaluateSupervisorDecisionUseCase} (spec 093, task 29).
 *
 * On every approval-gate interrupt the worker calls
 * {@link evaluateForGate}. The evaluator:
 *
 *  1. Resolves the configured {@link SupervisorPolicy} for the
 *     (scopeType, scopeId, featureId) scope. When no policy is configured the call
 *     is a no-op — pure additive behaviour preserves the existing
 *     human-only path (NFR-14).
 *  2. Computes the effective per-gate autonomy: a `gateAuthorityJson`
 *     entry overrides the policy's default `autonomyLevel`.
 *  3. Calls {@link EvaluateSupervisorDecisionUseCase} which writes the
 *     {@link SupervisorDecision} row and mirrors it to the audit log.
 *  4. In **autonomous** mode for the gate AND when the supervisor's
 *     verdict is `approve` / `reject`, invokes
 *     {@link ApproveAgentRunUseCase} or {@link RejectAgentRunUseCase}
 *     with `actor = supervisor:<supervisorRunId>` so the existing gate
 *     state machine resolves the gate without further human action.
 *  5. In **advisory** and **co-sign** modes the decision is recorded
 *     but the gate stays in `waiting_approval`. The user still drives
 *     the resolution (user always wins). Co-sign awaits both votes by
 *     leaving the gate open for the user — the supervisor's vote is
 *     visible via `activity_log` but does not auto-close.
 *
 * Failures inside the evaluator MUST NOT crash the worker: the gate
 * already transitioned to `waiting_approval` before this hook runs, so
 * a swallowed error degrades to today's user-only flow (FR-22 fail
 * safe).
 */

import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'node:crypto';

import type { IApplicationRepository } from '@/application/ports/output/repositories/application-repository.interface.js';
import { ApproveAgentRunUseCase } from '@/application/use-cases/agents/approve-agent-run.use-case.js';
import { EvaluateSupervisorDecisionUseCase } from '@/application/use-cases/agents/evaluate-supervisor-decision.use-case.js';
import { GetSupervisorPolicyUseCase } from '@/application/use-cases/agents/get-supervisor-policy.use-case.js';
import { RejectAgentRunUseCase } from '@/application/use-cases/agents/reject-agent-run.use-case.js';
import {
  SupervisorAutonomy,
  SupervisorVerdict,
  type SupervisorPolicy,
} from '@/domain/generated/output.js';
import { supervisorActor } from '@/domain/value-objects/supervisor-actor.js';

const DEFAULT_GATE_ID = 'gate';

export interface SupervisorGateEvaluationInput {
  /** Agent run that hit the gate. */
  runId: string;
  /** Feature owning the run. */
  featureId: string;
  /** Repository path used to resolve the App scope. */
  repositoryPath: string;
  /** LangGraph node name that triggered the interrupt (e.g. `prd`, `plan`, `merge`). */
  interruptNode?: string;
}

export interface SupervisorGateEvaluationResult {
  /** True when an evaluation actually ran (flag on + policy found). */
  evaluated: boolean;
  /** Effective autonomy level for the gate (only set when evaluated). */
  effectiveAutonomy?: SupervisorAutonomy;
  /** The supervisor's verdict (only set when evaluated). */
  verdict?: SupervisorVerdict;
  /** True when the supervisor auto-resolved the gate in autonomous mode. */
  autoResolved: boolean;
}

@injectable()
export class FeatureAgentSupervisorGateEvaluator {
  constructor(
    @inject('IApplicationRepository')
    private readonly applicationRepo: IApplicationRepository,
    private readonly getPolicy: GetSupervisorPolicyUseCase,
    private readonly evaluateDecision: EvaluateSupervisorDecisionUseCase,
    @inject(ApproveAgentRunUseCase)
    private readonly approveAgentRun: ApproveAgentRunUseCase,
    @inject(RejectAgentRunUseCase)
    private readonly rejectAgentRun: RejectAgentRunUseCase
  ) {}

  async evaluateForGate(
    input: SupervisorGateEvaluationInput
  ): Promise<SupervisorGateEvaluationResult> {
    try {
      const { scopeType, scopeId } = await this.resolveScope(input.repositoryPath);
      const policy = await this.getPolicy.execute({
        scopeType,
        scopeId,
        featureId: input.featureId,
      });
      if (!policy) {
        // No supervisor configured for this scope. The flag-off short
        // circuit further down inside EvaluateSupervisorDecisionUseCase
        // still applies, but exiting here avoids generating a
        // supervisorRunId and a sourceEventId we don't need.
        return { evaluated: false, autoResolved: false };
      }

      const gateId = input.interruptNode ?? DEFAULT_GATE_ID;
      const supervisorRunId = randomUUID();
      const sourceEventId = `gate:${input.runId}:${gateId}`;

      const result = await this.evaluateDecision.execute({
        event: {
          kind: 'gate',
          scopeType,
          scopeId,
          featureId: input.featureId,
          agentRunId: input.runId,
          gateId,
          sourceEventId,
        },
        supervisorRunId,
      });

      if (!result.evaluated || !result.decision) {
        return { evaluated: false, autoResolved: false };
      }

      const effectiveAutonomy = resolveEffectiveAutonomy(policy, gateId);
      const verdict = result.decision.verdict;

      const autoResolved =
        effectiveAutonomy === SupervisorAutonomy.autonomous &&
        (await this.applyAutonomousVerdict(input.runId, verdict, supervisorRunId));

      return {
        evaluated: true,
        effectiveAutonomy,
        verdict,
        autoResolved,
      };
    } catch {
      // Supervisor errors must not block the gate — fall back to the
      // existing human-only path (FR-22).
      return { evaluated: false, autoResolved: false };
    }
  }

  private async applyAutonomousVerdict(
    runId: string,
    verdict: SupervisorVerdict,
    supervisorRunId: string
  ): Promise<boolean> {
    const actor = supervisorActor(supervisorRunId);
    if (verdict === SupervisorVerdict.approve) {
      const out = await this.approveAgentRun.execute(runId, undefined, actor);
      return out.approved === true;
    }
    if (verdict === SupervisorVerdict.reject) {
      const out = await this.rejectAgentRun.execute(
        runId,
        'Supervisor rejected (autonomous mode)',
        undefined,
        actor
      );
      return out.rejected === true;
    }
    // advise / escalate stay non-resolving in autonomous mode too — they
    // signal "human needed" and we leave the gate open.
    return false;
  }

  private async resolveScope(
    repositoryPath: string
  ): Promise<{ scopeType: string; scopeId: string }> {
    try {
      const app = await this.applicationRepo.findByPath(repositoryPath);
      if (app?.id) return { scopeType: 'app', scopeId: app.id };
    } catch {
      // Fall through to repo-based scope.
    }
    return { scopeType: 'repo', scopeId: repositoryPath };
  }
}

/**
 * Resolves the per-gate autonomy override stored as JSON on
 * {@link SupervisorPolicy.gateAuthorityJson}. The map is keyed by gate
 * id (matching the LangGraph node name, e.g. `prd`, `plan`, `merge`).
 *
 * Exported so the unit test can exercise the parsing rules without
 * spinning up the full evaluator.
 */
export function resolveEffectiveAutonomy(
  policy: SupervisorPolicy,
  gateId: string
): SupervisorAutonomy {
  if (!policy.gateAuthorityJson) return policy.autonomyLevel;
  try {
    const parsed = JSON.parse(policy.gateAuthorityJson) as Record<string, unknown>;
    const override = parsed[gateId];
    if (typeof override === 'string' && isSupervisorAutonomy(override)) {
      return override;
    }
  } catch {
    // Malformed JSON falls back to the policy default.
  }
  return policy.autonomyLevel;
}

function isSupervisorAutonomy(value: string): value is SupervisorAutonomy {
  return (
    value === SupervisorAutonomy.advisory ||
    value === SupervisorAutonomy.cosign ||
    value === SupervisorAutonomy.autonomous
  );
}
