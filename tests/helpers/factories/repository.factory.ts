/**
 * Repository Test Factory
 *
 * Builds Repository entities with sensible defaults for unit tests.
 * Override any field via the `overrides` parameter.
 */

import { randomUUID } from 'node:crypto';
import type { Repository } from '@/domain/generated/output.js';

/**
 * Build a Repository entity with sensible defaults.
 *
 * @param overrides - Partial Repository fields to override defaults
 * @returns A complete Repository object
 */
export function buildRepository(overrides?: Partial<Repository>): Repository {
  const id = overrides?.id ?? randomUUID();
  const now = new Date();

  return {
    id,
    name: 'test-repo',
    path: '/repo',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
