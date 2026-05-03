/**
 * SQLite SupervisorDecision Repository (spec 093)
 *
 * Backed by the supervisor_decisions table (migration 090).
 * Append-only — no `update`, no `delete`.
 */

import type Database from 'better-sqlite3';
import { injectable } from 'tsyringe';
import type {
  ISupervisorDecisionRepository,
  SupervisorDecisionListFilters,
} from '../../application/ports/output/repositories/supervisor-decision-repository.interface.js';
import type { SupervisorDecision } from '../../domain/generated/output.js';
import {
  toDatabase,
  fromDatabase,
  type SupervisorDecisionRow,
} from '../persistence/sqlite/mappers/supervisor-decision.mapper.js';

@injectable()
export class SQLiteSupervisorDecisionRepository implements ISupervisorDecisionRepository {
  constructor(private readonly db: Database.Database) {}

  async create(decision: SupervisorDecision): Promise<void> {
    const row = toDatabase(decision);
    const stmt = this.db.prepare(`
      INSERT INTO supervisor_decisions (
        id, scope_type, scope_id, feature_id, supervisor_run_id,
        source_event_kind, source_event_id, verdict, rationale,
        model_id, prompt_version, rule_ref, confidence,
        created_at, updated_at
      ) VALUES (
        @id, @scope_type, @scope_id, @feature_id, @supervisor_run_id,
        @source_event_kind, @source_event_id, @verdict, @rationale,
        @model_id, @prompt_version, @rule_ref, @confidence,
        @created_at, @updated_at
      )
    `);
    stmt.run(row);
  }

  async findById(id: string): Promise<SupervisorDecision | null> {
    const row = this.db.prepare('SELECT * FROM supervisor_decisions WHERE id = ?').get(id) as
      | SupervisorDecisionRow
      | undefined;
    return row ? fromDatabase(row) : null;
  }

  async listBySourceEvent(
    sourceEventKind: string,
    sourceEventId: string
  ): Promise<SupervisorDecision[]> {
    const rows = this.db
      .prepare(
        'SELECT * FROM supervisor_decisions WHERE source_event_kind = ? AND source_event_id = ? ORDER BY created_at ASC'
      )
      .all(sourceEventKind, sourceEventId) as SupervisorDecisionRow[];
    return rows.map(fromDatabase);
  }

  async listBySupervisorRun(supervisorRunId: string): Promise<SupervisorDecision[]> {
    const rows = this.db
      .prepare(
        'SELECT * FROM supervisor_decisions WHERE supervisor_run_id = ? ORDER BY created_at ASC'
      )
      .all(supervisorRunId) as SupervisorDecisionRow[];
    return rows.map(fromDatabase);
  }

  async listByScope(
    scopeType: string,
    scopeId: string | undefined,
    featureId: string | undefined,
    filters: SupervisorDecisionListFilters = {}
  ): Promise<SupervisorDecision[]> {
    const conditions: string[] = ['scope_type = ?', "COALESCE(scope_id, '') = COALESCE(?, '')"];
    const params: unknown[] = [scopeType, scopeId ?? null];

    if (featureId !== undefined) {
      conditions.push('feature_id = ?');
      params.push(featureId);
    }
    if (filters.since) {
      conditions.push('created_at >= ?');
      params.push(filters.since.getTime());
    }

    const limitClause = filters.limit !== undefined ? ' LIMIT ?' : '';
    if (filters.limit !== undefined) params.push(filters.limit);

    const sql = `SELECT * FROM supervisor_decisions WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC${limitClause}`;
    const rows = this.db.prepare(sql).all(...params) as SupervisorDecisionRow[];
    return rows.map(fromDatabase);
  }

  async listRecent(limit: number): Promise<SupervisorDecision[]> {
    const safeLimit = Math.max(0, Math.floor(limit));
    const rows = this.db
      .prepare('SELECT * FROM supervisor_decisions ORDER BY created_at DESC LIMIT ?')
      .all(safeLimit) as SupervisorDecisionRow[];
    return rows.map(fromDatabase);
  }
}
