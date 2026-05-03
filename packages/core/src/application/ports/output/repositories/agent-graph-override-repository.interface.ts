/**
 * AgentGraphOverride Repository Interface (Output Port)
 *
 * Persistence contract for {@link AgentGraphOverride} (spec 093, FR-38 ext).
 * One active row per agentType; upsert semantics handled by the use case.
 */

import type { AgentGraphOverride } from '../../../../domain/generated/output.js';

export interface IAgentGraphOverrideRepository {
  /** Find the active override for an agent, or null when none exists. */
  findActive(agentType: string): Promise<AgentGraphOverride | null>;

  /** List every override across every agent (used by the dashboard). */
  listAll(): Promise<AgentGraphOverride[]>;

  /** Insert a new override. Throws on uniqueness conflict. */
  create(override: AgentGraphOverride): Promise<void>;

  /** Replace an existing override in place by id. */
  update(override: AgentGraphOverride): Promise<void>;

  /** Delete the active override for an agent. No-op when none exists. */
  delete(agentType: string): Promise<void>;
}
