/**
 * Pure helper: convert new {@link AgentMessage} rows into
 * {@link AgentMessageStreamEvent} entries for the SSE pipeline (spec 093,
 * research decision 2).
 *
 * Mirrors the existing computeFeatureDeltas / computePrDeltas / computeStatusDeltas
 * shape: caller owns the cache, helper is pure beyond mutating that cache,
 * never queries repositories. The cache tracks both a high-water mark
 * (`lastSeenAt`) AND a small `deliveredIds` set so we are robust to
 * duplicate ids returned within the same `since` cursor window (e.g. a
 * sub-millisecond burst of messages with identical createdAt timestamps).
 */

import type { AgentMessage } from '../../../../domain/generated/output.js';
import type { AgentMessageStreamEvent, StreamedAgentEvent } from './stream-agent-events.types.js';

/** Per-connection cached state for the agent-message stream. */
export interface CachedAgentMessageState {
  /** High-water mark — millis of the most-recent message we emitted. */
  lastSeenAt: number;
  /** Ids already emitted (bounded set; trimmed by the use case if needed). */
  deliveredIds: Set<string>;
}

export interface ComputeMessageDeltasArgs {
  /** Messages returned by IAgentMessageBus.listFor for the current scope. */
  messages: AgentMessage[];
  cache: CachedAgentMessageState;
}

function toMillis(value: AgentMessage['createdAt']): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  return 0;
}

function toIsoString(value: AgentMessage['createdAt']): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  return new Date(0).toISOString();
}

export function computeMessageDeltas(args: ComputeMessageDeltasArgs): StreamedAgentEvent[] {
  const { messages, cache } = args;
  const events: AgentMessageStreamEvent[] = [];

  for (const m of messages) {
    if (cache.deliveredIds.has(m.id)) continue;

    const createdMs = toMillis(m.createdAt);
    cache.deliveredIds.add(m.id);
    if (createdMs > cache.lastSeenAt) cache.lastSeenAt = createdMs;

    events.push({
      kind: 'agent_message',
      messageId: m.id,
      appId: m.appId,
      repositoryId: m.repositoryId,
      featureId: m.featureId,
      fromActor: m.fromActor,
      fromAgentRunId: m.fromAgentRunId,
      toTarget: m.toTarget,
      toKind: m.toKind,
      messageKind: m.messageKind,
      payload: m.payload,
      correlationId: m.correlationId,
      createdAt: toIsoString(m.createdAt),
    });
  }

  return events;
}
