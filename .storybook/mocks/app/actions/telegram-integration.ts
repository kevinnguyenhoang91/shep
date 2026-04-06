import type {
  TestTelegramConnectionResult,
  TelegramBotLifecycleResult,
  SendTelegramTestMessageResult,
} from '../../../../src/presentation/web/app/actions/telegram-integration';

export async function testTelegramConnectionAction(
  botToken: string
): Promise<TestTelegramConnectionResult> {
  if (!botToken || botToken.trim().length === 0) {
    return { ok: false, error: 'Bot token is required' };
  }
  return { ok: true, botUsername: 'sheptestbot', botName: 'Shep Test Bot' };
}

export async function startTelegramBotAction(): Promise<TelegramBotLifecycleResult> {
  return { success: true, running: true };
}

export async function stopTelegramBotAction(): Promise<TelegramBotLifecycleResult> {
  return { success: true, running: false };
}

export async function sendTelegramTestMessageAction(): Promise<SendTelegramTestMessageResult> {
  return { sent: true };
}
