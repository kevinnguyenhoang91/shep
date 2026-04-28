/**
 * In-Memory SupervisorPolicy Repository
 *
 * Test-friendly adapter for {@link ISupervisorPolicyRepository}. Enforces
 * the unique-(appId, featureId) constraint and the feature-then-app
 * scope fallback documented in research decision 7.
 */

import { injectable } from 'tsyringe';
import type { ISupervisorPolicyRepository } from '@/application/ports/output/repositories/supervisor-policy-repository.interface.js';
import type { SupervisorPolicy } from '@/domain/generated/output.js';

function scopeKey(appId: string, featureId: string | null | undefined): string {
  return `${appId}::${featureId ?? ''}`;
}

@injectable()
export class InMemorySupervisorPolicyRepository implements ISupervisorPolicyRepository {
  private readonly policies = new Map<string, SupervisorPolicy>();

  async create(policy: SupervisorPolicy): Promise<void> {
    if (this.policies.has(policy.id)) {
      throw new Error(`SupervisorPolicy with id "${policy.id}" already exists`);
    }
    const key = scopeKey(policy.appId, policy.featureId ?? undefined);
    for (const existing of this.policies.values()) {
      if (scopeKey(existing.appId, existing.featureId ?? undefined) === key) {
        throw new Error(
          `SupervisorPolicy already exists for appId=${policy.appId}, featureId=${policy.featureId ?? '(null)'}`
        );
      }
    }
    this.policies.set(policy.id, { ...policy });
  }

  async update(policy: SupervisorPolicy): Promise<void> {
    if (!this.policies.has(policy.id)) {
      throw new Error(`SupervisorPolicy with id "${policy.id}" not found`);
    }
    this.policies.set(policy.id, { ...policy });
  }

  async delete(id: string): Promise<void> {
    this.policies.delete(id);
  }

  async findById(id: string): Promise<SupervisorPolicy | null> {
    const row = this.policies.get(id);
    return row ? { ...row } : null;
  }

  async findByApp(appId: string): Promise<SupervisorPolicy | null> {
    for (const row of this.policies.values()) {
      if (row.appId === appId && (row.featureId === undefined || row.featureId === null)) {
        return { ...row };
      }
    }
    return null;
  }

  async findByFeature(appId: string, featureId: string): Promise<SupervisorPolicy | null> {
    for (const row of this.policies.values()) {
      if (row.appId === appId && row.featureId === featureId) {
        return { ...row };
      }
    }
    return null;
  }

  async findPolicyForScope(
    appId: string,
    featureId: string | undefined
  ): Promise<SupervisorPolicy | null> {
    if (featureId !== undefined) {
      const featureRow = await this.findByFeature(appId, featureId);
      if (featureRow) return featureRow;
    }
    return this.findByApp(appId);
  }

  async listByApp(appId: string): Promise<SupervisorPolicy[]> {
    const result: SupervisorPolicy[] = [];
    for (const row of this.policies.values()) {
      if (row.appId === appId) result.push({ ...row });
    }
    return result;
  }
}
