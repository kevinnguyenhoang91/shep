import type { Meta, StoryObj } from '@storybook/react';
import { AgentActivityFeed } from './agent-activity-feed';
import { AgentMessageKind } from '@shepai/core/domain/generated/output';
import type { AgentMessageStreamEvent } from '@shepai/core/application/use-cases/agents/stream-agent-events.use-case';

const meta: Meta<typeof AgentActivityFeed> = {
  title: 'AgentActivity/AgentActivityFeed',
  component: AgentActivityFeed,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentActivityFeed>;

function message(overrides: Partial<AgentMessageStreamEvent> = {}): AgentMessageStreamEvent {
  return {
    kind: 'agent_message',
    messageId: 'msg-1',
    appId: 'app-1',
    featureId: 'feat-1',
    fromActor: 'agent:run-abcd',
    fromAgentRunId: 'run-abcd',
    toTarget: 'broadcast',
    toKind: 'broadcast',
    messageKind: AgentMessageKind.status,
    payload: JSON.stringify({ phase: 'started', detail: 'kicked off feature agent' }),
    correlationId: undefined,
    createdAt: '2026-04-29T09:00:00Z',
    ...overrides,
  };
}

export const Empty: Story = {
  args: {
    scopeType: 'app',
    scopeId: 'app-1',
    featureId: 'feat-1',
    overrideMessages: [],
  },
};

export const FewMessages: Story = {
  args: {
    scopeType: 'app',
    scopeId: 'app-1',
    featureId: 'feat-1',
    overrideMessages: [
      message({ messageId: 'm1' }),
      message({
        messageId: 'm2',
        messageKind: AgentMessageKind.request,
        payload: JSON.stringify({ ask: 'review my plan' }),
        createdAt: '2026-04-29T09:01:00Z',
      }),
    ],
  },
};

export const ManyMessages: Story = {
  args: {
    scopeType: 'app',
    scopeId: 'app-1',
    featureId: 'feat-1',
    overrideMessages: Array.from({ length: 12 }, (_, i) =>
      message({
        messageId: `m${i + 1}`,
        messageKind:
          i % 4 === 0
            ? AgentMessageKind.blocked
            : i % 3 === 0
              ? AgentMessageKind.reply
              : AgentMessageKind.status,
        payload: JSON.stringify({ step: i + 1 }),
        createdAt: new Date(Date.parse('2026-04-29T09:00:00Z') + i * 60_000).toISOString(),
      })
    ),
  },
};

export const Error: Story = {
  args: {
    scopeType: 'app',
    scopeId: 'app-1',
    featureId: 'feat-1',
    overrideMessages: [],
    errorMessage: 'Failed to load agent activity feed',
  },
};
