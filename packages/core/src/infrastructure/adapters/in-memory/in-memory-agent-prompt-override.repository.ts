/**
 * In-Memory AgentPromptOverride Repository
 *
 * Test-friendly adapter for {@link IAgentPromptOverrideRepository}.
 * Enforces the unique-(agentType, promptId) constraint locally so tests
 * exercise the same invariant the SQLite adapter enforces.
 */

import { injectable } from 'tsyringe';
import type { IAgentPromptOverrideRepository } from '@/application/ports/output/repositories/agent-prompt-override-repository.interface.js';
import type { AgentPromptOverride } from '@/domain/generated/output.js';

function key(agentType: string, promptId: string): string {
  return `${agentType}::${promptId}`;
}

@injectable()
export class InMemoryAgentPromptOverrideRepository implements IAgentPromptOverrideRepository {
  private readonly byId = new Map<string, AgentPromptOverride>();
  private readonly bySlot = new Map<string, string>();

  async findActive(agentType: string, promptId: string): Promise<AgentPromptOverride | null> {
    const id = this.bySlot.get(key(agentType, promptId));
    if (!id) return null;
    const row = this.byId.get(id);
    return row ? { ...row } : null;
  }

  async listForAgent(agentType: string): Promise<AgentPromptOverride[]> {
    return [...this.byId.values()]
      .filter((row) => row.agentType === agentType)
      .map((row) => ({ ...row }))
      .sort((a, b) => a.promptId.localeCompare(b.promptId));
  }

  async listAll(): Promise<AgentPromptOverride[]> {
    return [...this.byId.values()]
      .map((row) => ({ ...row }))
      .sort((a, b) => {
        if (a.agentType !== b.agentType) return a.agentType.localeCompare(b.agentType);
        return a.promptId.localeCompare(b.promptId);
      });
  }

  async create(override: AgentPromptOverride): Promise<void> {
    if (this.byId.has(override.id)) {
      throw new Error(`AgentPromptOverride with id "${override.id}" already exists`);
    }
    const slotKey = key(override.agentType, override.promptId);
    if (this.bySlot.has(slotKey)) {
      throw new Error(
        `AgentPromptOverride already exists for agentType=${override.agentType}, promptId=${override.promptId}`
      );
    }
    this.byId.set(override.id, { ...override });
    this.bySlot.set(slotKey, override.id);
  }

  async update(override: AgentPromptOverride): Promise<void> {
    if (!this.byId.has(override.id)) {
      throw new Error(`AgentPromptOverride with id "${override.id}" not found`);
    }
    this.byId.set(override.id, { ...override });
    this.bySlot.set(key(override.agentType, override.promptId), override.id);
  }

  async delete(agentType: string, promptId: string): Promise<void> {
    const slotKey = key(agentType, promptId);
    const id = this.bySlot.get(slotKey);
    if (!id) return;
    this.bySlot.delete(slotKey);
    this.byId.delete(id);
  }
}
