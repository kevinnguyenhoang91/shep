/**
 * Migration 100: Create custom_agents table (spec 093, FR-39 ext).
 *
 * Per-row user-created agent type. The runtime built-ins (`feature-agent`,
 * `supervisor-agent`) are NOT stored here — they live in code. This table
 * exists so the editor can list user-defined agents alongside built-ins
 * and let the user attach prompt/graph overrides to them.
 *
 * Indexes:
 *  - unique (agent_type) — one definition per stable identifier.
 */

import type { MigrationParams } from 'umzug';
import type Database from 'better-sqlite3';

export async function up({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='custom_agents'")
    .all() as { name: string }[];

  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE custom_agents (
        id          TEXT PRIMARY KEY,
        agent_type  TEXT NOT NULL,
        name        TEXT NOT NULL,
        description TEXT NOT NULL,
        created_by  TEXT NOT NULL,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      )
    `);
  }

  const indexes = db.pragma('index_list(custom_agents)') as { name: string }[];
  const indexNames = new Set(indexes.map((i) => i.name));
  if (!indexNames.has('idx_custom_agents_unique_type')) {
    db.exec('CREATE UNIQUE INDEX idx_custom_agents_unique_type ON custom_agents(agent_type)');
  }
}

export async function down({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  db.exec('DROP TABLE IF EXISTS custom_agents');
}
