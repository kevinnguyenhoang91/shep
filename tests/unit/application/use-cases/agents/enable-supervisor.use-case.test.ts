/**
 * EnableSupervisorUseCase — unit tests (spec 093, task 21).
 *
 * Verifies that flipping the `enabled` flag preserves every other field
 * on the policy and bumps `updatedAt`. Also verifies the typed
 * not-found error.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';

import { EnableSupervisorUseCase } from '@/application/use-cases/agents/enable-supervisor.use-case.js';
import { ConfigureSupervisorUseCase } from '@/application/use-cases/agents/configure-supervisor.use-case.js';
import { InMemorySupervisorPolicyRepository } from '@/infrastructure/adapters/in-memory/in-memory-supervisor-policy-repository.js';
import { SupervisorAutonomy, SupervisorScopeType } from '@/domain/generated/output.js';
import { SupervisorPolicyNotFoundError } from '@/domain/errors/supervisor-policy-not-found.error.js';

describe('EnableSupervisorUseCase', () => {
  let repo: InMemorySupervisorPolicyRepository;
  let configure: ConfigureSupervisorUseCase;
  let enable: EnableSupervisorUseCase;

  beforeEach(() => {
    repo = new InMemorySupervisorPolicyRepository();
    configure = new ConfigureSupervisorUseCase(repo);
    enable = new EnableSupervisorUseCase(repo);
  });

  it('flips enabled=false → true and preserves other fields', async () => {
    const initial = await configure.execute({
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      autonomyLevel: SupervisorAutonomy.cosign,
      modelId: 'claude-opus-4',
    });
    // Disable through repo so we can test enable.
    await repo.update({ ...initial, enabled: false });

    await new Promise((r) => setTimeout(r, 5));

    const result = await enable.execute({ scopeType: 'app', scopeId: 'app-1' });

    expect(result.enabled).toBe(true);
    expect(result.autonomyLevel).toBe(SupervisorAutonomy.cosign);
    expect(result.modelId).toBe('claude-opus-4');
    expect(result.id).toBe(initial.id);
    expect(result.updatedAt.getTime()).toBeGreaterThan(initial.updatedAt.getTime());
  });

  it('is idempotent when the policy is already enabled', async () => {
    const initial = await configure.execute({
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      autonomyLevel: SupervisorAutonomy.advisory,
    });
    expect(initial.enabled).toBe(true);

    const result = await enable.execute({ scopeType: 'app', scopeId: 'app-1' });

    expect(result.enabled).toBe(true);
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
    await repo.update({ ...featurePolicy, enabled: false });

    const result = await enable.execute({
      scopeType: 'app',
      scopeId: 'app-1',
      featureId: 'feat-7',
    });

    expect(result.id).toBe(featurePolicy.id);
    expect(result.enabled).toBe(true);

    const appPolicy = await repo.findByScope('app', 'app-1');
    expect(appPolicy?.enabled).toBe(true); // untouched
  });

  it('throws SupervisorPolicyNotFoundError when no policy exists for the scope', async () => {
    await expect(enable.execute({ scopeType: 'app', scopeId: 'missing' })).rejects.toBeInstanceOf(
      SupervisorPolicyNotFoundError
    );
  });
});
