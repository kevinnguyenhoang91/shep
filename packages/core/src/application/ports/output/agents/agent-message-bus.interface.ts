/**
 * IAgentMessageBus — Output port for the agent message bus (spec 093).
 *
 * Hub-and-spoke topology: agents communicate via this bus rather than
 * addressing peers directly. Permitted `toKind` values are:
 *   - 'agent'      — a specific agent run id (used only for replies via
 *                    `correlationId`; never as a primary fan-out target).
 *   - 'broadcast'  — fan out to all subscribers in the same scope.
 *   - 'supervisor' — addressed at the supervisor for the current scope.
 *   - 'user'       — addressed at the human user.
 *
 * Peer addressing (`toKind === 'peer'`) is REJECTED at publish time. All
 * inter-agent traffic flows through the supervisor (or a logical hub when
 * none is configured), preserving central audit and policy enforcement
 * (research decision 3).
 *
 * Cross-app isolation (NFR-7): every `subscribe` filter and `listFor`
 * query is scoped by `appId`. Implementations MUST refuse to fan messages
 * across app boundaries.
 *
 * @example
 * ```ts
 * const bus: IAgentMessageBus = container.resolve('IAgentMessageBus');
 *
 * // Publish a lifecycle status broadcast.
 * await bus.publish({
 *   id: crypto.randomUUID(),
 *   appId: 'app-1',
 *   featureId: 'feat-42',
 *   fromAgentRunId: 'run-7',
 *   fromActor: 'agent:run-7',
 *   toTarget: 'broadcast',
 *   toKind: 'broadcast',
 *   messageKind: AgentMessageKind.status,
 *   payload: JSON.stringify({ phase: 'started' }),
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * });
 *
 * // Subscribe within an app/feature scope.
 * const unsubscribe = bus.subscribe({ appId: 'app-1', featureId: 'feat-42' }, (m) => {
 *   console.log('agent message', m.messageKind, m.payload);
 * });
 * ```
 */

import type { AgentMessage } from '../../../../domain/generated/output.js';

/**
 * Filter applied to {@link IAgentMessageBus.subscribe} and
 * {@link IAgentMessageBus.listFor}.
 *
 * `appId` is REQUIRED so cross-app subscription is structurally impossible.
 * Either `featureId` or `agentRunId` may further narrow the scope; both
 * may be omitted to receive every message in the app.
 */
export interface AgentMessageBusFilter {
  /** Required app scope (NFR-7). */
  appId: string;
  /** Optional feature scope. */
  featureId?: string;
  /** Optional agent-run id (matches messages where the run is sender or target). */
  agentRunId?: string;
  /** Only deliver messages with `created_at >= since` (used for catch-up). */
  since?: Date;
}

/** Handler invoked for each delivered message. */
export type AgentMessageHandler = (message: AgentMessage) => void | Promise<void>;

/** Detach handle returned by {@link IAgentMessageBus.subscribe}. */
export type AgentMessageUnsubscribe = () => void;

/**
 * Hub-and-spoke message bus for agent-to-agent / agent-to-user /
 * agent-to-supervisor traffic.
 *
 * Implementations MUST:
 * - Reject `toKind === 'peer'` at publish time with a typed error.
 * - Scope every read/subscription by `appId`.
 * - Be safe across processes when backed by a shared store (e.g. SQLite WAL).
 * - Be idempotent on duplicate ids — `publish` of an already-stored id throws.
 */
export interface IAgentMessageBus {
  /**
   * Persist the message and deliver it to matching subscribers.
   *
   * @param message Fully populated {@link AgentMessage} record.
   * @throws when `message.toKind === 'peer'` (peer addressing forbidden).
   * @throws when an existing row already has the same id.
   */
  publish(message: AgentMessage): Promise<void>;

  /**
   * Register a handler that fires for every subsequent message matching the filter.
   * Returns an unsubscribe function.
   *
   * Subscriptions are tied to the in-process bus and do not survive a
   * process restart — use {@link listFor} for catch-up after a reconnect.
   */
  subscribe(filter: AgentMessageBusFilter, handler: AgentMessageHandler): AgentMessageUnsubscribe;

  /**
   * Read messages from the underlying store using the same filter shape
   * as `subscribe`. Returns rows ordered by `createdAt` ascending.
   */
  listFor(filter: AgentMessageBusFilter, limit?: number): Promise<AgentMessage[]>;
}

/**
 * Set of accepted `toKind` values. `peer` is intentionally absent — research
 * decision 3 forbids peer addressing in v1.
 */
export const ALLOWED_AGENT_MESSAGE_TARGET_KINDS = ['agent', 'broadcast', 'supervisor', 'user'];
