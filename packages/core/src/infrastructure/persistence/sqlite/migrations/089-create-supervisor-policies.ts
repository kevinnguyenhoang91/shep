/**
 * Migration 089: Create supervisor_policies table (spec 093).
 *
 * Per-app (with optional per-feature override) supervisor policy.
 * Resolution order: feature-scoped first, fall back to app-scoped.
 *
 * Indexes:
 *  - unique (app_id, COALESCE(feature_id, '')) ensures at most one
 *    policy per scope tuple. SQLite expression indexes use COALESCE
 *    because NULL values are treated as distinct in regular UNIQUE
 *    indexes — we want NULL feature_id to collide with itself.
 */

import type { MigrationParams } from 'umzug';
import type Database from 'better-sqlite3';

export async function up({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='supervisor_policies'")
    .all() as { name: string }[];

  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE supervisor_policies (
        id                              TEXT PRIMARY KEY,
        app_id                          TEXT NOT NULL,
        feature_id                      TEXT,
        enabled                         INTEGER NOT NULL DEFAULT 0,
        autonomy_level                  TEXT NOT NULL DEFAULT 'advisory',
        gate_authority_json             TEXT,
        model_id                        TEXT,
        prompt_version                  TEXT,
        policy_rules_json               TEXT,
        notification_overrides_json     TEXT,
        created_at                      INTEGER NOT NULL,
        updated_at                      INTEGER NOT NULL
      )
    `);
  }

  const indexes = db.pragma('index_list(supervisor_policies)') as { name: string }[];
  const indexNames = new Set(indexes.map((i) => i.name));

  if (!indexNames.has('idx_supervisor_policies_unique_scope')) {
    db.exec(
      "CREATE UNIQUE INDEX idx_supervisor_policies_unique_scope ON supervisor_policies(app_id, COALESCE(feature_id, ''))"
    );
  }

  if (!indexNames.has('idx_supervisor_policies_app_id')) {
    db.exec('CREATE INDEX idx_supervisor_policies_app_id ON supervisor_policies(app_id)');
  }
}

export async function down({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  db.exec('DROP TABLE IF EXISTS supervisor_policies');
}
