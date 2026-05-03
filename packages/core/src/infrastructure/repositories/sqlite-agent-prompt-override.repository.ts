/**
 * SQLite AgentPromptOverride Repository (spec 093, FR-34)
 *
 * Backed by the agent_prompt_overrides table (migration 098).
 */

import type Database from 'better-sqlite3';
import { inject, injectable } from 'tsyringe';
import type { IAgentPromptOverrideRepository } from '../../application/ports/output/repositories/agent-prompt-override-repository.interface.js';
import type { AgentPromptOverride } from '../../domain/generated/output.js';
import {
  toDatabase,
  fromDatabase,
  type AgentPromptOverrideRow,
} from '../persistence/sqlite/mappers/agent-prompt-override.mapper.js';

@injectable()
export class SQLiteAgentPromptOverrideRepository implements IAgentPromptOverrideRepository {
  constructor(@inject('Database') private readonly db: Database.Database) {}

  async findActive(agentType: string, promptId: string): Promise<AgentPromptOverride | null> {
    const row = this.db
      .prepare(
        'SELECT * FROM agent_prompt_overrides WHERE agent_type = ? AND prompt_id = ? LIMIT 1'
      )
      .get(agentType, promptId) as AgentPromptOverrideRow | undefined;
    return row ? fromDatabase(row) : null;
  }

  async listForAgent(agentType: string): Promise<AgentPromptOverride[]> {
    const rows = this.db
      .prepare('SELECT * FROM agent_prompt_overrides WHERE agent_type = ? ORDER BY prompt_id ASC')
      .all(agentType) as AgentPromptOverrideRow[];
    return rows.map(fromDatabase);
  }

  async listAll(): Promise<AgentPromptOverride[]> {
    const rows = this.db
      .prepare('SELECT * FROM agent_prompt_overrides ORDER BY agent_type ASC, prompt_id ASC')
      .all() as AgentPromptOverrideRow[];
    return rows.map(fromDatabase);
  }

  async create(override: AgentPromptOverride): Promise<void> {
    const row = toDatabase(override);
    this.db
      .prepare(
        `INSERT INTO agent_prompt_overrides
         (id, agent_type, prompt_id, body, version, created_by, created_at, updated_at)
         VALUES (@id, @agent_type, @prompt_id, @body, @version, @created_by, @created_at, @updated_at)`
      )
      .run(row);
  }

  async update(override: AgentPromptOverride): Promise<void> {
    const row = toDatabase(override);
    this.db
      .prepare(
        `UPDATE agent_prompt_overrides
            SET agent_type = @agent_type,
                prompt_id  = @prompt_id,
                body       = @body,
                version    = @version,
                created_by = @created_by,
                updated_at = @updated_at
          WHERE id = @id`
      )
      .run(row);
  }

  async delete(agentType: string, promptId: string): Promise<void> {
    this.db
      .prepare('DELETE FROM agent_prompt_overrides WHERE agent_type = ? AND prompt_id = ?')
      .run(agentType, promptId);
  }
}
