/**
 * @module Shep.Agents.SupervisorDecision
 *
 * Immutable audit record of every decision the supervisor agent makes.
 * Mirrored into the append-only `activity_log` (migration 064) so trust
 * can always be reconstructed.
 *
 * @see specs/093-agent-collaboration-supervision/research.yaml
 */
import "../common/base.tsp";

/**
 * Supervisor Verdict
 *
 * Outcome of a single supervisor evaluation.
 *
 * | Value     | Description                                                       |
 * |-----------|-------------------------------------------------------------------|
 * | approve   | Supervisor approves the gate / question / action                  |
 * | reject    | Supervisor rejects the gate / question / action                   |
 * | escalate  | Supervisor escalates to the human user                            |
 * | advise    | Supervisor advises (no binding decision; advisory autonomy)       |
 */
@doc("Outcome of a single supervisor evaluation")
enum SupervisorVerdict {
  @doc("Supervisor approves")
  approve: "approve",

  @doc("Supervisor rejects")
  reject: "reject",

  @doc("Supervisor escalates to the human user")
  escalate: "escalate",

  @doc("Supervisor advises (non-binding)")
  advise: "advise",
}

/**
 * Supervisor Decision
 *
 * One immutable row per evaluator invocation. Stores the full rationale,
 * model + prompt version, optional confidence, and the rule reference so
 * decisions remain inspectable across model rotations.
 *
 * Scope fields mirror the policy that triggered the decision so audit
 * queries can filter by scope without joining supervisor_policies.
 *
 * ## Properties
 *
 * | Property         | Type              | Required | Description                                              |
 * |------------------|-------------------|----------|----------------------------------------------------------|
 * | id               | UUID              | Yes      | Unique identifier (from BaseEntity)                      |
 * | scopeType        | string            | Yes      | Scope level of the policy that triggered the decision    |
 * | scopeId          | string            | No       | App or repo UUID (null for global policies)              |
 * | featureId        | string            | No       | Feature scope when applicable                            |
 * | supervisorRunId  | string            | Yes      | Agent run id of the supervisor that produced this        |
 * | sourceEventKind  | string            | Yes      | Kind of event (gate, question, message)                  |
 * | sourceEventId    | string            | Yes      | Id of the source event row                               |
 * | verdict          | SupervisorVerdict | Yes      | Decision outcome                                         |
 * | rationale        | string            | Yes      | Free-form rationale for the decision                     |
 * | modelId          | string            | Yes      | LLM model used (snapshot for reproducibility)            |
 * | promptVersion    | string            | Yes      | Evaluator prompt version (snapshot)                      |
 * | ruleRef          | string            | No       | Reference to the policy rule that fired (if any)         |
 * | confidence       | float64           | No       | Optional 0..1 confidence value                           |
 * | createdAt        | utcDateTime       | Yes      | From BaseEntity                                          |
 * | updatedAt        | utcDateTime       | Yes      | From BaseEntity, equals createdAt for immutable rows     |
 */
@doc("Immutable audit record of a supervisor decision")
model SupervisorDecision extends BaseEntity {
  @doc("Scope level of the policy that triggered this decision (global, repo, app)")
  scopeType: string;

  @doc("App or repo UUID from the triggering policy (null for global)")
  scopeId?: string;

  @doc("Optional feature scope identifier")
  featureId?: string;

  @doc("Agent run id of the supervisor that produced this decision")
  supervisorRunId: string;

  @doc("Kind of source event: 'gate' | 'question' | 'message' | 'lifecycle'")
  sourceEventKind: string;

  @doc("Id of the source event row this decision was about")
  sourceEventId: string;

  @doc("Decision outcome")
  verdict: SupervisorVerdict;

  @doc("Free-form rationale string written by the evaluator")
  rationale: string;

  @doc("LLM model used at decision time (snapshot for reproducibility)")
  modelId: string;

  @doc("Evaluator prompt version snapshot")
  promptVersion: string;

  @doc("Optional reference to the policy rule that fired")
  ruleRef?: string;

  @doc("Optional 0..1 confidence reported by the evaluator")
  confidence?: float64;
}
