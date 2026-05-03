'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Bot, ArrowRight } from 'lucide-react';

export interface AgentListEntry {
  agentType: string;
  promptCount: number;
  overrideCount: number;
}

export interface AgentListProps {
  agents: AgentListEntry[];
}

export function AgentList({ agents }: AgentListProps) {
  if (agents.length === 0) {
    return (
      <div className="bg-muted/30 rounded-lg border border-dashed p-6">
        <p className="text-sm font-medium">No agents registered</p>
        <p className="text-muted-foreground text-sm">
          The built-in prompt registry is empty — register slots in
          <code className="bg-muted mx-1 rounded px-1 py-0.5 text-xs">
            builtin-prompt-registry.ts
          </code>
          to expose agents in this editor.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y rounded-lg border" data-testid="agent-list">
      {agents.map((agent) => (
        <li
          key={agent.agentType}
          className="flex items-center gap-3 px-3 py-2"
          data-testid={`agent-row-${agent.agentType}`}
        >
          <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-md">
            <Bot className="size-4" aria-hidden />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-sm font-medium">{agent.agentType}</p>
            <p className="text-muted-foreground text-xs">
              {agent.promptCount} prompt{agent.promptCount === 1 ? '' : 's'}
              {agent.overrideCount > 0
                ? ` · ${agent.overrideCount} override${agent.overrideCount === 1 ? '' : 's'}`
                : ''}
            </p>
          </div>
          <Link
            href={`/agents/${agent.agentType}` as Route}
            className="text-primary inline-flex shrink-0 items-center gap-1 text-xs hover:underline"
          >
            Edit
            <ArrowRight className="size-3" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
