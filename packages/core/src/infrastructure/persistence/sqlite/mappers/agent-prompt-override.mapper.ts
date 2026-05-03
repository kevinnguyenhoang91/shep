/**
 * AgentPromptOverride Database Mapper
 *
 * Maps between AgentPromptOverride domain objects and SQLite rows for
 * the agent_prompt_overrides table (migration 098).
 */

import type { AgentPromptOverride } from '../../../../domain/generated/output.js';

export interface AgentPromptOverrideRow {
  id: string;
  agent_type: string;
  prompt_id: string;
  body: string;
  version: number;
  created_by: string;
  created_at: number;
  updated_at: number;
}

function toMillis(value: AgentPromptOverride['createdAt']): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  return 0;
}

export function toDatabase(override: AgentPromptOverride): AgentPromptOverrideRow {
  return {
    id: override.id,
    agent_type: override.agentType,
    prompt_id: override.promptId,
    body: override.body,
    version: override.version,
    created_by: override.createdBy,
    created_at: toMillis(override.createdAt),
    updated_at: toMillis(override.updatedAt),
  };
}

export function fromDatabase(row: AgentPromptOverrideRow): AgentPromptOverride {
  return {
    id: row.id,
    agentType: row.agent_type,
    promptId: row.prompt_id,
    body: row.body,
    version: row.version,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
