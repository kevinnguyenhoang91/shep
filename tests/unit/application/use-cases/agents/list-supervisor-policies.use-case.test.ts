/**
 * ListSupervisorPoliciesUseCase — unit tests (spec 093, task 48).
 *
 * Verifies that listAll() output is grouped correctly into the four
 * dashboard buckets (global / app / repo / feature-override).
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';

import { ListSupervisorPoliciesUseCase } from '@/application/use-cases/agents/list-supervisor-policies.use-case.js';
import { ConfigureSupervisorUseCase } from '@/application/use-cases/agents/configure-supervisor.use-case.js';
import { InMemorySupervisorPolicyRepository } from '@/infrastructure/adapters/in-memory/in-memory-supervisor-policy-repository.js';
import { SupervisorAutonomy, SupervisorScopeType } from '@/domain/generated/output.js';

describe('ListSupervisorPoliciesUseCase', () => {
  let repo: InMemorySupervisorPolicyRepository;
  let configure: ConfigureSupervisorUseCase;
  let listPolicies: ListSupervisorPoliciesUseCase;

  beforeEach(() => {
    repo = new InMemorySupervisorPolicyRepository();
    configure = new ConfigureSupervisorUseCase(repo);
    listPolicies = new ListSupervisorPoliciesUseCase(repo);
  });

  it('returns empty buckets when no policies are configured', async () => {
    const result = await listPolicies.execute();
    expect(result.total).toBe(0);
    expect(result.policies).toEqual([]);
    expect(result.byScope).toEqual({ global: [], app: [], repo: [], feature: [] });
  });

  it('groups policies into the right scope buckets', async () => {
    await configure.execute({
      scopeType: SupervisorScopeType.global,
      autonomyLevel: SupervisorAutonomy.advisory,
    });
    await configure.execute({
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      autonomyLevel: SupervisorAutonomy.cosign,
    });
    await configure.execute({
      scopeType: SupervisorScopeType.repo,
      scopeId: 'repo-1',
      autonomyLevel: SupervisorAutonomy.advisory,
    });
    await configure.execute({
      scopeType: SupervisorScopeType.repo,
      scopeId: 'repo-1',
      featureId: 'feat-9',
      autonomyLevel: SupervisorAutonomy.autonomous,
    });

    const result = await listPolicies.execute();
    expect(result.total).toBe(4);
    expect(result.byScope.global).toHaveLength(1);
    expect(result.byScope.app).toHaveLength(1);
    expect(result.byScope.repo).toHaveLength(1);
    expect(result.byScope.feature).toHaveLength(1);
    expect(result.byScope.feature[0]?.featureId).toBe('feat-9');
  });

  it('puts every policy with featureId into the feature bucket regardless of parent scope kind', async () => {
    await configure.execute({
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      featureId: 'feat-app-override',
      autonomyLevel: SupervisorAutonomy.advisory,
    });
    await configure.execute({
      scopeType: SupervisorScopeType.repo,
      scopeId: 'repo-1',
      featureId: 'feat-repo-override',
      autonomyLevel: SupervisorAutonomy.advisory,
    });

    const result = await listPolicies.execute();
    expect(result.byScope.feature.map((p) => p.featureId).sort()).toEqual([
      'feat-app-override',
      'feat-repo-override',
    ]);
    expect(result.byScope.app).toHaveLength(0);
    expect(result.byScope.repo).toHaveLength(0);
  });
});
