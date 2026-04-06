/**
 * @module Shep.Domain.Entities.TelegramIntegration
 *
 * Telegram bot integration configuration. When enabled, Shep runs a
 * Telegram bot that lets an authorized user interact with Shep from
 * their phone — listing features, checking status, and receiving
 * proactive notifications about agent lifecycle events.
 *
 * Inspired by Max (https://github.com/burkeholland/max), adapted for
 * Shep's Clean Architecture + Settings service.
 *
 * ## Security
 *
 * The `authorizedUserId` field is REQUIRED when `enabled` is true. It
 * is the numeric Telegram user ID of the single user allowed to send
 * messages to the bot. All other users are silently ignored. Users can
 * retrieve their Telegram user ID from @userinfobot.
 */
@doc("Telegram bot integration configuration")
model TelegramIntegrationConfig {
  /**
   * Whether the Telegram bot is enabled. When false the bot is not
   * started even if credentials are present.
   */
  @doc("Whether the Telegram bot is enabled (default: false)")
  enabled: boolean = false;

  /**
   * Telegram bot token from @BotFather. Stored in the Shep settings
   * database. Treat as a secret — anyone with this token can control
   * the bot.
   */
  @doc("Telegram bot token from @BotFather (optional until enabled)")
  botToken?: string;

  /**
   * Numeric Telegram user ID of the single user allowed to send
   * messages to the bot. Retrieved from @userinfobot. REQUIRED when
   * `enabled` is true.
   *
   * Stored as a string to avoid JSON/bigint interop hazards — Telegram
   * user IDs are displayed as decimal digits and Shep always parses
   * them back to a number at the bot lifecycle boundary.
   */
  @doc("Authorized Telegram user ID as a decimal string (optional until enabled)")
  authorizedUserId?: string;

  /**
   * Optional display label for the authorized user, shown in the
   * settings UI to help users identify which account is wired up.
   */
  @doc("Display label for the authorized user (optional)")
  authorizedUserLabel?: string;
}
