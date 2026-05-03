/**
 * @module Shep.Agents.AgentMessage
 *
 * Inter-agent message bus persistence model.
 * Messages flow through a SQLite-backed bus (cross-process via shared DB)
 * and are observable via the SSE stream as the `agent_message` event kind.
 *
 * Hub-and-spoke topology: messages target `broadcast`, `supervisor`, `user`,
 * or a specific agent run id (for request/reply via correlationId).
 *
 * @see specs/093-agent-collaboration-supervision/research.yaml
 */
import "../common/base.tsp";

/**
 * Agent Message Kind
 *
 * Discriminator for the meaning of a message payload.
 * Adopted from spec 014's [TASK-READY]/[BLOCKED] vocabulary.
 *
 * | Value   | Description                                                        |
 * |---------|--------------------------------------------------------------------|
 * | status  | Lifecycle update (started, phase-changed, completed)               |
 * | request | Outgoing request expecting a reply (paired by correlationId)       |
 * | reply   | Reply to a prior request (correlationId references the request)    |
 * | blocked | Agent is blocked on something — escalates to supervisor / user     |
 * | info    | Free-form informational message                                    |
 */
@doc("Discriminator for the kind of an agent message")
enum AgentMessageKind {
  @doc("Lifecycle update from the sending agent")
  status: "status",

  @doc("Outgoing request expecting a reply")
  request: "request",

  @doc("Reply to a prior request (paired by correlationId)")
  reply: "reply",

  @doc("Agent is blocked and is escalating")
  blocked: "blocked",

  @doc("Informational message, no reply expected")
  info: "info",
}

/**
 * Agent Message
 *
 * One persisted row per inter-agent (or agent↔user / agent↔supervisor)
 * message. Append-only. Cross-process delivery is provided by the shared
 * SQLite database in WAL mode; subscribers poll on the established SSE
 * cadence.
 *
 * ## Properties
 *
 * | Property        | Type             | Required | Description                                            |
 * |-----------------|------------------|----------|--------------------------------------------------------|
 * | id              | UUID             | Yes      | Unique identifier (from BaseEntity)                    |
 * | appId           | string           | No       | App scope when message originates in an app context    |
 * | repositoryId    | string           | No       | Repo scope for standalone-repo agent work              |
 * | featureId       | string           | No       | Feature scope when applicable                          |
 * | fromAgentRunId  | string           | No       | Sender agent run id (omitted for `user`/`supervisor`)  |
 * | fromActor       | string           | Yes      | Sender actor namespace: `agent:<id>`/`user:<id>`/...   |
 * | toTarget        | string           | Yes      | Target identifier (run id, `broadcast`, etc.)          |
 * | toKind          | string           | Yes      | Target kind: `agent`/`broadcast`/`supervisor`/`user`   |
 * | messageKind     | AgentMessageKind | Yes      | Discriminator for payload meaning                      |
 * | payload         | string           | Yes      | JSON-encoded payload (treated as untrusted content)    |
 * | correlationId   | UUID             | No       | Pairs request with reply                               |
 * | createdAt       | utcDateTime      | Yes      | Persistence timestamp (from BaseEntity)                |
 * | updatedAt       | utcDateTime      | Yes      | From BaseEntity, equals createdAt for append-only rows |
 * | deliveredAt     | utcDateTime      | No       | When the bus marked the message delivered (audit)      |
 */
@doc("Inter-agent / agent↔user / agent↔supervisor message persisted on the bus")
model AgentMessage extends BaseEntity {
  @doc("App scope identifier (set when message originates in an app context)")
  appId?: string;

  @doc("Repository scope identifier (set for standalone-repo agent work)")
  repositoryId?: string;

  @doc("Optional feature scope identifier")
  featureId?: string;

  @doc("Sending agent run id (omitted when sender is user or supervisor)")
  fromAgentRunId?: string;

  @doc("Sender actor namespace: e.g. 'agent:<runId>', 'user:<id>', 'supervisor:<id>'")
  fromActor: string;

  @doc("Target identifier — agent run id, 'broadcast', 'supervisor', or 'user'")
  toTarget: string;

  @doc("Target kind: 'agent' | 'broadcast' | 'supervisor' | 'user'")
  toKind: string;

  @doc("Discriminator for the meaning of the payload")
  messageKind: AgentMessageKind;

  @doc("JSON-encoded payload (untrusted content, validated at boundaries)")
  payload: string;

  @doc("Pairs a request with its reply (optional)")
  correlationId?: string;

  @doc("Timestamp when the bus marked this message delivered to subscribers")
  deliveredAt?: utcDateTime;
}
