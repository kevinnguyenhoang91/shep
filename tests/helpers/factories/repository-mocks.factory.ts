/**
 * Repository Mock Factories
 *
 * Builds vi.fn()-based mock objects for repository interfaces.
 * Each builder returns an object matching the corresponding interface
 * with all methods pre-stubbed. Override individual methods in tests
 * by calling `.mockResolvedValue()` / `.mockReturnValue()` on them.
 */

import { vi } from 'vitest';
import type { IFeatureRepository } from '@/application/ports/output/repositories/feature-repository.interface.js';
import type { IAgentRunRepository } from '@/application/ports/output/agents/agent-run-repository.interface.js';
import type { ISettingsRepository } from '@/application/ports/output/repositories/settings.repository.interface.js';
import type { IRepositoryRepository } from '@/application/ports/output/repositories/repository-repository.interface.js';
import type { IAgentSessionRepository } from '@/application/ports/output/agents/agent-session-repository.interface.js';

/**
 * Build a mock IFeatureRepository with all methods stubbed.
 *
 * Methods default to returning null/undefined/empty arrays as appropriate.
 * Override specific methods in your test's `beforeEach` block.
 */
export function buildMockFeatureRepository(): IFeatureRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findByIdPrefix: vi.fn().mockResolvedValue(null),
    findBySlug: vi.fn().mockResolvedValue(null),
    findByBranch: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
    findByParentId: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Build a mock IAgentRunRepository with all methods stubbed.
 */
export function buildMockAgentRunRepository(): IAgentRunRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findByThreadId: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    updatePinnedConfig: vi.fn().mockResolvedValue(undefined),
    findRunningByPid: vi.fn().mockResolvedValue([]),
    findByIds: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Build a mock ISettingsRepository with all methods stubbed.
 */
export function buildMockSettingsRepository(): ISettingsRepository {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Build a mock IRepositoryRepository with all methods stubbed.
 */
export function buildMockRepositoryRepository(): IRepositoryRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findByPath: vi.fn().mockResolvedValue(null),
    findByPathIncludingDeleted: vi.fn().mockResolvedValue(null),
    findByRemoteUrl: vi.fn().mockResolvedValue(null),
    findByUpstreamUrl: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
    remove: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Build a mock IAgentSessionRepository with all methods stubbed.
 */
export function buildMockAgentSessionRepository(): IAgentSessionRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    isSupported: vi.fn().mockReturnValue(true),
  };
}
