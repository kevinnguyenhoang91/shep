'use server';

import { resolve } from '@/lib/server-container';
import type { UpsertAgentGraphOverrideUseCase } from '@shepai/core/application/use-cases/agents/upsert-agent-graph-override.use-case';
import type { DeleteAgentGraphOverrideUseCase } from '@shepai/core/application/use-cases/agents/delete-agent-graph-override.use-case';
import { revalidatePath } from 'next/cache';
import { requireFeatureFlag } from '@/lib/feature-flags';

export interface GraphNodeInput {
  id: string;
  label: string;
  description?: string;
}

export interface GraphEdgeInput {
  from: string;
  to: string;
  label?: string;
}

export interface SaveAgentGraphInput {
  agentType: string;
  nodes: GraphNodeInput[];
  edges: GraphEdgeInput[];
}

export interface SaveAgentGraphResult {
  ok: boolean;
  error?: string;
}

export async function saveAgentGraph(input: SaveAgentGraphInput): Promise<SaveAgentGraphResult> {
  try {
    requireFeatureFlag('collaboration');
    const useCase = resolve<UpsertAgentGraphOverrideUseCase>('UpsertAgentGraphOverrideUseCase');
    await useCase.execute({
      agentType: input.agentType,
      nodes: input.nodes,
      edges: input.edges,
    });
    revalidatePath(`/agents/${input.agentType}`);
    revalidatePath('/agents');
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to save graph',
    };
  }
}

export interface ResetAgentGraphInput {
  agentType: string;
}

export async function resetAgentGraph(input: ResetAgentGraphInput): Promise<SaveAgentGraphResult> {
  try {
    requireFeatureFlag('collaboration');
    const useCase = resolve<DeleteAgentGraphOverrideUseCase>('DeleteAgentGraphOverrideUseCase');
    await useCase.execute(input);
    revalidatePath(`/agents/${input.agentType}`);
    revalidatePath('/agents');
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to reset graph',
    };
  }
}
