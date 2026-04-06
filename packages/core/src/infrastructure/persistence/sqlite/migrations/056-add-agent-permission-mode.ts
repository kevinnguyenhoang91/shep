/**
 * Migration 056: Add agent_permission_mode column to the settings table.
 *
 * Adds a TEXT column for the per-agent permission mode:
 *  - agent_permission_mode (TEXT, nullable): 'default' | 'strict' | 'autonomous'
 *
 * NULL means no override (agent's default behavior).
 * Guards against duplicate column errors using table_info pragma.
 */

import type { MigrationParams } from 'umzug';
import type Database from 'better-sqlite3';

export async function up({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  const columns = db.pragma('table_info(settings)') as { name: string }[];
  const names = new Set(columns.map((c) => c.name));

  if (!names.has('agent_permission_mode')) {
    db.exec('ALTER TABLE settings ADD COLUMN agent_permission_mode TEXT');
  }
}

export async function down({ context: db }: MigrationParams<Database.Database>): Promise<void> {
  void db;
}
