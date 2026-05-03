/**
 * ConfigureSupervisorUseCase — unit tests (spec 093, task 21).
 *
 * Verifies create + update round-trip, scope key uniqueness, and
 * validation rejections for the autonomy enum, gate-authority map,
 * and policy-rules array.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';

import { ConfigureSupervisorUseCase } from '@/application/use-cases/agents/configure-supervisor.use-case.js';
import { InMemorySupervisorPolicyRepository } from '@/infrastructure/adapters/in-memory/in-memory-supervisor-policy-repository.js';
import { SupervisorAutonomy, SupervisorScopeType } from '@/domain/generated/output.js';
import { InvalidSupervisorPolicyError } from '@/domain/errors/invalid-supervisor-policy.error.js';

describe('ConfigureSupervisorUseCase', () => {
  let repo: InMemorySupervisorPolicyRepository;
  let useCase: ConfigureSupervisorUseCase;

  beforeEach(() => {
    repo = new InMemorySupervisorPolicyRepository();
    useCase = new ConfigureSupervisorUseCase(repo);
  });

  it('creates a new scope-level policy with sensible defaults', async () => {
    const policy = await useCase.execute({
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      autonomyLevel: SupervisorAutonomy.advisory,
    });

    expect(policy.id).toBeDefined();
    expect(policy.scopeType).toBe(SupervisorScopeType.app);
    expect(policy.scopeId).toBe('app-1');
    expect(policy.featureId).toBeUndefined();
    expect(policy.enabled).toBe(true);
    expect(policy.autonomyLevel).toBe(SupervisorAutonomy.advisory);
    expect(policy.createdAt).toBeInstanceOf(Date);
    expect(policy.updatedAt).toBeInstanceOf(Date);

    const stored = await repo.findByScope('app', 'app-1');
    expect(stored?.id).toBe(policy.id);
  });

  it('creates a feature-scoped override when featureId is provided', async () => {
    const policy = await useCase.execute({
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      featureId: 'feat-7',
      autonomyLevel: SupervisorAutonomy.cosign,
    });

    expect(policy.featureId).toBe('feat-7');
    const stored = await repo.findByScopeAndFeature('app', 'app-1', 'feat-7');
    expect(stored?.id).toBe(policy.id);
  });

  it('updates the existing policy in place when one already exists for the scope', async () => {
    const first = await useCase.execute({
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      autonomyLevel: SupervisorAutonomy.advisory,
    });

    // Wait long enough that updatedAt is strictly greater.
    await new Promise((r) => setTimeout(r, 5));

    const second = await useCase.execute({
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      autonomyLevel: SupervisorAutonomy.autonomous,
      modelId: 'claude-opus-4',
      promptVersion: 'v3',
    });

    expect(second.id).toBe(first.id);
    expect(second.autonomyLevel).toBe(SupervisorAutonomy.autonomous);
    expect(second.modelId).toBe('claude-opus-4');
    expect(second.promptVersion).toBe('v3');
    expect(second.updatedAt.getTime()).toBeGreaterThan(first.updatedAt.getTime());

    expect(await repo.listByScope('app', 'app-1')).toHaveLength(1);
  });

  it('persists structured gateAuthority and policyRules as JSON', async () => {
    const policy = await useCase.execute({
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      autonomyLevel: SupervisorAutonomy.advisory,
      gateAuthority: { prd: SupervisorAutonomy.advisory, merge: SupervisorAutonomy.autonomous },
      policyRules: [{ ruleId: 'r1', condition: 'hasTests', action: 'approve' }],
      notificationOverrides: { agentQuestionBlocking: false },
    });

    expect(policy.gateAuthorityJson).toBe(JSON.stringify({ prd: 'advisory', merge: 'autonomous' }));
    expect(policy.policyRulesJson).toBe(
      JSON.stringify([{ ruleId: 'r1', condition: 'hasTests', action: 'approve' }])
    );
    expect(policy.notificationOverridesJson).toBe(JSON.stringify({ agentQuestionBlocking: false }));
  });

  it('rejects an unknown autonomy level', async () => {
    await expect(
      useCase.execute({
        scopeType: SupervisorScopeType.app,
        scopeId: 'app-1',
        autonomyLevel: 'godmode' as SupervisorAutonomy,
      })
    ).rejects.toThrow(InvalidSupervisorPolicyError);
  });

  it('rejects a missing scopeType', async () => {
    await expect(
      useCase.execute({
        scopeType: '' as SupervisorScopeType,
        autonomyLevel: SupervisorAutonomy.advisory,
      })
    ).rejects.toThrow(InvalidSupervisorPolicyError);
  });

  it('rejects gateAuthority entries with unknown gate keys', async () => {
    await expect(
      useCase.execute({
        scopeType: SupervisorScopeType.app,
        scopeId: 'app-1',
        autonomyLevel: SupervisorAutonomy.advisory,
        gateAuthority: { unknownGate: SupervisorAutonomy.advisory } as Record<
          string,
          SupervisorAutonomy
        >,
      })
    ).rejects.toThrow(InvalidSupervisorPolicyError);
  });

  it('rejects gateAuthority entries with invalid autonomy values', async () => {
    await expect(
      useCase.execute({
        scopeType: SupervisorScopeType.app,
        scopeId: 'app-1',
        autonomyLevel: SupervisorAutonomy.advisory,
        gateAuthority: { prd: 'godmode' as SupervisorAutonomy },
      })
    ).rejects.toThrow(InvalidSupervisorPolicyError);
  });

  it('rejects policy rules without a ruleId', async () => {
    await expect(
      useCase.execute({
        scopeType: SupervisorScopeType.app,
        scopeId: 'app-1',
        autonomyLevel: SupervisorAutonomy.advisory,
        policyRules: [{ condition: 'hasTests', action: 'approve' } as never],
      })
    ).rejects.toThrow(InvalidSupervisorPolicyError);
  });
});
