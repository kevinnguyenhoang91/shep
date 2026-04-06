/**
 * Send Telegram Message Use Case
 *
 * Sends a proactive message to the authorized Telegram user using the
 * bot configuration stored in Settings. Intended to be called by other
 * use cases (e.g. notification dispatchers) that want to push updates
 * to the user's phone without requiring the bot lifecycle to be running.
 *
 * Resolution order:
 *   1. Load Settings
 *   2. Read telegramIntegration.botToken + authorizedUserId
 *   3. If missing or disabled → noop (silently skip)
 *   4. Otherwise delegate to ITelegramBotService.sendMessage
 */

import { injectable, inject } from 'tsyringe';
import type { ITelegramBotService } from '../../ports/output/services/telegram-bot-service.interface.js';
import type { ISettingsRepository } from '../../ports/output/repositories/settings.repository.interface.js';

export interface SendTelegramMessageInput {
  readonly text: string;
  /**
   * Optional chat ID override. Defaults to the authorized user ID from
   * Settings (which is also the 1:1 chat ID for private chats).
   */
  readonly chatId?: number;
}

export interface SendTelegramMessageResult {
  readonly sent: boolean;
  readonly reason?: string;
}

@injectable()
export class SendTelegramMessageUseCase {
  constructor(
    @inject('ITelegramBotService')
    private readonly telegramBot: ITelegramBotService,
    @inject('ISettingsRepository')
    private readonly settingsRepository: ISettingsRepository
  ) {}

  async execute(input: SendTelegramMessageInput): Promise<SendTelegramMessageResult> {
    if (!input.text || input.text.length === 0) {
      return { sent: false, reason: 'empty message' };
    }

    const settings = await this.settingsRepository.load();
    if (!settings) {
      return { sent: false, reason: 'settings not initialized' };
    }

    const cfg = settings.telegramIntegration;
    if (!cfg?.enabled) {
      return { sent: false, reason: 'telegram integration disabled' };
    }
    if (!cfg.botToken || cfg.authorizedUserId === undefined || cfg.authorizedUserId === null) {
      return { sent: false, reason: 'telegram integration not configured' };
    }

    const chatId = input.chatId ?? Number(cfg.authorizedUserId);
    await this.telegramBot.sendMessage(cfg.botToken, chatId, input.text);
    return { sent: true };
  }
}
