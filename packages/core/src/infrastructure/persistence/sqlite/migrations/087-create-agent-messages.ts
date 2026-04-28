/**
 * Migration 087: Create agent_messages table (spec 093).
 *
 * Persists every inter-agent / agent↔user / agent↔supervisor message on
 * the SQLite-backed message bus. Cross-process delivery is provided by
 * the shared SQLite database (WAL mode) — subscribers poll on the
 * established SSE cadence.
 *
 * Indexes (per research.yaml decision 2):
 *  - composite (app_id, feature_id, created_at) for scope + recency
 *    subscriber polling.
 *  - correlation_id for O(1) request/reply pairing.
 *  - partial undelivered (delivered_at IS NULL) keeps queue polling flat
 *    as history grows.
 */

import type { MigrationParams } from 'umzug';
import type Database from 'better-sqlite3';

export async function up({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_messages'")
    .all() as { name: string }[];

  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE agent_messages (
        id                  TEXT PRIMARY KEY,
        app_id              TEXT NOT NULL,
        feature_id          TEXT,
        from_agent_run_id   TEXT,
        from_actor          TEXT NOT NULL,
        to_target           TEXT NOT NULL,
        to_kind             TEXT NOT NULL,
        message_kind        TEXT NOT NULL,
        payload             TEXT NOT NULL,
        correlation_id      TEXT,
        delivered_at        INTEGER,
        created_at          INTEGER NOT NULL,
        updated_at          INTEGER NOT NULL
      )
    `);
  }

  const indexes = db.pragma('index_list(agent_messages)') as { name: string }[];
  const indexNames = new Set(indexes.map((i) => i.name));

  if (!indexNames.has('idx_agent_messages_scope_recency')) {
    db.exec(
      'CREATE INDEX idx_agent_messages_scope_recency ON agent_messages(app_id, feature_id, created_at)'
    );
  }

  if (!indexNames.has('idx_agent_messages_correlation_id')) {
    db.exec('CREATE INDEX idx_agent_messages_correlation_id ON agent_messages(correlation_id)');
  }

  if (!indexNames.has('idx_agent_messages_undelivered')) {
    db.exec(
      'CREATE INDEX idx_agent_messages_undelivered ON agent_messages(app_id, feature_id, created_at) WHERE delivered_at IS NULL'
    );
  }
}

export async function down({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  db.exec('DROP TABLE IF EXISTS agent_messages');
}
