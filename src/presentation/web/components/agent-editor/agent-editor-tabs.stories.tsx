import type { Meta, StoryObj } from '@storybook/react';
import { AgentEditorTabs } from './agent-editor-tabs';

const meta: Meta<typeof AgentEditorTabs> = {
  title: 'AgentEditor/AgentEditorTabs',
  component: AgentEditorTabs,
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
type Story = StoryObj<typeof AgentEditorTabs>;

export const FeatureAgent: Story = {
  args: {
    agentType: 'feature-agent',
    prompts: [
      {
        agentType: 'feature-agent',
        promptId: 'implement.system',
        name: 'Implement phase — system',
        description: 'System prompt for the implement phase.',
        bundledBody: 'You are an autonomous coding agent...',
        effectiveBody: 'You are an autonomous coding agent...',
        hasOverride: false,
      },
      {
        agentType: 'feature-agent',
        promptId: 'plan.system',
        name: 'Plan phase — system',
        description: 'Plan phase system prompt.',
        bundledBody: 'You are the planning agent...',
        effectiveBody: 'You are the planning agent (with extra rigor).',
        hasOverride: true,
      },
    ],
    graph: {
      agentType: 'feature-agent',
      nodes: [
        { id: 'analyze', label: 'Analyze' },
        { id: 'plan', label: 'Plan' },
        { id: 'implement', label: 'Implement' },
      ],
      edges: [
        { from: 'analyze', to: 'plan' },
        { from: 'plan', to: 'implement' },
      ],
    },
  },
};
