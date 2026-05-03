'use server';

import { resolve } from '@/lib/server-container';
import type { UpsertAgentPromptOverrideUseCase } from '@shepai/core/application/use-cases/agents/upsert-agent-prompt-override.use-case';
import type { DeleteAgentPromptOverrideUseCase } from '@shepai/core/application/use-cases/agents/delete-agent-prompt-override.use-case';
import { revalidatePath } from 'next/cache';
import { requireFeatureFlag } from '@/lib/feature-flags';

export interface SaveAgentPromptInput {
  agentType: string;
  promptId: string;
  body: string;
}

export interface SaveAgentPromptResult {
  ok: boolean;
  error?: string;
}

export async function saveAgentPrompt(input: SaveAgentPromptInput): Promise<SaveAgentPromptResult> {
  try {
    requireFeatureFlag('collaboration');
    const useCase = resolve<UpsertAgentPromptOverrideUseCase>('UpsertAgentPromptOverrideUseCase');
    await useCase.execute({
      agentType: input.agentType,
      promptId: input.promptId,
      body: input.body,
    });
    revalidatePath(`/agents/${input.agentType}`);
    revalidatePath('/agents');
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to save prompt',
    };
  }
}

export interface ResetAgentPromptInput {
  agentType: string;
  promptId: string;
}

export async function resetAgentPrompt(
  input: ResetAgentPromptInput
): Promise<SaveAgentPromptResult> {
  try {
    requireFeatureFlag('collaboration');
    const useCase = resolve<DeleteAgentPromptOverrideUseCase>('DeleteAgentPromptOverrideUseCase');
    await useCase.execute(input);
    revalidatePath(`/agents/${input.agentType}`);
    revalidatePath('/agents');
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to reset prompt',
    };
  }
}
