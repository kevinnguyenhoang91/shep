/**
 * GetSupervisorPolicyUseCase — unit tests (spec 093, task 21).
 *
 * Verifies the feature → app fallback resolution from research
 * decision 7: feature-scoped row first, then the app-scoped row, else
 * null. Cross-app isolation is exercised explicitly.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';

import { GetSupervisorPolicyUseCase } from '@/application/use-cases/agents/get-supervisor-policy.use-case.js';
import { ConfigureSupervisorUseCase } from '@/application/use-cases/agents/configure-supervisor.use-case.js';
import { InMemorySupervisorPolicyRepository } from '@/infrastructure/adapters/in-memory/in-memory-supervisor-policy-repository.js';
import { SupervisorAutonomy, SupervisorScopeType } from '@/domain/generated/output.js';

describe('GetSupervisorPolicyUseCase', () => {
  let repo: InMemorySupervisorPolicyRepository;
  let configure: ConfigureSupervisorUseCase;
  let getPolicy: GetSupervisorPolicyUseCase;

  beforeEach(() => {
    repo = new InMemorySupervisorPolicyRepository();
    configure = new ConfigureSupervisorUseCase(repo);
    getPolicy = new GetSupervisorPolicyUseCase(repo);
  });

  it('returns null when no policy exists for the scope', async () => {
    const policy = await getPolicy.execute({ scopeType: 'app', scopeId: 'app-missing' });
    expect(policy).toBeNull();
  });

  it('returns the app-scoped policy when only an app row exists', async () => {
    const created = await configure.execute({
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      autonomyLevel: SupervisorAutonomy.advisory,
    });

    const policy = await getPolicy.execute({ scopeType: 'app', scopeId: 'app-1' });
    expect(policy?.id).toBe(created.id);
  });

  it('falls back to the app-scoped policy when no feature override exists', async () => {
    const appPolicy = await configure.execute({
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      autonomyLevel: SupervisorAutonomy.advisory,
    });

    const policy = await getPolicy.execute({
      scopeType: 'app',
      scopeId: 'app-1',
      featureId: 'feat-missing',
    });
    expect(policy?.id).toBe(appPolicy.id);
  });

  it('returns the feature-scoped override when one exists', async () => {
    await configure.execute({
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      autonomyLevel: SupervisorAutonomy.advisory,
    });
    const featurePolicy = await configure.execute({
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      featureId: 'feat-7',
      autonomyLevel: SupervisorAutonomy.cosign,
    });

    const policy = await getPolicy.execute({
      scopeType: 'app',
      scopeId: 'app-1',
      featureId: 'feat-7',
    });
    expect(policy?.id).toBe(featurePolicy.id);
    expect(policy?.autonomyLevel).toBe(SupervisorAutonomy.cosign);
  });

  it('returns null when the feature-scoped lookup is for an app with no rows', async () => {
    await configure.execute({
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      autonomyLevel: SupervisorAutonomy.advisory,
    });

    const policy = await getPolicy.execute({
      scopeType: 'app',
      scopeId: 'app-2',
      featureId: 'feat-7',
    });
    expect(policy).toBeNull();
  });

  it('throws when scopeType is missing (NFR-7 scope isolation)', async () => {
    await expect(getPolicy.execute({ scopeType: '' })).rejects.toThrow();
  });
});
