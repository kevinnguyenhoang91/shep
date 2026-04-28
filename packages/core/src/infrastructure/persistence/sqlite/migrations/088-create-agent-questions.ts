/**
 * Migration 088: Create agent_questions table (spec 093).
 *
 * Unified question/escalation surface that bridges the SDK V2
 * AskUserQuestion path and background-agent approval gates.
 *
 * Indexes:
 *  - (app_id, feature_id, status) for scoped inbox queries.
 *  - (agent_run_id) for run-scoped lookups.
 *  - (status, expires_at) drives the auto-expiry sweep efficiently.
 */

import type { MigrationParams } from 'umzug';
import type Database from 'better-sqlite3';

export async function up({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_questions'")
    .all() as { name: string }[];

  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE agent_questions (
        id              TEXT PRIMARY KEY,
        app_id          TEXT NOT NULL,
        feature_id      TEXT,
        agent_run_id    TEXT NOT NULL,
        kind            TEXT NOT NULL,
        prompt          TEXT NOT NULL,
        options_json    TEXT,
        default_answer  TEXT,
        answerer        TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'pending',
        answer          TEXT,
        answered_by     TEXT,
        answered_at     INTEGER,
        expires_at      INTEGER,
        created_at      INTEGER NOT NULL,
        updated_at      INTEGER NOT NULL
      )
    `);
  }

  const indexes = db.pragma('index_list(agent_questions)') as { name: string }[];
  const indexNames = new Set(indexes.map((i) => i.name));

  if (!indexNames.has('idx_agent_questions_scope_status')) {
    db.exec(
      'CREATE INDEX idx_agent_questions_scope_status ON agent_questions(app_id, feature_id, status)'
    );
  }

  if (!indexNames.has('idx_agent_questions_run_id')) {
    db.exec('CREATE INDEX idx_agent_questions_run_id ON agent_questions(agent_run_id)');
  }

  if (!indexNames.has('idx_agent_questions_expiry_sweep')) {
    db.exec('CREATE INDEX idx_agent_questions_expiry_sweep ON agent_questions(status, expires_at)');
  }
}

export async function down({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  db.exec('DROP TABLE IF EXISTS agent_questions');
}
