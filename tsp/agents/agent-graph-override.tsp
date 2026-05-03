/**
 * @module Shep.Agents.AgentGraphOverride
 *
 * User-supplied override for a built-in agent LangGraph descriptor (FR-38 ext).
 *
 * The runtime graph resolver consults this table before falling back to the
 * bundled descriptor in `application/services/builtin-graph-registry.ts`.
 * At most one active override per agentType is enforced by a SQLite UNIQUE
 * index — see migration 099.
 *
 * The override is additive: deleting the row restores byte-identical bundled
 * behaviour.
 *
 * Nodes and edges are persisted as opaque JSON blobs (the same pattern used
 * by SupervisorPolicy.gateAuthorityJson) so new descriptor fields (positions,
 * colors, retries) can be introduced without a schema migration.
 *
 * @see specs/093-agent-collaboration-supervision/spec.yaml#extension
 */
import "../common/base.tsp";

/**
 * Agent Graph Override
 *
 * One row per agentType the user has customised.
 *
 * ## Properties
 *
 * | Property   | Type        | Required | Description                                                  |
 * |------------|-------------|----------|--------------------------------------------------------------|
 * | id         | UUID        | Yes      | Unique identifier (from BaseEntity)                          |
 * | agentType  | string      | Yes      | The agent the descriptor belongs to (e.g. "feature-agent")   |
 * | nodesJson  | string      | Yes      | JSON array of node descriptors                               |
 * | edgesJson  | string      | Yes      | JSON array of edge descriptors                               |
 * | version    | int32       | Yes      | Monotonic counter, bumped on every upsert for audit          |
 * | createdBy  | string      | Yes      | Who authored the override (user id or 'user')                |
 * | createdAt  | utcDateTime | Yes      | From BaseEntity                                              |
 * | updatedAt  | utcDateTime | Yes      | From BaseEntity                                              |
 */
@doc("User-supplied override for a built-in agent LangGraph descriptor")
model AgentGraphOverride extends BaseEntity {
  @doc("Agent type the descriptor belongs to (e.g. 'feature-agent')")
  agentType: string;

  @doc("JSON-encoded array of node descriptors ({id,label,description?})")
  nodesJson: string;

  @doc("JSON-encoded array of edge descriptors ({from,to,label?})")
  edgesJson: string;

  @doc("Monotonic version counter, bumped on every upsert")
  version: int32;

  @doc("Author of the override")
  createdBy: string;
}
