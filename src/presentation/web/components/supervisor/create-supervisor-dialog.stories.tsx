import type { Meta, StoryObj } from '@storybook/react';
import { CreateSupervisorDialog } from './create-supervisor-dialog';

const meta: Meta<typeof CreateSupervisorDialog> = {
  title: 'Supervisor/CreateSupervisorDialog',
  component: CreateSupervisorDialog,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof CreateSupervisorDialog>;

const APPS = [
  { id: 'app-1', name: 'Internal SaaS' },
  { id: 'app-2', name: 'Marketing site' },
];
const REPOS = [
  { id: 'repo-1', name: 'cli' },
  { id: 'repo-2', name: 'web' },
];
const FEATURES = [
  { id: 'feat-1', name: 'New billing flow', applicationId: 'app-1' },
  { id: 'feat-2', name: 'Profile editor', repositoryId: 'repo-2' },
];

export const TriggerOnly: Story = {
  args: { applications: APPS, repositories: REPOS, features: FEATURES },
};

export const OpenWithGlobalScope: Story = {
  args: {
    applications: APPS,
    repositories: REPOS,
    features: FEATURES,
    initialOpen: true,
  },
};

export const NoScopesYet: Story = {
  args: { applications: [], repositories: [], features: [], initialOpen: true },
};
