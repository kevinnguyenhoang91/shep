import type { Meta, StoryObj } from '@storybook/react';
import { AgentList } from './agent-list';

const meta: Meta<typeof AgentList> = {
  title: 'AgentEditor/AgentList',
  component: AgentList,
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
type Story = StoryObj<typeof AgentList>;

export const Default: Story = {
  args: {
    agents: [
      { agentType: 'feature-agent', promptCount: 4, overrideCount: 1 },
      { agentType: 'supervisor-agent', promptCount: 1, overrideCount: 0 },
    ],
  },
};

export const Empty: Story = { args: { agents: [] } };

export const Many: Story = {
  args: {
    agents: Array.from({ length: 8 }, (_, i) => ({
      agentType: `agent-${i + 1}`,
      promptCount: (i % 4) + 1,
      overrideCount: i % 3,
    })),
  },
};
