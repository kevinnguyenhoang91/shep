/**
 * AgentMessage Database Mapper
 *
 * Maps between AgentMessage domain objects and SQLite rows for the
 * agent_messages table. Dates are stored as INTEGER unix milliseconds.
 */

import type { AgentMessage, AgentMessageKind } from '../../../../domain/generated/output.js';

export interface AgentMessageRow {
  id: string;
  app_id: string;
  feature_id: string | null;
  from_agent_run_id: string | null;
  from_actor: string;
  to_target: string;
  to_kind: string;
  message_kind: string;
  payload: string;
  correlation_id: string | null;
  delivered_at: number | null;
  created_at: number;
  updated_at: number;
}

function toMillis(value: AgentMessage['createdAt']): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  return 0;
}

export function toDatabase(message: AgentMessage): AgentMessageRow {
  return {
    id: message.id,
    app_id: message.appId ?? '',
    feature_id: message.featureId ?? null,
    from_agent_run_id: message.fromAgentRunId ?? null,
    from_actor: message.fromActor,
    to_target: message.toTarget,
    to_kind: message.toKind,
    message_kind: message.messageKind,
    payload: message.payload,
    correlation_id: message.correlationId ?? null,
    delivered_at: message.deliveredAt ? toMillis(message.deliveredAt) : null,
    created_at: toMillis(message.createdAt),
    updated_at: toMillis(message.updatedAt),
  };
}

export function fromDatabase(row: AgentMessageRow): AgentMessage {
  return {
    id: row.id,
    appId: row.app_id,
    featureId: row.feature_id ?? undefined,
    fromAgentRunId: row.from_agent_run_id ?? undefined,
    fromActor: row.from_actor,
    toTarget: row.to_target,
    toKind: row.to_kind,
    messageKind: row.message_kind as AgentMessageKind,
    payload: row.payload,
    correlationId: row.correlation_id ?? undefined,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  } as AgentMessage;
}
