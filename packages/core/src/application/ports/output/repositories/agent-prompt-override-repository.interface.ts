/**
 * AgentPromptOverride Repository Interface (Output Port)
 *
 * Persistence contract for {@link AgentPromptOverride} (spec 093, FR-34).
 * One active row per (agentType, promptId); upsert semantics handled by
 * the use case layer.
 */

import type { AgentPromptOverride } from '../../../../domain/generated/output.js';

export interface IAgentPromptOverrideRepository {
  /** Find the active override for a slot, or null when none exists. */
  findActive(agentType: string, promptId: string): Promise<AgentPromptOverride | null>;

  /** List every override for one agent type, ordered by promptId. */
  listForAgent(agentType: string): Promise<AgentPromptOverride[]>;

  /** List every override across every agent (used by the dashboard). */
  listAll(): Promise<AgentPromptOverride[]>;

  /** Insert a new override. Throws on uniqueness conflict. */
  create(override: AgentPromptOverride): Promise<void>;

  /** Replace an existing override in place by id. */
  update(override: AgentPromptOverride): Promise<void>;

  /** Delete the active override for a slot. No-op when none exists. */
  delete(agentType: string, promptId: string): Promise<void>;
}
