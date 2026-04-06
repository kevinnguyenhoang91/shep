/**
 * Telegram Bot Service (HTTP adapter)
 *
 * Implements `ITelegramBotService` by calling the Telegram Bot HTTP API
 * directly via `fetch`. No external dependency — Node 20+ has a built-in
 * global fetch, which keeps Shep's dependency graph small.
 *
 * This is the Shep equivalent of Max's `grammy`-backed `src/telegram/bot.ts`
 * (https://github.com/burkeholland/max), adapted to Clean Architecture:
 * nothing from the presentation, domain, or application layers leaks in,
 * and the service exposes a tiny port-shaped surface.
 *
 * Lifecycle:
 *   start() → enters a long-polling loop that calls Telegram's `getUpdates`
 *   endpoint. For each authorized incoming text message it invokes the
 *   handler and replies with whatever text it returns.
 *   stop()  → aborts the in-flight fetch and clears the running flag.
 */

import { injectable } from 'tsyringe';
import type {
  ITelegramBotService,
  TelegramBotStartOptions,
  TelegramConnectionTestResult,
  TelegramIncomingMessage,
  TelegramMessageHandler,
} from '../../../application/ports/output/services/telegram-bot-service.interface.js';

/**
 * Telegram's documented maximum message size in characters. Longer
 * replies are split across multiple messages.
 */
const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

/**
 * Long-polling timeout in seconds. Telegram holds the HTTP connection
 * open for this long if there are no updates, which keeps idle polling
 * cheap without firehose-polling the API.
 */
const LONG_POLL_TIMEOUT_SECONDS = 25;

/**
 * Maximum wait (ms) before retrying the long-poll loop after an error.
 * Exponential backoff starts at 1s and caps here.
 */
const MAX_BACKOFF_MS = 30_000;

interface TelegramUser {
  id: number;
  is_bot?: boolean;
  username?: string;
  first_name?: string;
}

interface TelegramChat {
  id: number;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

function telegramApiUrl(botToken: string, method: string): string {
  return `https://api.telegram.org/bot${encodeURIComponent(botToken)}/${method}`;
}

/**
 * Split a long message into chunks under Telegram's per-message limit.
 * Mirrors Max's `chunkMessage` — tries to split at newlines, then spaces,
 * and finally hard-cuts at the limit.
 */
export function chunkTelegramMessage(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_MESSAGE_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > TELEGRAM_MAX_MESSAGE_LENGTH) {
    let splitAt = remaining.lastIndexOf('\n', TELEGRAM_MAX_MESSAGE_LENGTH);
    if (splitAt < TELEGRAM_MAX_MESSAGE_LENGTH * 0.3) {
      splitAt = remaining.lastIndexOf(' ', TELEGRAM_MAX_MESSAGE_LENGTH);
    }
    if (splitAt < TELEGRAM_MAX_MESSAGE_LENGTH * 0.3) {
      splitAt = TELEGRAM_MAX_MESSAGE_LENGTH;
    }
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).replace(/^\s+/, '');
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

@injectable()
export class TelegramBotService implements ITelegramBotService {
  private running = false;
  private abortController: AbortController | null = null;
  private currentLoopPromise: Promise<void> | null = null;

  async testConnection(botToken: string): Promise<TelegramConnectionTestResult> {
    if (!botToken || botToken.trim().length === 0) {
      return { ok: false, error: 'Bot token is empty' };
    }

    try {
      const response = await fetch(telegramApiUrl(botToken, 'getMe'), {
        method: 'GET',
      });
      const json = (await response.json()) as TelegramResponse<TelegramUser>;

      if (!json.ok || !json.result) {
        return { ok: false, error: json.description ?? `HTTP ${response.status}` };
      }

      return {
        ok: true,
        botUsername: json.result.username,
        botName: json.result.first_name,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sendMessage(botToken: string, chatId: number, text: string): Promise<void> {
    if (!botToken) throw new Error('Telegram bot token is required');
    if (!text) return;

    const chunks = chunkTelegramMessage(text);
    for (const chunk of chunks) {
      const response = await fetch(telegramApiUrl(botToken, 'sendMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: chunk }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Telegram sendMessage failed (${response.status}): ${body}`);
      }
    }
  }

  async start(options: TelegramBotStartOptions): Promise<void> {
    if (this.running) {
      throw new Error('Telegram bot is already running');
    }
    if (!options.botToken) {
      throw new Error('Telegram bot token is required to start the bot');
    }
    if (!Number.isFinite(options.authorizedUserId)) {
      throw new Error('Telegram authorized user ID is required to start the bot');
    }

    this.running = true;
    this.abortController = new AbortController();

    // Run the long-polling loop detached. We keep a reference so stop()
    // can await it cleanly.
    this.currentLoopPromise = this.runPollingLoop(options).catch((err) => {
      // Swallow the abort error — that's the expected path out of stop().
      if (err instanceof Error && err.name === 'AbortError') return;
      // eslint-disable-next-line no-console
      console.error('[telegram] Polling loop crashed:', err);
    });
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    this.abortController?.abort();
    try {
      await this.currentLoopPromise;
    } finally {
      this.abortController = null;
      this.currentLoopPromise = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private async runPollingLoop(options: TelegramBotStartOptions): Promise<void> {
    let offset = 0;
    let backoffMs = 1000;

    while (this.running) {
      try {
        const updates = await this.fetchUpdates(options.botToken, offset);
        backoffMs = 1000; // reset on success

        for (const update of updates) {
          offset = Math.max(offset, update.update_id + 1);
          if (!this.running) return;
          await this.handleUpdate(
            update,
            options.botToken,
            options.authorizedUserId,
            options.handler
          );
        }
      } catch (err) {
        if (!this.running || (err instanceof Error && err.name === 'AbortError')) return;
        // eslint-disable-next-line no-console
        console.warn('[telegram] getUpdates failed, backing off:', err);
        await this.sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      }
    }
  }

  private async fetchUpdates(botToken: string, offset: number): Promise<TelegramUpdate[]> {
    const url = new URL(telegramApiUrl(botToken, 'getUpdates'));
    url.searchParams.set('timeout', String(LONG_POLL_TIMEOUT_SECONDS));
    url.searchParams.set('allowed_updates', JSON.stringify(['message']));
    if (offset > 0) url.searchParams.set('offset', String(offset));

    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: this.abortController?.signal,
    });
    const json = (await response.json()) as TelegramResponse<TelegramUpdate[]>;
    if (!json.ok) {
      throw new Error(json.description ?? `HTTP ${response.status}`);
    }
    return json.result ?? [];
  }

  private async handleUpdate(
    update: TelegramUpdate,
    botToken: string,
    authorizedUserId: number,
    handler: TelegramMessageHandler
  ): Promise<void> {
    const msg = update.message;
    if (!msg?.from || !msg.text) return;

    // Authorization: only respond to the single authorized user.
    if (msg.from.id !== authorizedUserId) return;

    const incoming: TelegramIncomingMessage = {
      chatId: msg.chat.id,
      userId: msg.from.id,
      ...(msg.from.username !== undefined && { username: msg.from.username }),
      text: msg.text,
    };

    try {
      const reply = await handler(incoming);
      if (reply !== null && reply.length > 0) {
        await this.sendMessage(botToken, msg.chat.id, reply);
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      await this.sendMessage(botToken, msg.chat.id, `⚠️ Shep error: ${text}`).catch(() => {
        /* best effort */
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.abortController?.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}
