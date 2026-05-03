import { notFound } from 'next/navigation';
import { resolve } from '@/lib/server-container';
import type { ListAgentPromptsUseCase } from '@shepai/core/application/use-cases/agents/list-agent-prompts.use-case';
import type { IAgentPromptOverrideRepository } from '@shepai/core/application/ports/output/repositories/agent-prompt-override-repository.interface';
import { getFeatureFlags } from '@/lib/feature-flags';
import { AgentList, type AgentListEntry } from '@/components/agent-editor/agent-list';

export const dynamic = 'force-dynamic';

export default async function AgentsRoute() {
  const flags = getFeatureFlags();
  if (!flags.collaboration) {
    notFound();
  }

  const listPrompts = resolve<ListAgentPromptsUseCase>('ListAgentPromptsUseCase');
  const overrideRepo = resolve<IAgentPromptOverrideRepository>('IAgentPromptOverrideRepository');

  const types = listPrompts.listAgentTypes();
  const overrides = await overrideRepo.listAll();
  const overrideCounts = new Map<string, number>();
  for (const o of overrides) {
    overrideCounts.set(o.agentType, (overrideCounts.get(o.agentType) ?? 0) + 1);
  }

  const agents: AgentListEntry[] = types.map((t) => ({
    agentType: t.agentType,
    promptCount: t.promptCount,
    overrideCount: overrideCounts.get(t.agentType) ?? 0,
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Agents</h1>
        <p className="text-muted-foreground text-sm">
          Edit the prompts and inspect the LangGraph state machine for each registered agent.
        </p>
      </header>
      <AgentList agents={agents} />
    </div>
  );
}
