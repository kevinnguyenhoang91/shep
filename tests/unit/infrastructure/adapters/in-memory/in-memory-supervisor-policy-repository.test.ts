/**
 * InMemorySupervisorPolicyRepository — unit tests
 *
 * Verifies the unique-(appId, featureId) constraint and the
 * feature→app scope fallback specified in research decision 7.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemorySupervisorPolicyRepository } from '@/infrastructure/adapters/in-memory/in-memory-supervisor-policy-repository.js';
import type { SupervisorPolicy } from '@/domain/generated/output.js';
import { SupervisorAutonomy } from '@/domain/generated/output.js';

function makePolicy(overrides: Partial<SupervisorPolicy> = {}): SupervisorPolicy {
  const now = new Date();
  return {
    id: overrides.id ?? `pol-${Math.random().toString(36).slice(2, 9)}`,
    appId: 'app-1',
    featureId: undefined,
    enabled: true,
    autonomyLevel: SupervisorAutonomy.advisory,
    gateAuthorityJson: undefined,
    modelId: undefined,
    promptVersion: undefined,
    policyRulesJson: undefined,
    notificationOverridesJson: undefined,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as SupervisorPolicy;
}

describe('InMemorySupervisorPolicyRepository', () => {
  let repo: InMemorySupervisorPolicyRepository;

  beforeEach(() => {
    repo = new InMemorySupervisorPolicyRepository();
  });

  it('create + findById round-trips a policy', async () => {
    const policy = makePolicy({ id: 'p1' });
    await repo.create(policy);
    const found = await repo.findById('p1');
    expect(found?.id).toBe('p1');
  });

  it('rejects duplicate (appId, featureId)', async () => {
    await repo.create(makePolicy({ id: 'p1', appId: 'app-1', featureId: undefined }));
    await expect(
      repo.create(makePolicy({ id: 'p2', appId: 'app-1', featureId: undefined }))
    ).rejects.toThrow();
  });

  it('rejects duplicate (appId, featureId) with same feature', async () => {
    await repo.create(makePolicy({ id: 'p1', appId: 'app-1', featureId: 'f1' }));
    await expect(
      repo.create(makePolicy({ id: 'p2', appId: 'app-1', featureId: 'f1' }))
    ).rejects.toThrow();
  });

  it('allows distinct (appId, featureId) combinations', async () => {
    await repo.create(makePolicy({ id: 'p1', appId: 'app-1', featureId: undefined }));
    await repo.create(makePolicy({ id: 'p2', appId: 'app-1', featureId: 'f1' }));
    await repo.create(makePolicy({ id: 'p3', appId: 'app-2', featureId: undefined }));
    expect(await repo.listByApp('app-1')).toHaveLength(2);
  });

  it('findByApp returns only the app-scoped row (featureId IS NULL)', async () => {
    await repo.create(makePolicy({ id: 'p1', appId: 'app-1', featureId: undefined }));
    await repo.create(makePolicy({ id: 'p2', appId: 'app-1', featureId: 'f1' }));
    const found = await repo.findByApp('app-1');
    expect(found?.id).toBe('p1');
  });

  it('findByFeature returns the feature-scoped row', async () => {
    await repo.create(makePolicy({ id: 'p1', appId: 'app-1', featureId: undefined }));
    await repo.create(makePolicy({ id: 'p2', appId: 'app-1', featureId: 'f1' }));
    const found = await repo.findByFeature('app-1', 'f1');
    expect(found?.id).toBe('p2');
  });

  it('findPolicyForScope returns the feature override when present', async () => {
    await repo.create(makePolicy({ id: 'app-pol', appId: 'app-1', featureId: undefined }));
    await repo.create(makePolicy({ id: 'feat-pol', appId: 'app-1', featureId: 'f1' }));
    const found = await repo.findPolicyForScope('app-1', 'f1');
    expect(found?.id).toBe('feat-pol');
  });

  it('findPolicyForScope falls back to the app row when no feature override exists', async () => {
    await repo.create(makePolicy({ id: 'app-pol', appId: 'app-1', featureId: undefined }));
    const found = await repo.findPolicyForScope('app-1', 'f-missing');
    expect(found?.id).toBe('app-pol');
  });

  it('findPolicyForScope returns null when neither feature nor app row exists', async () => {
    const found = await repo.findPolicyForScope('app-missing', 'f-missing');
    expect(found).toBeNull();
  });

  it('update replaces an existing policy', async () => {
    await repo.create(makePolicy({ id: 'p1', enabled: false }));
    await repo.update(makePolicy({ id: 'p1', enabled: true }));
    const after = await repo.findById('p1');
    expect(after?.enabled).toBe(true);
  });

  it('update throws when the policy does not exist', async () => {
    await expect(repo.update(makePolicy({ id: 'missing' }))).rejects.toThrow();
  });

  it('delete removes a policy', async () => {
    await repo.create(makePolicy({ id: 'p1' }));
    await repo.delete('p1');
    expect(await repo.findById('p1')).toBeNull();
  });

  it('listByApp is app-scoped (no leakage)', async () => {
    await repo.create(makePolicy({ id: 'p1', appId: 'app-1' }));
    await repo.create(makePolicy({ id: 'p2', appId: 'app-2' }));
    const app1 = await repo.listByApp('app-1');
    expect(app1.map((p) => p.id)).toEqual(['p1']);
  });
});
