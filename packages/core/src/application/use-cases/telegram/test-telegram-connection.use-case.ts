/**
 * Test Telegram Connection Use Case
 *
 * Verifies that a Telegram bot token is valid by calling the Telegram
 * `getMe` endpoint via `ITelegramBotService`. Used by the settings UI
 * so the user gets instant feedback when pasting a token from
 * @BotFather.
 *
 * Does not mutate any state — read-only check.
 */

import { injectable, inject } from 'tsyringe';
import type {
  ITelegramBotService,
  TelegramConnectionTestResult,
} from '../../ports/output/services/telegram-bot-service.interface.js';

export interface TestTelegramConnectionInput {
  readonly botToken: string;
}

@injectable()
export class TestTelegramConnectionUseCase {
  constructor(
    @inject('ITelegramBotService')
    private readonly telegramBot: ITelegramBotService
  ) {}

  async execute(input: TestTelegramConnectionInput): Promise<TelegramConnectionTestResult> {
    const token = input.botToken?.trim();
    if (!token) {
      return { ok: false, error: 'Bot token is required' };
    }
    return this.telegramBot.testConnection(token);
  }
}
