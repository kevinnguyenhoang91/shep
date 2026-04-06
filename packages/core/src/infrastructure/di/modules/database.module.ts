/**
 * Database module — Database initialization, connection setup, base registrations.
 */

import type { DependencyContainer } from 'tsyringe';
import type Database from 'better-sqlite3';
import { getSQLiteConnection } from '../../persistence/sqlite/connection.js';
import { runSQLiteMigrations } from '../../persistence/sqlite/migrations.js';

/**
 * Initialize the database connection, run migrations, and register the
 * Database instance token.  Returns the raw `Database` handle so that
 * downstream modules can use it when needed (e.g. DeploymentService).
 */
export async function registerDatabase(container: DependencyContainer): Promise<Database.Database> {
  const db = await getSQLiteConnection();
  await runSQLiteMigrations(db);
  container.registerInstance<Database.Database>('Database', db);
  return db;
}
