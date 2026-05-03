/**
 * Migration 087-091 Integration Tests (spec 093 — agent collaboration & supervision).
 *
 * Verifies the four new tables (agent_messages, agent_questions,
 * supervisor_policies, supervisor_decisions) plus the
 * feature_flag_collaboration column on settings, with round-trip
 * (up → down → up) and idempotency for each.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  createInMemoryDatabase,
  getTableIndexes,
  tableExists,
} from '../../../../helpers/database.helper.js';
import { runSQLiteMigrations } from '@/infrastructure/persistence/sqlite/migrations.js';
import {
  up as up087,
  down as down087,
} from '@/infrastructure/persistence/sqlite/migrations/087-create-agent-messages.js';
import {
  up as up088,
  down as down088,
} from '@/infrastructure/persistence/sqlite/migrations/088-create-agent-questions.js';
import {
  up as up089,
  down as down089,
} from '@/infrastructure/persistence/sqlite/migrations/089-create-supervisor-policies.js';
import {
  up as up090,
  down as down090,
} from '@/infrastructure/persistence/sqlite/migrations/090-create-supervisor-decisions.js';
import { up as up091 } from '@/infrastructure/persistence/sqlite/migrations/091-add-feature-flag-collaboration.js';
import type { MigrationParams } from 'umzug';

function ctx(db: Database.Database): MigrationParams<Database.Database> {
  return { name: 'test', context: db, path: '' };
}

describe('Migration 087-091 — collaboration & supervision schema', () => {
  let db: Database.Database;

  beforeEach(async () => {
    db = createInMemoryDatabase();
    await runSQLiteMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('087 — agent_messages', () => {
    it('creates the table and indexes after full migration run', () => {
      expect(tableExists(db, 'agent_messages')).toBe(true);
      const indexes = getTableIndexes(db, 'agent_messages');
      expect(indexes).toContain('idx_agent_messages_scope_recency');
      expect(indexes).toContain('idx_agent_messages_correlation_id');
      expect(indexes).toContain('idx_agent_messages_undelivered');
    });

    it('supports up → down → up round-trip on a fresh DB', async () => {
      const fresh = createInMemoryDatabase();
      await up087(ctx(fresh));
      expect(tableExists(fresh, 'agent_messages')).toBe(true);
      await down087(ctx(fresh));
      expect(tableExists(fresh, 'agent_messages')).toBe(false);
      await up087(ctx(fresh));
      expect(tableExists(fresh, 'agent_messages')).toBe(true);
      fresh.close();
    });

    it('is idempotent — re-running up() is a no-op', async () => {
      await expect(up087(ctx(db))).resolves.not.toThrow();
      await expect(up087(ctx(db))).resolves.not.toThrow();
    });
  });

  describe('088 — agent_questions', () => {
    it('creates the table and indexes', () => {
      expect(tableExists(db, 'agent_questions')).toBe(true);
      const indexes = getTableIndexes(db, 'agent_questions');
      expect(indexes).toContain('idx_agent_questions_scope_status');
      expect(indexes).toContain('idx_agent_questions_run_id');
      expect(indexes).toContain('idx_agent_questions_expiry_sweep');
    });

    it('defaults status to pending', () => {
      const now = Date.now();
      db.prepare(
        `INSERT INTO agent_questions (id, app_id, agent_run_id, kind, prompt, answerer, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run('q1', 'app-1', 'run-1', 'blocking', 'do you confirm?', 'user', now, now);

      const row = db.prepare('SELECT status FROM agent_questions WHERE id = ?').get('q1') as {
        status: string;
      };
      expect(row.status).toBe('pending');
    });

    it('round-trips up → down → up', async () => {
      const fresh = createInMemoryDatabase();
      await up088(ctx(fresh));
      expect(tableExists(fresh, 'agent_questions')).toBe(true);
      await down088(ctx(fresh));
      expect(tableExists(fresh, 'agent_questions')).toBe(false);
      await up088(ctx(fresh));
      expect(tableExists(fresh, 'agent_questions')).toBe(true);
      fresh.close();
    });

    it('is idempotent', async () => {
      await expect(up088(ctx(db))).resolves.not.toThrow();
    });
  });

  describe('089 — supervisor_policies', () => {
    it('creates the table and unique scope index', () => {
      expect(tableExists(db, 'supervisor_policies')).toBe(true);
      const indexes = getTableIndexes(db, 'supervisor_policies');
      expect(indexes).toContain('idx_supervisor_policies_unique_scope');
      expect(indexes).toContain('idx_supervisor_policies_scope');
    });

    it('enforces unique (scope_type, scope_id, feature_id) including NULL feature_id', () => {
      const now = Date.now();
      db.prepare(
        `INSERT INTO supervisor_policies (id, scope_type, scope_id, feature_id, enabled, autonomy_level, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run('p1', 'app', 'app-1', null, 1, 'advisory', now, now);

      // Duplicate (scope_type, scope_id, NULL feature_id) must fail
      expect(() =>
        db
          .prepare(
            `INSERT INTO supervisor_policies (id, scope_type, scope_id, feature_id, enabled, autonomy_level, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run('p2', 'app', 'app-1', null, 1, 'advisory', now, now)
      ).toThrow();

      // Distinct feature_id is allowed for the same scope
      expect(() =>
        db
          .prepare(
            `INSERT INTO supervisor_policies (id, scope_type, scope_id, feature_id, enabled, autonomy_level, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run('p3', 'app', 'app-1', 'feat-1', 1, 'advisory', now, now)
      ).not.toThrow();
    });

    it('round-trips up → down → up', async () => {
      const fresh = createInMemoryDatabase();
      await up089(ctx(fresh));
      expect(tableExists(fresh, 'supervisor_policies')).toBe(true);
      await down089(ctx(fresh));
      expect(tableExists(fresh, 'supervisor_policies')).toBe(false);
      await up089(ctx(fresh));
      expect(tableExists(fresh, 'supervisor_policies')).toBe(true);
      fresh.close();
    });
  });

  describe('090 — supervisor_decisions', () => {
    it('creates the table and indexes', () => {
      expect(tableExists(db, 'supervisor_decisions')).toBe(true);
      const indexes = getTableIndexes(db, 'supervisor_decisions');
      expect(indexes).toContain('idx_supervisor_decisions_source');
      expect(indexes).toContain('idx_supervisor_decisions_run_id');
      expect(indexes).toContain('idx_supervisor_decisions_scope_recency');
    });

    it('round-trips up → down → up', async () => {
      const fresh = createInMemoryDatabase();
      await up090(ctx(fresh));
      expect(tableExists(fresh, 'supervisor_decisions')).toBe(true);
      await down090(ctx(fresh));
      expect(tableExists(fresh, 'supervisor_decisions')).toBe(false);
      await up090(ctx(fresh));
      expect(tableExists(fresh, 'supervisor_decisions')).toBe(true);
      fresh.close();
    });
  });

  describe('091 — feature_flag_collaboration column on settings', () => {
    it('adds the column with default 0', () => {
      const columns = db.prepare('PRAGMA table_info(settings)').all() as {
        name: string;
        notnull: number;
        dflt_value: string | null;
      }[];
      const col = columns.find((c) => c.name === 'feature_flag_collaboration');
      expect(col).toBeDefined();
      expect(col!.notnull).toBe(1);
      expect(col!.dflt_value).toBe('0');
    });

    it('is idempotent (running migration twice does not throw)', async () => {
      await expect(up091(ctx(db))).resolves.not.toThrow();
    });
  });
});
