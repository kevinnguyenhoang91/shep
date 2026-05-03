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

const FEATURE_AGENT_GRAPH = {
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
};

const noopSave = async () => ({ ok: true });
const noopReset = async () => ({ ok: true });

export const FeatureAgent: Story = {
  args: {
    graph: FEATURE_AGENT_GRAPH,
    bundled: FEATURE_AGENT_GRAPH,
    hasOverride: false,
    onSaveOverride: noopSave,
    onResetOverride: noopReset,
  },
};

export const Overridden: Story = {
  args: {
    graph: {
      ...FEATURE_AGENT_GRAPH,
      nodes: [
        ...FEATURE_AGENT_GRAPH.nodes,
        { id: 'review', label: 'Review (custom)', description: 'extra advisory step' },
      ],
      edges: [
        ...FEATURE_AGENT_GRAPH.edges.filter((e) => e.to !== 'merge'),
        { from: 'implement', to: 'review' },
        { from: 'review', to: 'merge' },
      ],
    },
    bundled: FEATURE_AGENT_GRAPH,
    hasOverride: true,
    onSaveOverride: noopSave,
    onResetOverride: noopReset,
  },
};

export const Editing: Story = {
  args: {
    graph: FEATURE_AGENT_GRAPH,
    bundled: FEATURE_AGENT_GRAPH,
    hasOverride: false,
    initialEditing: true,
    onSaveOverride: noopSave,
    onResetOverride: noopReset,
  },
};

export const SaveError: Story = {
  args: {
    graph: FEATURE_AGENT_GRAPH,
    bundled: FEATURE_AGENT_GRAPH,
    hasOverride: false,
    initialEditing: true,
    onSaveOverride: async () => ({ ok: false, error: 'Network error: could not reach server' }),
    onResetOverride: noopReset,
  },
};

export const Empty: Story = { args: { graph: null } };
