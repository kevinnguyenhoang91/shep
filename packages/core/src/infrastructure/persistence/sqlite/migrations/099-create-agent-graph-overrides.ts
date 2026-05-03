/**
 * Migration 099: Create agent_graph_overrides table (spec 093, FR-38 ext).
 *
 * Per-agent override of the bundled LangGraph descriptor. Mirrors the shape
 * of agent_prompt_overrides (migration 098) — one row per agentType, atomic
 * replace on upsert, delete restores byte-identical bundled behaviour.
 *
 * Indexes:
 *  - unique (agent_type) — at most one active override per agent.
 */

import type { MigrationParams } from 'umzug';
import type Database from 'better-sqlite3';

export async function up({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_graph_overrides'")
    .all() as { name: string }[];

  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE agent_graph_overrides (
        id          TEXT PRIMARY KEY,
        agent_type  TEXT NOT NULL,
        nodes_json  TEXT NOT NULL,
        edges_json  TEXT NOT NULL,
        version     INTEGER NOT NULL DEFAULT 1,
        created_by  TEXT NOT NULL,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      )
    `);
  }

  const indexes = db.pragma('index_list(agent_graph_overrides)') as { name: string }[];
  const indexNames = new Set(indexes.map((i) => i.name));

  if (!indexNames.has('idx_agent_graph_overrides_unique_agent')) {
    db.exec(
      'CREATE UNIQUE INDEX idx_agent_graph_overrides_unique_agent ON agent_graph_overrides(agent_type)'
    );
  }
}

export async function down({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  db.exec('DROP TABLE IF EXISTS agent_graph_overrides');
}
