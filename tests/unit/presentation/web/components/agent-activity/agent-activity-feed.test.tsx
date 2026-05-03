import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentActivityFeed } from '@/components/agent-activity/agent-activity-feed';
import { AgentMessageKind } from '@/domain/generated/output';
import type { AgentMessageStreamEvent } from '@shepai/core/application/use-cases/agents/stream-agent-events.use-case';

function message(overrides: Partial<AgentMessageStreamEvent> = {}): AgentMessageStreamEvent {
  return {
    kind: 'agent_message',
    messageId: 'm-1',
    appId: 'app-1',
    featureId: 'feat-1',
    fromActor: 'agent:run-1',
    fromAgentRunId: 'run-1',
    toTarget: 'broadcast',
    toKind: 'broadcast',
    messageKind: AgentMessageKind.status,
    payload: JSON.stringify({ phase: 'started' }),
    createdAt: '2026-04-29T09:00:00Z',
    ...overrides,
  };
}

describe('AgentActivityFeed', () => {
  it('renders the empty state when no messages exist', () => {
    render(
      <AgentActivityFeed scopeType="app" scopeId="app-1" featureId="feat-1" overrideMessages={[]} />
    );
    expect(screen.getByTestId('agent-activity-empty')).toBeInTheDocument();
  });

  it('renders seed messages immediately', () => {
    render(
      <AgentActivityFeed
        scopeType="app"
        scopeId="app-1"
        featureId="feat-1"
        initialMessages={[message({ messageId: 'seed-1' })]}
        overrideMessages={[]}
      />
    );
    expect(screen.getByTestId('agent-message-row-seed-1')).toBeInTheDocument();
  });

  it('appends live override messages alongside seeded ones', () => {
    render(
      <AgentActivityFeed
        scopeType="app"
        scopeId="app-1"
        featureId="feat-1"
        initialMessages={[message({ messageId: 'seed-1' })]}
        overrideMessages={[
          message({
            messageId: 'live-1',
            createdAt: '2026-04-29T09:01:00Z',
            payload: JSON.stringify({ phase: 'analyze' }),
          }),
        ]}
      />
    );
    expect(screen.getByTestId('agent-message-row-seed-1')).toBeInTheDocument();
    expect(screen.getByTestId('agent-message-row-live-1')).toBeInTheDocument();
  });

  it('renders the from-actor and a JSON-formatted payload', () => {
    render(
      <AgentActivityFeed
        scopeType="app"
        scopeId="app-1"
        featureId="feat-1"
        overrideMessages={[
          message({ messageId: 'm-x', fromActor: 'agent:run-9', payload: '{"ok":true}' }),
        ]}
      />
    );
    expect(screen.getByTestId('agent-message-from-m-x')).toHaveTextContent('agent:run-9');
    expect(screen.getByTestId('agent-message-payload-m-x')).toHaveTextContent(/"ok"/);
  });

  it('renders an inline error banner when errorMessage is provided', () => {
    render(
      <AgentActivityFeed
        scopeType="app"
        scopeId="app-1"
        featureId="feat-1"
        overrideMessages={[]}
        errorMessage="boom"
      />
    );
    expect(screen.getByTestId('agent-activity-error')).toHaveTextContent('boom');
  });

  it('deduplicates by messageId when seed and live overlap', () => {
    render(
      <AgentActivityFeed
        scopeType="app"
        scopeId="app-1"
        featureId="feat-1"
        initialMessages={[message({ messageId: 'dup' })]}
        overrideMessages={[
          message({
            messageId: 'dup',
            payload: JSON.stringify({ updated: true }),
          }),
        ]}
      />
    );
    const rows = screen.getAllByTestId('agent-message-row-dup');
    expect(rows).toHaveLength(1);
    expect(screen.getByTestId('agent-message-payload-dup')).toHaveTextContent(/"updated"/);
  });
});
