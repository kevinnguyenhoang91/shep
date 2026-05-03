'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAgentMessages } from '@/hooks/agent-events-provider';
import type { AgentMessageStreamEvent } from '@shepai/core/application/use-cases/agents/stream-agent-events.use-case';
import { AgentMessageKind } from '@shepai/core/domain/generated/output';

const KIND_VARIANT: Record<AgentMessageKind, 'default' | 'destructive' | 'secondary'> = {
  [AgentMessageKind.status]: 'secondary',
  [AgentMessageKind.request]: 'default',
  [AgentMessageKind.reply]: 'default',
  [AgentMessageKind.blocked]: 'destructive',
  [AgentMessageKind.info]: 'secondary',
};

export interface AgentActivityFeedProps {
  scopeType: string;
  scopeId?: string;
  featureId?: string;
  /** Seed messages rendered before any SSE events arrive (e.g. from a server fetch). */
  initialMessages?: AgentMessageStreamEvent[];
  /** Override SSE messages (Storybook + tests where the provider is not wired). */
  overrideMessages?: AgentMessageStreamEvent[];
  /** Storybook escape hatch: render an inline error banner. */
  errorMessage?: string | null;
  /** Storybook escape hatch: limit the displayed list. */
  limit?: number;
}

export function AgentActivityFeed({
  scopeType,
  scopeId,
  featureId,
  initialMessages = [],
  overrideMessages,
  errorMessage = null,
  limit = 100,
}: AgentActivityFeedProps) {
  const live = useAgentMessages({ scopeType, scopeId, featureId });
  const liveMessages = overrideMessages ?? live.messages;

  const merged = useMemo(() => {
    const byId = new Map<string, AgentMessageStreamEvent>();
    for (const m of initialMessages) byId.set(m.messageId, m);
    for (const m of liveMessages) byId.set(m.messageId, m);
    const all = [...byId.values()];
    all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return all.slice(-limit);
  }, [initialMessages, liveMessages, limit]);

  if (errorMessage) {
    return (
      <Alert variant="destructive" data-testid="agent-activity-error">
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    );
  }

  if (merged.length === 0) {
    return (
      <div
        data-testid="agent-activity-empty"
        className="text-muted-foreground rounded border border-dashed p-4 text-center text-sm"
      >
        No agent activity yet for this feature.
      </div>
    );
  }

  return (
    <ol
      className="flex flex-col gap-2"
      data-testid="agent-activity-feed"
      aria-label="Agent activity feed"
    >
      {merged.map((message) => (
        <AgentMessageRow key={message.messageId} message={message} />
      ))}
    </ol>
  );
}

function AgentMessageRow({ message }: { message: AgentMessageStreamEvent }) {
  const variant = KIND_VARIANT[message.messageKind] ?? 'secondary';
  const preview = previewPayload(message.payload);
  return (
    <li
      className="flex flex-col gap-1 rounded border p-3"
      data-testid={`agent-message-row-${message.messageId}`}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={variant} className="capitalize">
            {message.messageKind}
          </Badge>
          <span
            className="text-muted-foreground text-xs"
            data-testid={`agent-message-from-${message.messageId}`}
          >
            {message.fromActor}
          </span>
          <span className="text-muted-foreground text-xs">→</span>
          <span className="text-muted-foreground text-xs">
            {message.toKind === 'broadcast' ? 'broadcast' : message.toTarget}
          </span>
        </div>
        <time className="text-muted-foreground text-xs">{formatTime(message.createdAt)}</time>
      </header>
      <p
        className="font-mono text-xs whitespace-pre-wrap"
        data-testid={`agent-message-payload-${message.messageId}`}
      >
        {preview}
      </p>
    </li>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

function previewPayload(payload: string): string {
  if (!payload) return '';
  try {
    const parsed = JSON.parse(payload);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return payload;
  }
}
