/**
 * SQLite AgentMessage Repository (spec 093)
 *
 * Backed by the agent_messages table (migration 087). Every read is
 * scoped by app_id at the SQL layer for cross-app isolation (NFR-7).
 */

import type Database from 'better-sqlite3';
import { injectable } from 'tsyringe';
import type {
  AgentMessageListFilters,
  IAgentMessageRepository,
} from '../../application/ports/output/repositories/agent-message-repository.interface.js';
import type { AgentMessage } from '../../domain/generated/output.js';
import {
  toDatabase,
  fromDatabase,
  type AgentMessageRow,
} from '../persistence/sqlite/mappers/agent-message.mapper.js';

@injectable()
export class SQLiteAgentMessageRepository implements IAgentMessageRepository {
  constructor(private readonly db: Database.Database) {}

  async create(message: AgentMessage): Promise<void> {
    const row = toDatabase(message);
    const stmt = this.db.prepare(`
      INSERT INTO agent_messages (
        id, app_id, feature_id, from_agent_run_id, from_actor,
        to_target, to_kind, message_kind, payload,
        correlation_id, delivered_at, created_at, updated_at
      ) VALUES (
        @id, @app_id, @feature_id, @from_agent_run_id, @from_actor,
        @to_target, @to_kind, @message_kind, @payload,
        @correlation_id, @delivered_at, @created_at, @updated_at
      )
    `);
    stmt.run(row);
  }

  async findById(appId: string, id: string): Promise<AgentMessage | null> {
    const stmt = this.db.prepare('SELECT * FROM agent_messages WHERE id = ? AND app_id = ?');
    const row = stmt.get(id, appId) as AgentMessageRow | undefined;
    return row ? fromDatabase(row) : null;
  }

  async findByCorrelationId(appId: string, correlationId: string): Promise<AgentMessage | null> {
    const stmt = this.db.prepare(
      'SELECT * FROM agent_messages WHERE app_id = ? AND correlation_id = ? ORDER BY created_at ASC LIMIT 1'
    );
    const row = stmt.get(appId, correlationId) as AgentMessageRow | undefined;
    return row ? fromDatabase(row) : null;
  }

  async listByScope(
    appId: string,
    featureId: string | undefined,
    filters: AgentMessageListFilters = {}
  ): Promise<AgentMessage[]> {
    const conditions: string[] = ['app_id = ?'];
    const params: unknown[] = [appId];

    if (featureId !== undefined) {
      conditions.push('feature_id = ?');
      params.push(featureId);
    }
    if (filters.since) {
      conditions.push('created_at >= ?');
      params.push(filters.since.getTime());
    }
    if (filters.undeliveredOnly) {
      conditions.push('delivered_at IS NULL');
    }

    const limitClause = filters.limit !== undefined ? ' LIMIT ?' : '';
    if (filters.limit !== undefined) {
      params.push(filters.limit);
    }

    const sql = `SELECT * FROM agent_messages WHERE ${conditions.join(' AND ')} ORDER BY created_at ASC${limitClause}`;
    const rows = this.db.prepare(sql).all(...params) as AgentMessageRow[];
    return rows.map(fromDatabase);
  }

  async markDelivered(appId: string, id: string, deliveredAt: Date): Promise<void> {
    const now = Date.now();
    const stmt = this.db.prepare(
      'UPDATE agent_messages SET delivered_at = ?, updated_at = ? WHERE id = ? AND app_id = ? AND delivered_at IS NULL'
    );
    stmt.run(deliveredAt.getTime(), now, id, appId);
  }
}
