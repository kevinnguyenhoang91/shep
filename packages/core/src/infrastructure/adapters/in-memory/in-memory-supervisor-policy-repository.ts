/**
 * In-Memory SupervisorPolicy Repository
 *
 * Test-friendly adapter for {@link ISupervisorPolicyRepository}. Enforces
 * the unique-(scopeType, scopeId, featureId) constraint and the
 * feature-then-scope fallback documented in research decision 7.
 */

import { injectable } from 'tsyringe';
import type { ISupervisorPolicyRepository } from '@/application/ports/output/repositories/supervisor-policy-repository.interface.js';
import type { SupervisorPolicy } from '@/domain/generated/output.js';

function scopeKey(
  scopeType: string,
  scopeId: string | null | undefined,
  featureId: string | null | undefined
): string {
  return `${scopeType}::${scopeId ?? ''}::${featureId ?? ''}`;
}

function scopeMatches(
  row: SupervisorPolicy,
  scopeType: string,
  scopeId: string | null | undefined
): boolean {
  return row.scopeType === scopeType && (row.scopeId ?? undefined) === (scopeId ?? undefined);
}

@injectable()
export class InMemorySupervisorPolicyRepository implements ISupervisorPolicyRepository {
  private readonly policies = new Map<string, SupervisorPolicy>();

  async create(policy: SupervisorPolicy): Promise<void> {
    if (this.policies.has(policy.id)) {
      throw new Error(`SupervisorPolicy with id "${policy.id}" already exists`);
    }
    const key = scopeKey(policy.scopeType, policy.scopeId, policy.featureId ?? undefined);
    for (const existing of this.policies.values()) {
      if (scopeKey(existing.scopeType, existing.scopeId, existing.featureId ?? undefined) === key) {
        throw new Error(
          `SupervisorPolicy already exists for scopeType=${policy.scopeType}, scopeId=${policy.scopeId ?? '(null)'}, featureId=${policy.featureId ?? '(null)'}`
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

  async findByScope(scopeType: string, scopeId?: string): Promise<SupervisorPolicy | null> {
    for (const row of this.policies.values()) {
      if (
        scopeMatches(row, scopeType, scopeId) &&
        (row.featureId === undefined || row.featureId === null)
      ) {
        return { ...row };
      }
    }
    return null;
  }

  async findByScopeAndFeature(
    scopeType: string,
    scopeId: string | undefined,
    featureId: string
  ): Promise<SupervisorPolicy | null> {
    for (const row of this.policies.values()) {
      if (scopeMatches(row, scopeType, scopeId) && row.featureId === featureId) {
        return { ...row };
      }
    }
    return null;
  }

  async findPolicyForScope(
    scopeType: string,
    scopeId: string | undefined,
    featureId: string | undefined
  ): Promise<SupervisorPolicy | null> {
    if (featureId !== undefined) {
      const featureRow = await this.findByScopeAndFeature(scopeType, scopeId, featureId);
      if (featureRow) return featureRow;
    }
    return this.findByScope(scopeType, scopeId);
  }

  async listByScope(scopeType: string, scopeId?: string): Promise<SupervisorPolicy[]> {
    const result: SupervisorPolicy[] = [];
    for (const row of this.policies.values()) {
      if (scopeMatches(row, scopeType, scopeId)) result.push({ ...row });
    }
    return result;
  }

  async listAll(): Promise<SupervisorPolicy[]> {
    return [...this.policies.values()]
      .map((row) => ({ ...row }))
      .sort((a, b) => {
        if (a.scopeType !== b.scopeType) return a.scopeType.localeCompare(b.scopeType);
        const idCompare = (a.scopeId ?? '').localeCompare(b.scopeId ?? '');
        if (idCompare !== 0) return idCompare;
        return (a.featureId ?? '').localeCompare(b.featureId ?? '');
      });
  }
}
