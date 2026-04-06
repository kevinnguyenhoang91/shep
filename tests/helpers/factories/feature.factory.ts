/**
 * Feature Test Factory
 *
 * Builds Feature entities with sensible defaults for unit tests.
 * Override any field via the `overrides` parameter.
 */

import { randomUUID } from 'node:crypto';
import type { Feature } from '@/domain/generated/output.js';
import { SdlcLifecycle } from '@/domain/generated/output.js';

/**
 * Build a Feature entity with sensible defaults.
 *
 * Every required field is populated so tests only need to override the
 * fields they care about.
 *
 * @param overrides - Partial Feature fields to override defaults
 * @returns A complete Feature object
 */
export function buildFeature(overrides?: Partial<Feature>): Feature {
  const id = overrides?.id ?? randomUUID();
  const now = new Date();

  return {
    id,
    name: 'test-feature',
    userQuery: 'implement test feature',
    slug: 'test-feature',
    description: 'A test feature for unit tests',
    repositoryPath: '/repo',
    branch: 'feat/test-feature',
    lifecycle: SdlcLifecycle.Started,
    messages: [],
    relatedArtifacts: [],
    fast: false,
    push: false,
    openPr: false,
    forkAndPr: false,
    commitSpecs: true,
    ciWatchEnabled: true,
    enableEvidence: false,
    injectSkills: false,
    commitEvidence: false,
    approvalGates: { allowPrd: false, allowPlan: false, allowMerge: false },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
