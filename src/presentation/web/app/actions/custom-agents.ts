'use server';

import { resolve } from '@/lib/server-container';
import type { CreateCustomAgentUseCase } from '@shepai/core/application/use-cases/agents/create-custom-agent.use-case';
import type { DeleteCustomAgentUseCase } from '@shepai/core/application/use-cases/agents/delete-custom-agent.use-case';
import { revalidatePath } from 'next/cache';
import { requireFeatureFlag } from '@/lib/feature-flags';

export interface CreateCustomAgentInput {
  agentType: string;
  name: string;
  description: string;
  initialPromptId?: string;
  initialPromptBody?: string;
}

export interface CreateCustomAgentResult {
  ok: boolean;
  agentType?: string;
  error?: string;
}

export async function createCustomAgent(
  input: CreateCustomAgentInput
): Promise<CreateCustomAgentResult> {
  try {
    requireFeatureFlag('collaboration');
    const useCase = resolve<CreateCustomAgentUseCase>('CreateCustomAgentUseCase');
    const seedPrompt =
      input.initialPromptId?.trim() && input.initialPromptBody?.length
        ? { promptId: input.initialPromptId.trim(), body: input.initialPromptBody }
        : undefined;
    const result = await useCase.execute({
      agentType: input.agentType,
      name: input.name,
      description: input.description,
      ...(seedPrompt !== undefined && { initialPrompt: seedPrompt }),
    });
    revalidatePath('/agents');
    revalidatePath(`/agents/${result.agent.agentType}`);
    return { ok: true, agentType: result.agent.agentType };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to create agent',
    };
  }
}

export interface DeleteCustomAgentResult {
  ok: boolean;
  error?: string;
}

export async function deleteCustomAgent(input: {
  agentType: string;
}): Promise<DeleteCustomAgentResult> {
  try {
    requireFeatureFlag('collaboration');
    const useCase = resolve<DeleteCustomAgentUseCase>('DeleteCustomAgentUseCase');
    await useCase.execute(input);
    revalidatePath('/agents');
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to delete agent',
    };
  }
}
