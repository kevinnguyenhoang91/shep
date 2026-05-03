/**
 * AgentGraphOverride Database Mapper
 *
 * Maps between AgentGraphOverride domain objects and SQLite rows for
 * the agent_graph_overrides table (migration 099).
 */

import type { AgentGraphOverride } from '../../../../domain/generated/output.js';

export interface AgentGraphOverrideRow {
  id: string;
  agent_type: string;
  nodes_json: string;
  edges_json: string;
  version: number;
  created_by: string;
  created_at: number;
  updated_at: number;
}

function toMillis(value: AgentGraphOverride['createdAt']): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  return 0;
}

export function toDatabase(override: AgentGraphOverride): AgentGraphOverrideRow {
  return {
    id: override.id,
    agent_type: override.agentType,
    nodes_json: override.nodesJson,
    edges_json: override.edgesJson,
    version: override.version,
    created_by: override.createdBy,
    created_at: toMillis(override.createdAt),
    updated_at: toMillis(override.updatedAt),
  };
}

export function fromDatabase(row: AgentGraphOverrideRow): AgentGraphOverride {
  return {
    id: row.id,
    agentType: row.agent_type,
    nodesJson: row.nodes_json,
    edgesJson: row.edges_json,
    version: row.version,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
