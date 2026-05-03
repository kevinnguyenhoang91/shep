import type { Meta, StoryObj } from '@storybook/react';
import { WelcomeBanner } from './welcome-banner';

const meta: Meta<typeof WelcomeBanner> = {
  title: 'Onboarding/WelcomeBanner',
  component: WelcomeBanner,
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
type Story = StoryObj<typeof WelcomeBanner>;

export const Default: Story = {
  args: {
    id: 'storybook:supervisor',
    forceVisible: true,
    title: 'New here? Read the 2-minute supervisor walkthrough.',
    description:
      'Supervisors watch agents and decide what to approve, advise, escalate, or reject. Policies cascade.',
    ctaLabel: 'Open the tutorial',
    ctaHref: '/onboarding#supervisors',
  },
};

export const NoCta: Story = {
  args: {
    id: 'storybook:no-cta',
    forceVisible: true,
    title: 'A short hint',
    description: 'Just a heads-up — no action required.',
  },
};
