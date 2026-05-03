/**
 * ListSupervisorPoliciesUseCase
 *
 * Returns every persisted {@link SupervisorPolicy} grouped by scope kind
 * (global/app/repo/feature). Powers the top-level /supervisor dashboard
 * (FR-31). Read-only — no DB writes.
 *
 * Per-scope auth is still enforced by the underlying repository; this
 * use case is a flat read intended for the operator-facing dashboard,
 * not for cross-tenant data exfiltration. Callers MUST gate the route
 * on the same feature flag (`collaboration`) used elsewhere in this
 * spec to avoid accidentally exposing the surface (NFR-14).
 */

import { inject, injectable } from 'tsyringe';

import type { ISupervisorPolicyRepository } from '../../ports/output/repositories/supervisor-policy-repository.interface.js';
import type { SupervisorPolicy } from '../../../domain/generated/output.js';

export interface SupervisorPoliciesByScope {
  global: SupervisorPolicy[];
  app: SupervisorPolicy[];
  repo: SupervisorPolicy[];
  /** Per-feature overrides — every row with featureId set, regardless of parent scopeType. */
  feature: SupervisorPolicy[];
}

export interface ListSupervisorPoliciesOutput {
  policies: SupervisorPolicy[];
  byScope: SupervisorPoliciesByScope;
  total: number;
}

@injectable()
export class ListSupervisorPoliciesUseCase {
  constructor(
    @inject('ISupervisorPolicyRepository')
    private readonly policyRepository: ISupervisorPolicyRepository
  ) {}

  async execute(): Promise<ListSupervisorPoliciesOutput> {
    const policies = await this.policyRepository.listAll();

    const byScope: SupervisorPoliciesByScope = { global: [], app: [], repo: [], feature: [] };
    for (const policy of policies) {
      if (policy.featureId) {
        byScope.feature.push(policy);
        continue;
      }
      if (policy.scopeType === 'global') byScope.global.push(policy);
      else if (policy.scopeType === 'app') byScope.app.push(policy);
      else if (policy.scopeType === 'repo') byScope.repo.push(policy);
    }

    return { policies, byScope, total: policies.length };
  }
}
