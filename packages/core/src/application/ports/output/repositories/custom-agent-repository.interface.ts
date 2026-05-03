/**
 * CustomAgent Repository Interface (Output Port)
 *
 * Persistence contract for user-defined agents (spec 093, FR-39 ext).
 * Built-in agents (`feature-agent`, `supervisor-agent`) are not stored
 * here — they live in code and are merged in by the use-case layer.
 */

import type { CustomAgent } from '../../../../domain/generated/output.js';

export interface ICustomAgentRepository {
  /** Lookup a custom agent by its stable agentType identifier. */
  findByType(agentType: string): Promise<CustomAgent | null>;

  /** List every custom agent, ordered by agentType ASC. */
  listAll(): Promise<CustomAgent[]>;

  /** Insert a new custom agent. Throws on uniqueness conflict. */
  create(agent: CustomAgent): Promise<void>;

  /** Replace an existing custom agent in place by id. */
  update(agent: CustomAgent): Promise<void>;

  /** Remove the custom agent. No-op when none exists. */
  delete(agentType: string): Promise<void>;
}
