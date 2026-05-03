import type { Meta, StoryObj } from '@storybook/react';
import { AgentGraphView } from './agent-graph-view';

const meta: Meta<typeof AgentGraphView> = {
  title: 'AgentEditor/AgentGraphView',
  component: AgentGraphView,
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
type Story = StoryObj<typeof AgentGraphView>;

export const FeatureAgent: Story = {
  args: {
    graph: {
      agentType: 'feature-agent',
      nodes: [
        { id: 'analyze', label: 'Analyze' },
        { id: 'plan', label: 'Plan' },
        { id: 'implement', label: 'Implement' },
        { id: 'merge', label: 'Merge' },
      ],
      edges: [
        { from: 'analyze', to: 'plan' },
        { from: 'plan', to: 'implement' },
        { from: 'implement', to: 'merge' },
      ],
    },
  },
};

export const Empty: Story = { args: { graph: null } };
