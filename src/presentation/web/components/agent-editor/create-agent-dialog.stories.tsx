import type { Meta, StoryObj } from '@storybook/react';
import { CreateAgentDialog } from './create-agent-dialog';

const meta: Meta<typeof CreateAgentDialog> = {
  title: 'AgentEditor/CreateAgentDialog',
  component: CreateAgentDialog,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof CreateAgentDialog>;

export const TriggerOnly: Story = {
  args: {
    onCreateOverride: async (input) => ({ ok: true, agentType: input.agentType }),
    onNavigateOverride: () => undefined,
  },
};

export const Open: Story = {
  args: {
    initialOpen: true,
    onCreateOverride: async (input) => ({ ok: true, agentType: input.agentType }),
    onNavigateOverride: () => undefined,
  },
};

export const SubmitError: Story = {
  args: {
    initialOpen: true,
    onCreateOverride: async () => ({
      ok: false,
      error: 'agentType "code-review" already exists',
    }),
    onNavigateOverride: () => undefined,
  },
};
