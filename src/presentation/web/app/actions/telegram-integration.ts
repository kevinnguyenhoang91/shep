'use server';

import { resolve } from '@/lib/server-container';
import type { TestTelegramConnectionUseCase } from '@shepai/core/application/use-cases/telegram/test-telegram-connection.use-case';
import type { StartTelegramBotUseCase } from '@shepai/core/application/use-cases/telegram/start-telegram-bot.use-case';
import type { StopTelegramBotUseCase } from '@shepai/core/application/use-cases/telegram/stop-telegram-bot.use-case';
import type { SendTelegramMessageUseCase } from '@shepai/core/application/use-cases/telegram/send-telegram-message.use-case';

export interface TestTelegramConnectionResult {
  ok: boolean;
  botUsername?: string;
  botName?: string;
  error?: string;
}

export async function testTelegramConnectionAction(
  botToken: string
): Promise<TestTelegramConnectionResult> {
  try {
    const useCase = resolve<TestTelegramConnectionUseCase>('TestTelegramConnectionUseCase');
    const result = await useCase.execute({ botToken });
    return {
      ok: result.ok,
      ...(result.botUsername !== undefined && { botUsername: result.botUsername }),
      ...(result.botName !== undefined && { botName: result.botName }),
      ...(result.error !== undefined && { error: result.error }),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface TelegramBotLifecycleResult {
  success: boolean;
  running: boolean;
  error?: string;
}

export async function startTelegramBotAction(): Promise<TelegramBotLifecycleResult> {
  try {
    const useCase = resolve<StartTelegramBotUseCase>('StartTelegramBotUseCase');
    const result = await useCase.execute();
    return { success: true, running: true, ...(result.alreadyRunning && { error: undefined }) };
  } catch (err) {
    return {
      success: false,
      running: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function stopTelegramBotAction(): Promise<TelegramBotLifecycleResult> {
  try {
    const useCase = resolve<StopTelegramBotUseCase>('StopTelegramBotUseCase');
    await useCase.execute();
    return { success: true, running: false };
  } catch (err) {
    return {
      success: false,
      running: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface SendTelegramTestMessageResult {
  sent: boolean;
  error?: string;
}

/**
 * Sends a short "Hello from Shep" test message to the authorized user —
 * useful right after onboarding to confirm the credentials are wired up.
 */
export async function sendTelegramTestMessageAction(
  text = '👋 Hello from Shep — Telegram integration is live.'
): Promise<SendTelegramTestMessageResult> {
  try {
    const useCase = resolve<SendTelegramMessageUseCase>('SendTelegramMessageUseCase');
    const result = await useCase.execute({ text });
    if (!result.sent) {
      return { sent: false, ...(result.reason !== undefined && { error: result.reason }) };
    }
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
