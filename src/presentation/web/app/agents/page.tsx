import { notFound } from 'next/navigation';
import { resolve } from '@/lib/server-container';
import type { ListAgentPromptsUseCase } from '@shepai/core/application/use-cases/agents/list-agent-prompts.use-case';
import type { IAgentPromptOverrideRepository } from '@shepai/core/application/ports/output/repositories/agent-prompt-override-repository.interface';
import { getFeatureFlags } from '@/lib/feature-flags';
import { AgentList, type AgentListEntry } from '@/components/agent-editor/agent-list';
import { CreateAgentDialog } from '@/components/agent-editor/create-agent-dialog';
import { WelcomeBanner } from '@/components/onboarding/welcome-banner';

export const dynamic = 'force-dynamic';

export default async function AgentsRoute() {
  const flags = getFeatureFlags();
  if (!flags.collaboration) {
    notFound();
  }

  const listPrompts = resolve<ListAgentPromptsUseCase>('ListAgentPromptsUseCase');
  const overrideRepo = resolve<IAgentPromptOverrideRepository>('IAgentPromptOverrideRepository');

  const types = await listPrompts.listAgentTypesAsync();
  const overrides = await overrideRepo.listAll();
  const overrideCounts = new Map<string, number>();
  for (const o of overrides) {
    overrideCounts.set(o.agentType, (overrideCounts.get(o.agentType) ?? 0) + 1);
  }

  const agents: AgentListEntry[] = types.map((t) => ({
    agentType: t.agentType,
    promptCount: t.promptCount,
    overrideCount: overrideCounts.get(t.agentType) ?? 0,
    isCustom: t.isCustom,
    ...(t.name !== undefined && { displayName: t.name }),
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <WelcomeBanner
        id="agents:v1"
        title="Edit prompts, design graphs, or stand up a brand new agent."
        description="Each agent has Prompts, Graph, and Playground tabs. Custom agents share the same surfaces — pick New agent to create one."
        ctaLabel="Open the tutorial"
        ctaHref="/onboarding#agents"
      />
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Agents</h1>
          <p className="text-muted-foreground text-sm">
            Edit the prompts and inspect the LangGraph state machine for each registered agent.
          </p>
        </div>
        <CreateAgentDialog />
      </header>
      <AgentList agents={agents} />
    </div>
  );
}
