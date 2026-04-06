/**
 * Migration 055: Add Telegram integration columns to the settings table.
 *
 * Adds four new columns backing the TelegramIntegrationConfig entity:
 *  - telegram_enabled (INTEGER DEFAULT 0): whether the Telegram bot is enabled
 *  - telegram_bot_token (TEXT NULL): bot token from @BotFather
 *  - telegram_authorized_user_id (TEXT NULL): authorized Telegram user ID
 *    (stored as TEXT since Telegram user IDs fit in int64 but SQLite INTEGER
 *    may be sign-extended on some platforms — TEXT keeps it lossless)
 *  - telegram_authorized_user_label (TEXT NULL): optional display label
 *
 * Defaults keep the integration disabled so existing installs are untouched.
 */

import type { MigrationParams } from 'umzug';
import type Database from 'better-sqlite3';

export async function up({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  const columns = db.pragma('table_info(settings)') as { name: string }[];
  const names = new Set(columns.map((c) => c.name));

  if (!names.has('telegram_enabled')) {
    db.exec('ALTER TABLE settings ADD COLUMN telegram_enabled INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('telegram_bot_token')) {
    db.exec('ALTER TABLE settings ADD COLUMN telegram_bot_token TEXT');
  }
  if (!names.has('telegram_authorized_user_id')) {
    db.exec('ALTER TABLE settings ADD COLUMN telegram_authorized_user_id TEXT');
  }
  if (!names.has('telegram_authorized_user_label')) {
    db.exec('ALTER TABLE settings ADD COLUMN telegram_authorized_user_label TEXT');
  }
}

export async function down({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  void db;
}
