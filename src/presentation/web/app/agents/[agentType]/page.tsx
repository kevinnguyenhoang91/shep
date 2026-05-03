import { notFound } from 'next/navigation';
import { resolve } from '@/lib/server-container';
import type { ListAgentPromptsUseCase } from '@shepai/core/application/use-cases/agents/list-agent-prompts.use-case';
import type { GetAgentGraphUseCase } from '@shepai/core/application/use-cases/agents/get-agent-graph.use-case';
import { getFeatureFlags } from '@/lib/feature-flags';
import { AgentEditorTabs } from '@/components/agent-editor/agent-editor-tabs';
import type { AgentGraphDescriptor } from '@/components/agent-editor/agent-graph-view';

export const dynamic = 'force-dynamic';

interface RouteProps {
  params: Promise<{ agentType: string }>;
}

export default async function AgentEditorRoute({ params }: RouteProps) {
  const flags = getFeatureFlags();
  if (!flags.collaboration) {
    notFound();
  }

  const { agentType } = await params;
  const listPrompts = resolve<ListAgentPromptsUseCase>('ListAgentPromptsUseCase');
  const getGraph = resolve<GetAgentGraphUseCase>('GetAgentGraphUseCase');

  const [prompts, graphResult] = await Promise.all([
    listPrompts.execute({ agentType }),
    getGraph.execute({ agentType }),
  ]);

  if (prompts.length === 0) {
    notFound();
  }

  const graph: AgentGraphDescriptor | null = graphResult
    ? { agentType, nodes: graphResult.nodes, edges: graphResult.edges }
    : null;
  const bundled: AgentGraphDescriptor | null = graphResult
    ? {
        agentType,
        nodes: graphResult.bundled.nodes,
        edges: graphResult.bundled.edges,
      }
    : null;
  const hasGraphOverride = graphResult?.hasOverride ?? false;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{agentType}</h1>
        <p className="text-muted-foreground text-sm">
          {prompts.length} prompt slot{prompts.length === 1 ? '' : 's'} ·{' '}
          {prompts.filter((p) => p.hasOverride).length} override
          {prompts.filter((p) => p.hasOverride).length === 1 ? '' : 's'}
        </p>
      </header>
      <AgentEditorTabs
        agentType={agentType}
        prompts={prompts}
        graph={graph}
        bundledGraph={bundled}
        hasGraphOverride={hasGraphOverride}
      />
    </div>
  );
}
