import type { Meta, StoryObj } from '@storybook/react';
import { TelegramIntegrationSection } from './telegram-integration-section';

const meta = {
  title: 'Features/Settings/TelegramIntegrationSection',
  component: TelegramIntegrationSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof TelegramIntegrationSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    telegramIntegration: { enabled: false },
  },
};

export const PartiallyConfigured: Story = {
  args: {
    telegramIntegration: {
      enabled: false,
      botToken: '123456:ABC-def_sample_token',
    },
  },
};

export const FullyConfiguredDisabled: Story = {
  args: {
    telegramIntegration: {
      enabled: false,
      botToken: '123456:ABC-def_sample_token',
      authorizedUserId: '987654321',
      authorizedUserLabel: 'Jane — personal',
    },
  },
};

export const Enabled: Story = {
  args: {
    telegramIntegration: {
      enabled: true,
      botToken: '123456:ABC-def_sample_token',
      authorizedUserId: '987654321',
      authorizedUserLabel: 'Jane — personal',
    },
  },
};
