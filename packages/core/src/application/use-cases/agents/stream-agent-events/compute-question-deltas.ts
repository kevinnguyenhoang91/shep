/**
 * Pure helper: convert new {@link AgentQuestion} rows and observed
 * status transitions into {@link AgentQuestionStreamEvent} entries for
 * the SSE pipeline (spec 093, task 18).
 *
 * Mirrors the existing computeMessageDeltas / computeFeatureDeltas
 * shape. The cache tracks two things per scope:
 *  - `lastSeenAt`: the most-recent createdAt we have already emitted
 *    for "new" rows (matches the messages helper exactly).
 *  - `lastStatus`: per-id snapshot of the most-recent status we
 *    emitted, so that a subsequent listFor() returning the same row
 *    with a new status (pending → answered, pending → cancelled, etc.)
 *    produces a status-transition event.
 *
 * Already-seen ids in the same status are NOT re-emitted.
 */

import type { AgentQuestion, AgentQuestionStatus } from '../../../../domain/generated/output.js';
import type { AgentQuestionStreamEvent, StreamedAgentEvent } from './stream-agent-events.types.js';

export interface CachedAgentQuestionState {
  /** High-water mark — millis of the most-recent question we emitted. */
  lastSeenAt: number;
  /** Last-known status per question id (used to detect transitions). */
  lastStatus: Map<string, AgentQuestionStatus>;
}

export interface ComputeQuestionDeltasArgs {
  /** Questions returned by IAgentQuestionRepository for the current scope. */
  questions: AgentQuestion[];
  cache: CachedAgentQuestionState;
}

function toMillis(value: AgentQuestion['createdAt']): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  return 0;
}

function toIsoStringOrUndefined(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  return undefined;
}

function toEventEnvelope(q: AgentQuestion, transition: 'new' | 'status'): AgentQuestionStreamEvent {
  return {
    kind: 'agent_question',
    questionId: q.id,
    appId: q.appId,
    repositoryId: q.repositoryId,
    featureId: q.featureId,
    agentRunId: q.agentRunId,
    questionKind: q.kind,
    answerer: q.answerer,
    status: q.status,
    prompt: q.prompt,
    optionsJson: q.optionsJson,
    answer: q.answer,
    answeredBy: q.answeredBy,
    answeredAt: toIsoStringOrUndefined(q.answeredAt),
    transition,
    createdAt: toIsoStringOrUndefined(q.createdAt) ?? new Date(0).toISOString(),
  };
}

export function computeQuestionDeltas(args: ComputeQuestionDeltasArgs): StreamedAgentEvent[] {
  const { questions, cache } = args;
  const events: AgentQuestionStreamEvent[] = [];

  for (const q of questions) {
    const previousStatus = cache.lastStatus.get(q.id);
    const createdMs = toMillis(q.createdAt);

    if (previousStatus === undefined) {
      // First sighting — emit and remember.
      cache.lastStatus.set(q.id, q.status);
      if (createdMs > cache.lastSeenAt) cache.lastSeenAt = createdMs;
      events.push(toEventEnvelope(q, 'new'));
      continue;
    }

    if (previousStatus !== q.status) {
      cache.lastStatus.set(q.id, q.status);
      events.push(toEventEnvelope(q, 'status'));
    }
  }

  return events;
}
