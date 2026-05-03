/**
 * SQLite AgentGraphOverride Repository (spec 093, FR-38 ext)
 *
 * Backed by the agent_graph_overrides table (migration 099).
 */

import type Database from 'better-sqlite3';
import { inject, injectable } from 'tsyringe';
import type { IAgentGraphOverrideRepository } from '../../application/ports/output/repositories/agent-graph-override-repository.interface.js';
import type { AgentGraphOverride } from '../../domain/generated/output.js';
import {
  toDatabase,
  fromDatabase,
  type AgentGraphOverrideRow,
} from '../persistence/sqlite/mappers/agent-graph-override.mapper.js';

@injectable()
export class SQLiteAgentGraphOverrideRepository implements IAgentGraphOverrideRepository {
  constructor(@inject('Database') private readonly db: Database.Database) {}

  async findActive(agentType: string): Promise<AgentGraphOverride | null> {
    const row = this.db
      .prepare('SELECT * FROM agent_graph_overrides WHERE agent_type = ? LIMIT 1')
      .get(agentType) as AgentGraphOverrideRow | undefined;
    return row ? fromDatabase(row) : null;
  }

  async listAll(): Promise<AgentGraphOverride[]> {
    const rows = this.db
      .prepare('SELECT * FROM agent_graph_overrides ORDER BY agent_type ASC')
      .all() as AgentGraphOverrideRow[];
    return rows.map(fromDatabase);
  }

  async create(override: AgentGraphOverride): Promise<void> {
    const row = toDatabase(override);
    this.db
      .prepare(
        `INSERT INTO agent_graph_overrides
         (id, agent_type, nodes_json, edges_json, version, created_by, created_at, updated_at)
         VALUES (@id, @agent_type, @nodes_json, @edges_json, @version, @created_by, @created_at, @updated_at)`
      )
      .run(row);
  }

  async update(override: AgentGraphOverride): Promise<void> {
    const row = toDatabase(override);
    this.db
      .prepare(
        `UPDATE agent_graph_overrides
            SET agent_type = @agent_type,
                nodes_json = @nodes_json,
                edges_json = @edges_json,
                version    = @version,
                created_by = @created_by,
                updated_at = @updated_at
          WHERE id = @id`
      )
      .run(row);
  }

  async delete(agentType: string): Promise<void> {
    this.db.prepare('DELETE FROM agent_graph_overrides WHERE agent_type = ?').run(agentType);
  }
}
