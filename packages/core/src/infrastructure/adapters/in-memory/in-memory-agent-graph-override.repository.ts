/**
 * In-Memory AgentGraphOverride Repository
 *
 * Test-friendly adapter for {@link IAgentGraphOverrideRepository}. Enforces
 * the unique-agentType invariant locally so tests exercise the same rule
 * the SQLite adapter enforces.
 */

import { injectable } from 'tsyringe';
import type { IAgentGraphOverrideRepository } from '@/application/ports/output/repositories/agent-graph-override-repository.interface.js';
import type { AgentGraphOverride } from '@/domain/generated/output.js';

@injectable()
export class InMemoryAgentGraphOverrideRepository implements IAgentGraphOverrideRepository {
  private readonly byId = new Map<string, AgentGraphOverride>();
  private readonly byAgent = new Map<string, string>();

  async findActive(agentType: string): Promise<AgentGraphOverride | null> {
    const id = this.byAgent.get(agentType);
    if (!id) return null;
    const row = this.byId.get(id);
    return row ? { ...row } : null;
  }

  async listAll(): Promise<AgentGraphOverride[]> {
    return [...this.byId.values()]
      .map((row) => ({ ...row }))
      .sort((a, b) => a.agentType.localeCompare(b.agentType));
  }

  async create(override: AgentGraphOverride): Promise<void> {
    if (this.byId.has(override.id)) {
      throw new Error(`AgentGraphOverride with id "${override.id}" already exists`);
    }
    if (this.byAgent.has(override.agentType)) {
      throw new Error(`AgentGraphOverride already exists for agentType=${override.agentType}`);
    }
    this.byId.set(override.id, { ...override });
    this.byAgent.set(override.agentType, override.id);
  }

  async update(override: AgentGraphOverride): Promise<void> {
    if (!this.byId.has(override.id)) {
      throw new Error(`AgentGraphOverride with id "${override.id}" not found`);
    }
    this.byId.set(override.id, { ...override });
    this.byAgent.set(override.agentType, override.id);
  }

  async delete(agentType: string): Promise<void> {
    const id = this.byAgent.get(agentType);
    if (!id) return;
    this.byAgent.delete(agentType);
    this.byId.delete(id);
  }
}
