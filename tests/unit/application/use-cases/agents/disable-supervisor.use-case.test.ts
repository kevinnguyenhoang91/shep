/**
 * DisableSupervisorUseCase — unit tests (spec 093, task 21).
 *
 * Verifies that flipping the `enabled` flag preserves every other field
 * on the policy and bumps `updatedAt`. Also verifies the typed
 * not-found error.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';

import { DisableSupervisorUseCase } from '@/application/use-cases/agents/disable-supervisor.use-case.js';
import { ConfigureSupervisorUseCase } from '@/application/use-cases/agents/configure-supervisor.use-case.js';
import { InMemorySupervisorPolicyRepository } from '@/infrastructure/adapters/in-memory/in-memory-supervisor-policy-repository.js';
import { SupervisorAutonomy, SupervisorScopeType } from '@/domain/generated/output.js';
import { SupervisorPolicyNotFoundError } from '@/domain/errors/supervisor-policy-not-found.error.js';

describe('DisableSupervisorUseCase', () => {
  let repo: InMemorySupervisorPolicyRepository;
  let configure: ConfigureSupervisorUseCase;
  let disable: DisableSupervisorUseCase;

  beforeEach(() => {
    repo = new InMemorySupervisorPolicyRepository();
    configure = new ConfigureSupervisorUseCase(repo);
    disable = new DisableSupervisorUseCase(repo);
  });

  it('flips enabled=true → false and preserves other fields', async () => {
    const initial = await configure.execute({
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      autonomyLevel: SupervisorAutonomy.cosign,
      modelId: 'claude-opus-4',
    });

    await new Promise((r) => setTimeout(r, 5));

    const result = await disable.execute({ scopeType: 'app', scopeId: 'app-1' });

    expect(result.enabled).toBe(false);
    expect(result.autonomyLevel).toBe(SupervisorAutonomy.cosign);
    expect(result.modelId).toBe('claude-opus-4');
    expect(result.id).toBe(initial.id);
    expect(result.updatedAt.getTime()).toBeGreaterThan(initial.updatedAt.getTime());
  });

  it('is idempotent when the policy is already disabled', async () => {
    const initial = await configure.execute({
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      autonomyLevel: SupervisorAutonomy.advisory,
    });
    await disable.execute({ scopeType: 'app', scopeId: 'app-1' });

    const result = await disable.execute({ scopeType: 'app', scopeId: 'app-1' });

    expect(result.enabled).toBe(false);
    expect(result.id).toBe(initial.id);
  });

  it('targets the feature-scoped policy when featureId is provided', async () => {
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

    const result = await disable.execute({
      scopeType: 'app',
      scopeId: 'app-1',
      featureId: 'feat-7',
    });

    expect(result.id).toBe(featurePolicy.id);
    expect(result.enabled).toBe(false);

    const appPolicy = await repo.findByScope('app', 'app-1');
    expect(appPolicy?.enabled).toBe(true); // untouched
  });

  it('throws SupervisorPolicyNotFoundError when no policy exists for the scope', async () => {
    await expect(disable.execute({ scopeType: 'app', scopeId: 'missing' })).rejects.toBeInstanceOf(
      SupervisorPolicyNotFoundError
    );
  });
});
