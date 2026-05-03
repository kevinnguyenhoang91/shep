/**
 * ListAgentPromptsUseCase
 *
 * Returns the merged view of every built-in prompt for an agent type
 * with its currently active override (when one exists). Powers the
 * agent editor's Prompts tab (FR-37).
 */

import { inject, injectable } from 'tsyringe';

import type { IAgentPromptOverrideRepository } from '../../ports/output/repositories/agent-prompt-override-repository.interface.js';
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
    private readonly overrides: IAgentPromptOverrideRepository
  ) {}

  /** List every registered agent type and its slot count. */
  listAgentTypes(): { agentType: string; promptCount: number }[] {
    return listBuiltinAgentTypes();
  }

  async execute(input: ListAgentPromptsInput): Promise<AgentPromptEntry[]> {
    const slots = listBuiltinPromptsForAgent(input.agentType);
    if (slots.length === 0) return [];

    const overrideRows = await this.overrides.listForAgent(input.agentType);
    const overrideBySlot = new Map(overrideRows.map((row) => [row.promptId, row]));

    return slots.map((slot) => buildEntry(slot, overrideBySlot.get(slot.promptId)));
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
