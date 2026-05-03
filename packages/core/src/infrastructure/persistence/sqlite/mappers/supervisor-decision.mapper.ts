/**
 * SupervisorDecision Database Mapper
 *
 * Maps between SupervisorDecision domain objects and SQLite rows for
 * the supervisor_decisions table. Append-only — no soft-delete.
 */

import type { SupervisorDecision, SupervisorVerdict } from '../../../../domain/generated/output.js';

export interface SupervisorDecisionRow {
  id: string;
  scope_type: string;
  scope_id: string | null;
  feature_id: string | null;
  supervisor_run_id: string;
  source_event_kind: string;
  source_event_id: string;
  verdict: string;
  rationale: string;
  model_id: string;
  prompt_version: string;
  rule_ref: string | null;
  confidence: number | null;
  created_at: number;
  updated_at: number;
}

function toMillis(value: SupervisorDecision['createdAt']): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  return 0;
}

export function toDatabase(decision: SupervisorDecision): SupervisorDecisionRow {
  return {
    id: decision.id,
    scope_type: decision.scopeType,
    scope_id: decision.scopeId ?? null,
    feature_id: decision.featureId ?? null,
    supervisor_run_id: decision.supervisorRunId,
    source_event_kind: decision.sourceEventKind,
    source_event_id: decision.sourceEventId,
    verdict: decision.verdict,
    rationale: decision.rationale,
    model_id: decision.modelId,
    prompt_version: decision.promptVersion,
    rule_ref: decision.ruleRef ?? null,
    confidence: decision.confidence ?? null,
    created_at: toMillis(decision.createdAt),
    updated_at: toMillis(decision.updatedAt),
  };
}

export function fromDatabase(row: SupervisorDecisionRow): SupervisorDecision {
  return {
    id: row.id,
    scopeType: row.scope_type,
    scopeId: row.scope_id ?? undefined,
    featureId: row.feature_id ?? undefined,
    supervisorRunId: row.supervisor_run_id,
    sourceEventKind: row.source_event_kind,
    sourceEventId: row.source_event_id,
    verdict: row.verdict as SupervisorVerdict,
    rationale: row.rationale,
    modelId: row.model_id,
    promptVersion: row.prompt_version,
    ruleRef: row.rule_ref ?? undefined,
    confidence: row.confidence ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  } as SupervisorDecision;
}
