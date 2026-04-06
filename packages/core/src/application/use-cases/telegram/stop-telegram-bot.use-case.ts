/**
 * Stop Telegram Bot Use Case
 *
 * Stops the Telegram bot lifecycle. Idempotent — calling it when the
 * bot isn't running is a noop.
 */

import { injectable, inject } from 'tsyringe';
import type { ITelegramBotService } from '../../ports/output/services/telegram-bot-service.interface.js';

export interface StopTelegramBotResult {
  readonly stopped: boolean;
  readonly wasRunning: boolean;
}

@injectable()
export class StopTelegramBotUseCase {
  constructor(
    @inject('ITelegramBotService')
    private readonly telegramBot: ITelegramBotService
  ) {}

  async execute(): Promise<StopTelegramBotResult> {
    const wasRunning = this.telegramBot.isRunning();
    if (!wasRunning) {
      return { stopped: false, wasRunning: false };
    }
    await this.telegramBot.stop();
    return { stopped: true, wasRunning: true };
  }
}
