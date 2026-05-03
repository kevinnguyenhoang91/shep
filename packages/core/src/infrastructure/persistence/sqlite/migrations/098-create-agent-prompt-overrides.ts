/**
 * Migration 098: Create agent_prompt_overrides table (spec 093, task-50).
 *
 * Per-(agentType, promptId) override of bundled prompt strings shipped
 * under packages/core/src/infrastructure/services/agents/<agent>/nodes/prompts/.
 *
 * The runtime prompt resolver (IAgentPromptResolver) consults this table
 * before falling back to the bundled string. Removing the row restores
 * byte-identical bundled behaviour (spec 093 NFR-16).
 *
 * Indexes:
 *  - unique (agent_type, prompt_id) — at most one active override per slot.
 *  - non-unique (agent_type) — list-by-agent lookups in the editor.
 */

import type { MigrationParams } from 'umzug';
import type Database from 'better-sqlite3';

export async function up({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_prompt_overrides'")
    .all() as { name: string }[];

  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE agent_prompt_overrides (
        id          TEXT PRIMARY KEY,
        agent_type  TEXT NOT NULL,
        prompt_id   TEXT NOT NULL,
        body        TEXT NOT NULL,
        version     INTEGER NOT NULL DEFAULT 1,
        created_by  TEXT NOT NULL,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      )
    `);
  }

  const indexes = db.pragma('index_list(agent_prompt_overrides)') as { name: string }[];
  const indexNames = new Set(indexes.map((i) => i.name));

  if (!indexNames.has('idx_agent_prompt_overrides_unique_slot')) {
    db.exec(
      'CREATE UNIQUE INDEX idx_agent_prompt_overrides_unique_slot ON agent_prompt_overrides(agent_type, prompt_id)'
    );
  }
  if (!indexNames.has('idx_agent_prompt_overrides_agent_type')) {
    db.exec(
      'CREATE INDEX idx_agent_prompt_overrides_agent_type ON agent_prompt_overrides(agent_type)'
    );
  }
}

export async function down({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  db.exec('DROP TABLE IF EXISTS agent_prompt_overrides');
}
