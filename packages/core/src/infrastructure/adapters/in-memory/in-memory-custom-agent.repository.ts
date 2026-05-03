/**
 * In-Memory CustomAgent Repository
 *
 * Test-friendly adapter for {@link ICustomAgentRepository}.
 */

import { injectable } from 'tsyringe';
import type { ICustomAgentRepository } from '@/application/ports/output/repositories/custom-agent-repository.interface.js';
import type { CustomAgent } from '@/domain/generated/output.js';

@injectable()
export class InMemoryCustomAgentRepository implements ICustomAgentRepository {
  private readonly byId = new Map<string, CustomAgent>();
  private readonly byType = new Map<string, string>();

  async findByType(agentType: string): Promise<CustomAgent | null> {
    const id = this.byType.get(agentType);
    if (!id) return null;
    const row = this.byId.get(id);
    return row ? { ...row } : null;
  }

  async listAll(): Promise<CustomAgent[]> {
    return [...this.byId.values()]
      .map((row) => ({ ...row }))
      .sort((a, b) => a.agentType.localeCompare(b.agentType));
  }

  async create(agent: CustomAgent): Promise<void> {
    if (this.byId.has(agent.id)) {
      throw new Error(`CustomAgent with id "${agent.id}" already exists`);
    }
    if (this.byType.has(agent.agentType)) {
      throw new Error(`CustomAgent already exists for agentType=${agent.agentType}`);
    }
    this.byId.set(agent.id, { ...agent });
    this.byType.set(agent.agentType, agent.id);
  }

  async update(agent: CustomAgent): Promise<void> {
    if (!this.byId.has(agent.id)) {
      throw new Error(`CustomAgent with id "${agent.id}" not found`);
    }
    this.byId.set(agent.id, { ...agent });
    this.byType.set(agent.agentType, agent.id);
  }

  async delete(agentType: string): Promise<void> {
    const id = this.byType.get(agentType);
    if (!id) return;
    this.byType.delete(agentType);
    this.byId.delete(id);
  }
}
