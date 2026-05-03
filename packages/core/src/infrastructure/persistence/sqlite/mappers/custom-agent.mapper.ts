/**
 * CustomAgent Database Mapper
 *
 * Maps between CustomAgent domain objects and SQLite rows for the
 * custom_agents table (migration 100).
 */

import type { CustomAgent } from '../../../../domain/generated/output.js';

export interface CustomAgentRow {
  id: string;
  agent_type: string;
  name: string;
  description: string;
  created_by: string;
  created_at: number;
  updated_at: number;
}

function toMillis(value: CustomAgent['createdAt']): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  return 0;
}

export function toDatabase(agent: CustomAgent): CustomAgentRow {
  return {
    id: agent.id,
    agent_type: agent.agentType,
    name: agent.name,
    description: agent.description,
    created_by: agent.createdBy,
    created_at: toMillis(agent.createdAt),
    updated_at: toMillis(agent.updatedAt),
  };
}

export function fromDatabase(row: CustomAgentRow): CustomAgent {
  return {
    id: row.id,
    agentType: row.agent_type,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
