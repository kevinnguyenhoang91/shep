/**
 * @module Shep.Agents.SupervisorPolicy
 *
 * Per-app (with optional per-feature override) supervisor policy that
 * controls how a delegated supervisor agent evaluates approval gates,
 * questions, and lifecycle events.
 *
 * @see specs/093-agent-collaboration-supervision/research.yaml
 */
import "../common/base.tsp";

/**
 * Supervisor Autonomy
 *
 * Authority delegated to the supervisor for the configured scope.
 *
 * | Value      | Description                                                     |
 * |------------|-----------------------------------------------------------------|
 * | advisory   | Supervisor advises but cannot decide; user keeps full control   |
 * | cosign     | Both supervisor and user must approve                           |
 * | autonomous | Supervisor can decide on the user's behalf                      |
 *
 * `advisory` is the default for any new policy.
 */
@doc("Authority delegated to the supervisor for the configured scope")
enum SupervisorAutonomy {
  @doc("Supervisor advises only; user keeps full control")
  advisory: "advisory",

  @doc("Supervisor and user must both approve")
  cosign: "cosign",

  @doc("Supervisor may decide on the user's behalf")
  autonomous: "autonomous",
}

/**
 * Supervisor Policy
 *
 * Persisted policy resolved by (appId, featureId?) — feature-scoped
 * policy first, falling back to app-scoped. JSON columns
 * (`gateAuthorityJson`, `policyRulesJson`, `notificationOverridesJson`)
 * carry structured config that evolves independently of the row.
 *
 * ## Properties
 *
 * | Property                   | Type                | Required | Description                                                  |
 * |----------------------------|---------------------|----------|--------------------------------------------------------------|
 * | id                         | UUID                | Yes      | Unique identifier (from BaseEntity)                          |
 * | appId                      | string              | Yes      | Required scope                                               |
 * | featureId                  | string              | No       | Optional override scope                                      |
 * | enabled                    | boolean             | Yes      | Master enable toggle                                         |
 * | autonomyLevel              | SupervisorAutonomy  | Yes      | Default autonomy (advisory by default)                       |
 * | gateAuthorityJson          | string              | No       | Per-gate autonomy override JSON map                          |
 * | modelId                    | string              | No       | LLM model id (resolved through IAgentExecutorProvider)       |
 * | promptVersion              | string              | No       | Reproducibility marker for the evaluator prompt              |
 * | policyRulesJson            | string              | No       | JSON array of structured rules                               |
 * | notificationOverridesJson  | string              | No       | JSON object overriding notification preferences              |
 * | createdAt                  | utcDateTime         | Yes      | From BaseEntity                                              |
 * | updatedAt                  | utcDateTime         | Yes      | From BaseEntity                                              |
 */
@doc("Per-app supervisor policy with optional per-feature override")
model SupervisorPolicy extends BaseEntity {
  @doc("App scope identifier (required)")
  appId: string;

  @doc("Feature scope identifier (optional override)")
  featureId?: string;

  @doc("Master enable toggle")
  enabled: boolean;

  @doc("Default autonomy level (advisory by default)")
  autonomyLevel: SupervisorAutonomy;

  @doc("JSON map: per-gate autonomy override (e.g. { prd: 'advisory', merge: 'autonomous' })")
  gateAuthorityJson?: string;

  @doc("LLM model identifier resolved through IAgentExecutorProvider")
  modelId?: string;

  @doc("Evaluator prompt version marker for audit reproducibility")
  promptVersion?: string;

  @doc("JSON array of structured policy rules")
  policyRulesJson?: string;

  @doc("JSON object overriding the user's notification preferences for supervisor events")
  notificationOverridesJson?: string;
}
