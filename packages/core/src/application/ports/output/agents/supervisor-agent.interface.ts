/**
 * ISupervisorAgent — Output port for the supervisor evaluator (spec 093).
 *
 * The supervisor observes events emitted on the agent collaboration fabric
 * (approval-gate transitions, agent questions, inter-agent messages) and
 * returns a {@link SupervisorDecision}. The decision is later persisted by
 * {@link EvaluateSupervisorDecisionUseCase} and mirrored to the audit log.
 *
 * The port is intentionally narrow: a single `evaluate(event)` method that
 * receives a discriminated event union. Concrete adapters MAY use a stateful
 * graph (LangGraph) under the hood and MUST resolve any LLM call through
 * `IAgentExecutorProvider` to honor the agent-agnostic rule.
 *
 * Implementations MUST:
 *  - Return a decision within the configured evaluator timeout (research
 *    NFR-2 budget — 25s soft, 30s hard); on timeout, emit a `verdict:
 *    'escalate'` decision with `rationale: 'timeout'` so the human path
 *    proceeds (FR-22 fail-safe).
 *  - Snapshot `modelId` and `promptVersion` on every decision so audit is
 *    reproducible across model rotations.
 *  - Treat any payload field on the input event as untrusted user content.
 *
 * The port itself does NOT persist decisions — that is the use case's
 * responsibility (separation of concerns).
 */

import type { SupervisorPolicy, SupervisorVerdict } from '../../../../domain/generated/output.js';

/** Discriminator for the source of a supervisor evaluation. */
export type SupervisorEventKind = 'gate' | 'question' | 'message';

/**
 * Approval-gate transition observed on an AgentRun.
 *
 * Emitted whenever an agent run reaches `waiting_approval` for one of the
 * configured gates (PRD / plan / merge / etc.). The supervisor decides
 * whether to advise, escalate, or — in autonomous mode — approve/reject.
 */
export interface SupervisorGateEvent {
  kind: 'gate';
  /** Scope type (global, repo, or app). */
  scopeType: string;
  /** Optional scope identifier (repo slug or app id). */
  scopeId?: string;
  /** Optional feature scope. */
  featureId?: string;
  /** Agent run that hit the gate. */
  agentRunId: string;
  /** Identifier of the gate (e.g. `prd`, `plan`, `merge`). */
  gateId: string;
  /** Free-form context the supervisor may consider (recent activity, diff stats, …). */
  context?: string;
  /** Source-event row id used for audit linkage. */
  sourceEventId: string;
}

/** Question raised by an agent (interactive or background). */
export interface SupervisorQuestionEvent {
  kind: 'question';
  /** Scope type (global, repo, or app). */
  scopeType: string;
  /** Optional scope identifier (repo slug or app id). */
  scopeId?: string;
  featureId?: string;
  agentRunId: string;
  questionId: string;
  /** Three-tier urgency snapshot (info / question / blocking). */
  questionKind: string;
  /** Question prompt — treated as untrusted content. */
  prompt: string;
  /** Optional multiple-choice options offered to the answerer. */
  options?: string[];
  sourceEventId: string;
}

/** Inter-agent message observed on the bus. */
export interface SupervisorMessageEvent {
  kind: 'message';
  /** Scope type (global, repo, or app). */
  scopeType: string;
  /** Optional scope identifier (repo slug or app id). */
  scopeId?: string;
  featureId?: string;
  /** Message id (also used as the audit `sourceEventId`). */
  messageId: string;
  /** AgentMessageKind snapshot. */
  messageKind: string;
  /** Sender actor namespace. */
  fromActor: string;
  /** Target identifier — agent-run id, `broadcast`, `supervisor`, or `user`. */
  toTarget: string;
  /** JSON-encoded message payload — treated as untrusted content. */
  payload: string;
  sourceEventId: string;
}

/**
 * Discriminated union of every event kind the supervisor evaluates. New
 * event kinds (e.g. lifecycle milestones) MUST extend this union and the
 * matching SSE event-kind plumbing in Phase 2/3.
 */
export type SupervisorEvent =
  | SupervisorGateEvent
  | SupervisorQuestionEvent
  | SupervisorMessageEvent;

/**
 * Outcome returned by {@link ISupervisorAgent.evaluate}. Mirrors the
 * persisted {@link SupervisorDecision} shape minus the audit-only fields
 * (id, timestamps, supervisorRunId) which the use case populates.
 */
export interface SupervisorDecisionResult {
  verdict: SupervisorVerdict;
  /** Human-readable rationale; persisted verbatim. */
  rationale: string;
  /** Snapshot of the model used at evaluation time (for audit reproducibility). */
  modelId: string;
  /** Snapshot of the evaluator prompt version. */
  promptVersion: string;
  /** Optional reference to the policy rule that fired. */
  ruleRef?: string;
  /** Optional 0..1 confidence reported by the evaluator. */
  confidence?: number;
}

/** Inputs supplied alongside the event when evaluating. */
export interface SupervisorEvaluateInput {
  event: SupervisorEvent;
  /** Effective policy resolved by the caller (app→feature fallback). */
  policy: SupervisorPolicy;
}

/**
 * Supervisor evaluator port.
 *
 * Implementations decide whether to approve / reject / escalate / advise
 * the input event according to the supplied policy. The use-case layer
 * — never the implementation — is responsible for persistence and
 * activity-log mirroring.
 */
export interface ISupervisorAgent {
  /**
   * Evaluate one event against the effective policy.
   *
   * @throws when the implementation cannot honor its timeout contract
   *         (callers translate failures into a fallback `escalate`
   *         decision per FR-22).
   */
  evaluate(input: SupervisorEvaluateInput): Promise<SupervisorDecisionResult>;
}

/** Default soft timeout for evaluator execution (research perf section). */
export const SUPERVISOR_EVALUATOR_SOFT_TIMEOUT_MS = 25_000;
