/**
 * ListAgentPromptsUseCase
 *
 * Returns the merged view of every built-in prompt for an agent type
 * with its currently active override (when one exists). Powers the
 * agent editor's Prompts tab (FR-37).
 */

import { inject, injectable } from 'tsyringe';

import type { IAgentPromptOverrideRepository } from '../../ports/output/repositories/agent-prompt-override-repository.interface.js';
import type { ICustomAgentRepository } from '../../ports/output/repositories/custom-agent-repository.interface.js';
import type { AgentPromptOverride } from '../../../domain/generated/output.js';
import {
  listBuiltinPromptsForAgent,
  listBuiltinAgentTypes,
  type BuiltinPromptSlot,
} from '../../services/builtin-prompt-registry.js';

export interface AgentPromptEntry {
  agentType: string;
  promptId: string;
  name: string;
  description: string;
  /** Bundled (default) prompt body — never mutated. */
  bundledBody: string;
  /** Active override body when present, else the bundled body. */
  effectiveBody: string;
  hasOverride: boolean;
  /** Override metadata when present. */
  override?: AgentPromptOverride;
}

export interface ListAgentPromptsInput {
  agentType: string;
}

@injectable()
export class ListAgentPromptsUseCase {
  constructor(
    @inject('IAgentPromptOverrideRepository')
    private readonly overrides: IAgentPromptOverrideRepository,
    @inject('ICustomAgentRepository')
    private readonly customAgents: ICustomAgentRepository
  ) {}

  /**
   * List every registered agent type (built-ins + customs) with its slot
   * count. Built-ins always come first; customs follow in alphabetical
   * order. Only the in-memory built-in catalog is consulted synchronously
   * — call {@link listAgentTypesAsync} to include customs.
   */
  listAgentTypes(): { agentType: string; promptCount: number; isCustom?: boolean }[] {
    return listBuiltinAgentTypes();
  }

  async listAgentTypesAsync(): Promise<
    { agentType: string; promptCount: number; isCustom: boolean; name?: string }[]
  > {
    const builtins = listBuiltinAgentTypes().map((b) => ({ ...b, isCustom: false }));
    const customs = await this.customAgents.listAll();
    const overrideRows = await this.overrides.listAll();
    const customCounts = new Map<string, number>();
    for (const row of overrideRows) {
      if (!builtins.some((b) => b.agentType === row.agentType)) {
        customCounts.set(row.agentType, (customCounts.get(row.agentType) ?? 0) + 1);
      }
    }
    const customEntries = customs.map((agent) => ({
      agentType: agent.agentType,
      promptCount: customCounts.get(agent.agentType) ?? 0,
      isCustom: true,
      name: agent.name,
    }));
    return [...builtins, ...customEntries];
  }

  async execute(input: ListAgentPromptsInput): Promise<AgentPromptEntry[]> {
    const slots = listBuiltinPromptsForAgent(input.agentType);
    const overrideRows = await this.overrides.listForAgent(input.agentType);

    if (slots.length > 0) {
      const overrideBySlot = new Map(overrideRows.map((row) => [row.promptId, row]));
      return slots.map((slot) => buildEntry(slot, overrideBySlot.get(slot.promptId)));
    }

    // Custom agent: every override row is a slot — there is no bundled
    // body to fall back to, so the override body IS the effective body.
    const custom = await this.customAgents.findByType(input.agentType);
    if (!custom) return [];
    return overrideRows.map((row) => ({
      agentType: row.agentType,
      promptId: row.promptId,
      name: row.promptId,
      description: `Custom prompt for ${custom.name}`,
      bundledBody: '',
      effectiveBody: row.body,
      hasOverride: true,
      override: row,
    }));
  }
}

function buildEntry(slot: BuiltinPromptSlot, override?: AgentPromptOverride): AgentPromptEntry {
  return {
    agentType: slot.agentType,
    promptId: slot.promptId,
    name: slot.name,
    description: slot.description,
    bundledBody: slot.body,
    effectiveBody: override?.body ?? slot.body,
    hasOverride: override !== undefined,
    ...(override !== undefined && { override }),
  };
}
