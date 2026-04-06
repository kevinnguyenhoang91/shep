import type { Meta, StoryObj } from '@storybook/react';
import { AgentAvailabilityBadge } from './AgentAvailabilityBadge';

const meta: Meta<typeof AgentAvailabilityBadge> = {
  title: 'Features/Settings/AgentAvailabilityBadge',
  component: AgentAvailabilityBadge,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Available: Story = {
  args: { status: 'available' },
};

export const NeedsAuth: Story = {
  args: { status: 'needs-auth' },
};

export const NotInstalled: Story = {
  args: { status: 'not-installed' },
};

export const Checking: Story = {
  args: { status: 'checking' },
};

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-sm w-24">Available:</span>
        <AgentAvailabilityBadge status="available" />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm w-24">Needs auth:</span>
        <AgentAvailabilityBadge status="needs-auth" />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm w-24">Not installed:</span>
        <AgentAvailabilityBadge status="not-installed" />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm w-24">Checking:</span>
        <AgentAvailabilityBadge status="checking" />
      </div>
    </div>
  ),
};
