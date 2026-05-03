/**
 * @module Shep.Agents.CustomAgent
 *
 * User-defined agent. Built-in agents (`feature-agent`, `supervisor-agent`)
 * are hardcoded in the runtime; custom agents are first-class persisted
 * rows that participate in the same prompt-override + graph-override
 * surfaces from the agent editor.
 *
 * A custom agent has no runtime LangGraph implementation by itself — it
 * exists so the user can author prompt slots and a graph descriptor for a
 * new agent type, then plug a real executor in later. The editor treats
 * built-ins and customs uniformly.
 *
 * @see specs/093-agent-collaboration-supervision/spec.yaml#extension
 */
import "../common/base.tsp";

/**
 * Custom Agent
 *
 * One row per user-created agent type.
 *
 * ## Properties
 *
 * | Property    | Type        | Required | Description                                                  |
 * |-------------|-------------|----------|--------------------------------------------------------------|
 * | id          | UUID        | Yes      | Unique identifier (from BaseEntity)                          |
 * | agentType   | string      | Yes      | Stable identifier (e.g. "code-review") — must be unique      |
 * | name        | string      | Yes      | Human-readable display name                                  |
 * | description | string      | Yes      | Short description of what the agent does                     |
 * | createdBy   | string      | Yes      | Who created the agent (user id or 'user')                    |
 * | createdAt   | utcDateTime | Yes      | From BaseEntity                                              |
 * | updatedAt   | utcDateTime | Yes      | From BaseEntity                                              |
 */
@doc("User-created agent type, editable in the agent editor")
model CustomAgent extends BaseEntity {
  @doc("Stable agent type identifier (kebab-case, unique)")
  agentType: string;

  @doc("Human-readable display name")
  name: string;

  @doc("Short description of what this agent does")
  description: string;

  @doc("Author of the agent")
  createdBy: string;
}
