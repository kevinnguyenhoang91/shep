/**
 * Migration 090: Create supervisor_decisions table (spec 093).
 *
 * Immutable audit record of every supervisor evaluation. Mirrored into
 * the append-only activity_log (migration 064) so trust can always be
 * reconstructed.
 *
 * Indexes:
 *  - (source_event_kind, source_event_id) for "find decisions for this gate".
 *  - (supervisor_run_id) for run-scoped lookups.
 *  - (scope_type, scope_id, feature_id, created_at) for scoped audit queries.
 */

import type { MigrationParams } from 'umzug';
import type Database from 'better-sqlite3';

export async function up({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='supervisor_decisions'")
    .all() as { name: string }[];

  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE supervisor_decisions (
        id                  TEXT PRIMARY KEY,
        scope_type          TEXT NOT NULL,
        scope_id            TEXT,
        feature_id          TEXT,
        supervisor_run_id   TEXT NOT NULL,
        source_event_kind   TEXT NOT NULL,
        source_event_id     TEXT NOT NULL,
        verdict             TEXT NOT NULL,
        rationale           TEXT NOT NULL,
        model_id            TEXT NOT NULL,
        prompt_version      TEXT NOT NULL,
        rule_ref            TEXT,
        confidence          REAL,
        created_at          INTEGER NOT NULL,
        updated_at          INTEGER NOT NULL
      )
    `);
  }

  const indexes = db.pragma('index_list(supervisor_decisions)') as { name: string }[];
  const indexNames = new Set(indexes.map((i) => i.name));

  if (!indexNames.has('idx_supervisor_decisions_source')) {
    db.exec(
      'CREATE INDEX idx_supervisor_decisions_source ON supervisor_decisions(source_event_kind, source_event_id)'
    );
  }

  if (!indexNames.has('idx_supervisor_decisions_run_id')) {
    db.exec(
      'CREATE INDEX idx_supervisor_decisions_run_id ON supervisor_decisions(supervisor_run_id)'
    );
  }

  if (!indexNames.has('idx_supervisor_decisions_scope_recency')) {
    db.exec(
      'CREATE INDEX idx_supervisor_decisions_scope_recency ON supervisor_decisions(scope_type, scope_id, feature_id, created_at)'
    );
  }
}

export async function down({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  db.exec('DROP TABLE IF EXISTS supervisor_decisions');
}
