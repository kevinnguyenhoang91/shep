/**
 * Telegram Bot Service Port
 *
 * Output port for the Telegram bot integration. Adapters implement this
 * interface to interact with the Telegram Bot API. The application layer
 * only depends on this interface — no adapter concerns leak in.
 *
 * Based on the pattern used by Max (https://github.com/burkeholland/max),
 * adapted to Shep's Clean Architecture.
 */

/**
 * A plain description of an incoming Telegram message, shaped so the
 * application layer never needs to know about any specific bot library.
 */
export interface TelegramIncomingMessage {
  readonly chatId: number;
  readonly userId: number;
  readonly username?: string;
  readonly text: string;
}

/**
 * Handler invoked for every authorized incoming message while the bot is
 * running. Implementations should return the text to reply with, or `null`
 * to skip sending a reply.
 */
export type TelegramMessageHandler = (message: TelegramIncomingMessage) => Promise<string | null>;

/**
 * Result of verifying a Telegram bot token via the Telegram `getMe` API.
 */
export interface TelegramConnectionTestResult {
  readonly ok: boolean;
  readonly botUsername?: string;
  readonly botName?: string;
  readonly error?: string;
}

/**
 * Options passed when starting the Telegram bot lifecycle.
 */
export interface TelegramBotStartOptions {
  readonly botToken: string;
  readonly authorizedUserId: number;
  readonly handler: TelegramMessageHandler;
}

/**
 * Output port — implemented by infrastructure adapters (e.g. an HTTP
 * adapter calling the Telegram Bot API directly via fetch).
 */
export interface ITelegramBotService {
  /**
   * Verify a bot token by calling Telegram's `getMe` endpoint.
   * Does not require the bot to be started.
   */
  testConnection(botToken: string): Promise<TelegramConnectionTestResult>;

  /**
   * Send a one-shot message to the given chat ID using the given token.
   * Safe to call whether or not the bot lifecycle is currently running.
   */
  sendMessage(botToken: string, chatId: number, text: string): Promise<void>;

  /**
   * Start the bot lifecycle: long-poll for updates and dispatch authorized
   * messages to the handler. Throws if already running.
   */
  start(options: TelegramBotStartOptions): Promise<void>;

  /**
   * Stop the bot lifecycle. Safe to call when not running.
   */
  stop(): Promise<void>;

  /**
   * Whether the bot lifecycle is currently running.
   */
  isRunning(): boolean;
}
