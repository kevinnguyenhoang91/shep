/**
 * SQLite CustomAgent Repository (spec 093, FR-39 ext)
 *
 * Backed by the custom_agents table (migration 100).
 */

import type Database from 'better-sqlite3';
import { inject, injectable } from 'tsyringe';
import type { ICustomAgentRepository } from '../../application/ports/output/repositories/custom-agent-repository.interface.js';
import type { CustomAgent } from '../../domain/generated/output.js';
import {
  toDatabase,
  fromDatabase,
  type CustomAgentRow,
} from '../persistence/sqlite/mappers/custom-agent.mapper.js';

@injectable()
export class SQLiteCustomAgentRepository implements ICustomAgentRepository {
  constructor(@inject('Database') private readonly db: Database.Database) {}

  async findByType(agentType: string): Promise<CustomAgent | null> {
    const row = this.db
      .prepare('SELECT * FROM custom_agents WHERE agent_type = ? LIMIT 1')
      .get(agentType) as CustomAgentRow | undefined;
    return row ? fromDatabase(row) : null;
  }

  async listAll(): Promise<CustomAgent[]> {
    const rows = this.db
      .prepare('SELECT * FROM custom_agents ORDER BY agent_type ASC')
      .all() as CustomAgentRow[];
    return rows.map(fromDatabase);
  }

  async create(agent: CustomAgent): Promise<void> {
    const row = toDatabase(agent);
    this.db
      .prepare(
        `INSERT INTO custom_agents
         (id, agent_type, name, description, created_by, created_at, updated_at)
         VALUES (@id, @agent_type, @name, @description, @created_by, @created_at, @updated_at)`
      )
      .run(row);
  }

  async update(agent: CustomAgent): Promise<void> {
    const row = toDatabase(agent);
    this.db
      .prepare(
        `UPDATE custom_agents
            SET agent_type  = @agent_type,
                name        = @name,
                description = @description,
                created_by  = @created_by,
                updated_at  = @updated_at
          WHERE id = @id`
      )
      .run(row);
  }

  async delete(agentType: string): Promise<void> {
    this.db.prepare('DELETE FROM custom_agents WHERE agent_type = ?').run(agentType);
  }
}
