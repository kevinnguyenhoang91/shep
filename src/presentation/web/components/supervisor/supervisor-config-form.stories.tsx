import type { Meta, StoryObj } from '@storybook/react';
import { SupervisorConfigForm } from './supervisor-config-form';
import { SupervisorAutonomy, SupervisorScopeType } from '@shepai/core/domain/generated/output';
import type { SupervisorPolicy } from '@shepai/core/domain/generated/output';

const meta: Meta<typeof SupervisorConfigForm> = {
  title: 'Supervisor/SupervisorConfigForm',
  component: SupervisorConfigForm,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SupervisorConfigForm>;

const samplePolicy: SupervisorPolicy = {
  id: 'pol-123',
  scopeType: SupervisorScopeType.app,
  scopeId: 'app-1',
  enabled: true,
  autonomyLevel: SupervisorAutonomy.advisory,
  modelId: 'claude-sonnet-4',
  promptVersion: 'v1',
  gateAuthorityJson: JSON.stringify({ merge: SupervisorAutonomy.cosign }),
  policyRulesJson: undefined,
  notificationOverridesJson: undefined,
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-15T00:00:00Z',
};

export const Default: Story = {
  args: {
    scopeType: 'app',
    scopeId: 'app-1',
    initialPolicy: null,
    onSubmitOverride: async () => ({ ok: true }),
  },
};

export const ExistingPolicy: Story = {
  args: {
    scopeType: 'app',
    scopeId: 'app-1',
    initialPolicy: samplePolicy,
    onSubmitOverride: async () => ({ ok: true }),
  },
};

export const FeatureOverride: Story = {
  args: {
    scopeType: 'app',
    scopeId: 'app-1',
    featureId: 'feat-7',
    initialPolicy: null,
    onSubmitOverride: async () => ({ ok: true }),
  },
};

export const Loading: Story = {
  args: {
    scopeType: 'app',
    scopeId: 'app-1',
    initialPolicy: null,
    forceState: 'loading',
    onSubmitOverride: async () => ({ ok: true }),
  },
};

export const Error: Story = {
  args: {
    scopeType: 'app',
    scopeId: 'app-1',
    initialPolicy: null,
    forceState: 'error',
    onSubmitOverride: async () => ({ ok: false, error: 'Validation failed' }),
  },
};
