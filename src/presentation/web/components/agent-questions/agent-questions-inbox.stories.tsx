import type { Meta, StoryObj } from '@storybook/react';
import { AgentQuestionsInbox } from './agent-questions-inbox';
import {
  AgentQuestionAnswerer,
  AgentQuestionKind,
  AgentQuestionStatus,
  type AgentQuestion,
} from '@shepai/core/domain/generated/output';

const meta: Meta<typeof AgentQuestionsInbox> = {
  title: 'AgentQuestions/AgentQuestionsInbox',
  component: AgentQuestionsInbox,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentQuestionsInbox>;

function question(overrides: Partial<AgentQuestion> = {}): AgentQuestion {
  return {
    id: 'q-1',
    appId: 'app-1',
    featureId: 'feat-1',
    agentRunId: 'run-abcd1234',
    kind: AgentQuestionKind.question,
    prompt: 'Should we drop the old auth middleware before deploying?',
    optionsJson: JSON.stringify(['yes', 'no']),
    answerer: AgentQuestionAnswerer.user,
    status: AgentQuestionStatus.pending,
    createdAt: '2026-04-29T09:00:00Z',
    updatedAt: '2026-04-29T09:00:00Z',
    ...overrides,
  };
}

export const Empty: Story = {
  args: {
    initialQuestions: [],
  },
};

export const Default: Story = {
  args: {
    initialQuestions: [question()],
  },
};

export const Many: Story = {
  args: {
    initialQuestions: [
      question({
        id: 'q-block',
        kind: AgentQuestionKind.blocking,
        prompt: 'Approve PRD before continuing?',
        optionsJson: JSON.stringify(['approve', 'reject']),
      }),
      question({
        id: 'q-info',
        kind: AgentQuestionKind.info,
        status: AgentQuestionStatus.answered,
        answer: 'noted',
        answeredBy: 'user:web',
        prompt: 'FYI: tests took 22m on the last run.',
      }),
      question({
        id: 'q-free',
        prompt: 'What library should we use for charting?',
        optionsJson: undefined,
      }),
    ],
  },
};

export const Error: Story = {
  args: {
    initialQuestions: [question()],
    errorMessage: 'Failed to submit answer — server returned 500',
  },
};
