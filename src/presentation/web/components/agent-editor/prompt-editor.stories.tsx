import type { Meta, StoryObj } from '@storybook/react';
import { PromptEditor } from './prompt-editor';

const meta: Meta<typeof PromptEditor> = {
  title: 'AgentEditor/PromptEditor',
  component: PromptEditor,
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
type Story = StoryObj<typeof PromptEditor>;

const sampleEntries = [
  {
    agentType: 'supervisor-agent',
    promptId: 'evaluator.system',
    name: 'Evaluator system header',
    description: 'Hard rules every supervisor evaluation prepends.',
    bundledBody: 'You are a delegated supervisor agent...',
    effectiveBody: 'You are a delegated supervisor agent...',
    hasOverride: false,
  },
  {
    agentType: 'supervisor-agent',
    promptId: 'reviewer.system',
    name: 'Reviewer system header',
    description: 'Used when the supervisor reviews an outgoing PR.',
    bundledBody: 'You are reviewing a pull request...',
    effectiveBody: 'You are reviewing a pull request — be especially strict on migrations.',
    hasOverride: true,
  },
];

export const Default: Story = {
  args: {
    entries: sampleEntries,
    onSaveOverride: async () => ({ ok: true }),
    onResetOverride: async () => ({ ok: true }),
  },
};

export const Empty: Story = {
  args: {
    entries: [],
    onSaveOverride: async () => ({ ok: true }),
    onResetOverride: async () => ({ ok: true }),
  },
};

export const SaveError: Story = {
  args: {
    entries: sampleEntries,
    onSaveOverride: async () => ({ ok: false, error: 'Failed to save: 503 Service Unavailable' }),
    onResetOverride: async () => ({ ok: true }),
  },
};
