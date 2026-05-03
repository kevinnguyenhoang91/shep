import type { Meta, StoryObj } from '@storybook/react';
import { OnboardingTutorial } from './onboarding-tutorial';

const meta: Meta<typeof OnboardingTutorial> = {
  title: 'Onboarding/OnboardingTutorial',
  component: OnboardingTutorial,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof OnboardingTutorial>;

export const Default: Story = {};
