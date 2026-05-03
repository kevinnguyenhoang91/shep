/**
 * @module Shep.Agents.AgentPromptOverride
 *
 * User-supplied override for a built-in agent prompt (FR-34).
 *
 * The runtime prompt resolver consults this table before falling back to
 * the bundled string under
 * `packages/core/src/infrastructure/services/agents/<agent>/nodes/prompts/`.
 * At most one active override per (agentType, promptId) is enforced by a
 * SQLite UNIQUE index — see migration 098.
 *
 * The override is additive: deleting the row restores byte-identical
 * bundled behaviour (NFR-16).
 *
 * @see specs/093-agent-collaboration-supervision/spec.yaml#extension
 */
import "../common/base.tsp";

/**
 * Agent Prompt Override
 *
 * One row per (agentType, promptId) the user has customised.
 *
 * ## Properties
 *
 * | Property   | Type        | Required | Description                                                    |
 * |------------|-------------|----------|----------------------------------------------------------------|
 * | id         | UUID        | Yes      | Unique identifier (from BaseEntity)                            |
 * | agentType  | string      | Yes      | The agent the prompt belongs to (e.g. "feature-agent")         |
 * | promptId   | string      | Yes      | Stable identifier within the agent (e.g. "implement", "evaluator") |
 * | body       | string      | Yes      | The override prompt text                                        |
 * | version    | int32       | Yes      | Monotonic counter, bumped on every upsert for audit            |
 * | createdBy  | string      | Yes      | Who authored the override (user id or 'user')                  |
 * | createdAt  | utcDateTime | Yes      | From BaseEntity                                                |
 * | updatedAt  | utcDateTime | Yes      | From BaseEntity                                                |
 */
@doc("User-supplied override for a built-in agent prompt")
model AgentPromptOverride extends BaseEntity {
  @doc("Agent type the prompt belongs to (e.g. 'feature-agent')")
  agentType: string;

  @doc("Stable prompt identifier within the agent (e.g. 'implement')")
  promptId: string;

  @doc("Override prompt body")
  body: string;

  @doc("Monotonic version counter, bumped on every upsert")
  version: int32;

  @doc("Author of the override")
  createdBy: string;
}
