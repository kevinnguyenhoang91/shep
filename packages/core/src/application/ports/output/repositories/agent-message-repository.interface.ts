/**
 * AgentMessage Repository Interface (Output Port)
 *
 * Defines the contract for AgentMessage persistence on the SQLite-backed
 * agent message bus (spec 093). Append-only — messages are never updated
 * after creation other than to set deliveredAt when the bus marks them
 * delivered. Every read MUST be scoped by appId for cross-app isolation
 * (NFR-7).
 */

import type { AgentMessage } from '../../../../domain/generated/output.js';

/**
 * Filter options for listing agent messages.
 */
export interface AgentMessageListFilters {
  /** Limit results to messages with `created_at >= since` */
  since?: Date;
  /** Maximum number of rows to return */
  limit?: number;
  /** When true, only undelivered messages (delivered_at IS NULL) are returned */
  undeliveredOnly?: boolean;
}

/**
 * Repository contract for AgentMessage persistence.
 *
 * Implementations MUST:
 * - Scope every list/find query by `appId` (and `featureId` where applicable).
 * - Treat the entity as append-only — no `update` other than `markDelivered`.
 * - Be safe for concurrent readers/writers across processes (e.g., SQLite WAL).
 */
export interface IAgentMessageRepository {
  /**
   * Persist a new message.
   * Throws on duplicate id.
   */
  create(message: AgentMessage): Promise<void>;

  /**
   * Find a single message by id, scoped to the given app.
   * Returns null if no row exists or the row belongs to a different app.
   */
  findById(appId: string, id: string): Promise<AgentMessage | null>;

  /**
   * Find a message by its correlationId for request/reply pairing.
   * Returns null if no row exists in the given app scope.
   */
  findByCorrelationId(appId: string, correlationId: string): Promise<AgentMessage | null>;

  /**
   * List messages for an app (and optionally a feature) ordered by createdAt asc.
   * NEVER cross-app — the appId filter is applied at the SQL layer.
   */
  listByScope(
    appId: string,
    featureId: string | undefined,
    filters?: AgentMessageListFilters
  ): Promise<AgentMessage[]>;

  /**
   * Mark a message as delivered. Sets deliveredAt to the supplied timestamp.
   * No-op if the row does not exist or already has a deliveredAt.
   */
  markDelivered(appId: string, id: string, deliveredAt: Date): Promise<void>;
}
