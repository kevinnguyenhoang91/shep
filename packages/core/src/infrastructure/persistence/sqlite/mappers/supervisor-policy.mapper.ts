/**
 * SupervisorPolicy Database Mapper
 *
 * Maps between SupervisorPolicy domain objects and SQLite rows for the
 * supervisor_policies table. Boolean stored as INTEGER 0/1.
 */

import type { SupervisorAutonomy, SupervisorPolicy } from '../../../../domain/generated/output.js';

export interface SupervisorPolicyRow {
  id: string;
  app_id: string;
  feature_id: string | null;
  enabled: number;
  autonomy_level: string;
  gate_authority_json: string | null;
  model_id: string | null;
  prompt_version: string | null;
  policy_rules_json: string | null;
  notification_overrides_json: string | null;
  created_at: number;
  updated_at: number;
}

function toMillis(value: SupervisorPolicy['createdAt']): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  return 0;
}

export function toDatabase(policy: SupervisorPolicy): SupervisorPolicyRow {
  return {
    id: policy.id,
    app_id: policy.appId,
    feature_id: policy.featureId ?? null,
    enabled: policy.enabled ? 1 : 0,
    autonomy_level: policy.autonomyLevel,
    gate_authority_json: policy.gateAuthorityJson ?? null,
    model_id: policy.modelId ?? null,
    prompt_version: policy.promptVersion ?? null,
    policy_rules_json: policy.policyRulesJson ?? null,
    notification_overrides_json: policy.notificationOverridesJson ?? null,
    created_at: toMillis(policy.createdAt),
    updated_at: toMillis(policy.updatedAt),
  };
}

export function fromDatabase(row: SupervisorPolicyRow): SupervisorPolicy {
  return {
    id: row.id,
    appId: row.app_id,
    featureId: row.feature_id ?? undefined,
    enabled: row.enabled === 1,
    autonomyLevel: row.autonomy_level as SupervisorAutonomy,
    gateAuthorityJson: row.gate_authority_json ?? undefined,
    modelId: row.model_id ?? undefined,
    promptVersion: row.prompt_version ?? undefined,
    policyRulesJson: row.policy_rules_json ?? undefined,
    notificationOverridesJson: row.notification_overrides_json ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  } as SupervisorPolicy;
}
