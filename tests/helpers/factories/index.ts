/**
 * Test Factory Barrel Export
 *
 * Provides shared factory builders for domain entities and mock repositories.
 * Import from `@tests/helpers/factories` in test files.
 *
 * @example
 * ```typescript
 * import { buildFeature, buildMockFeatureRepository } from '@tests/helpers/factories/index.js';
 *
 * const feature = buildFeature({ name: 'auth' });
 * const mockRepo = buildMockFeatureRepository();
 * ```
 */

// Entity factories
export { buildFeature } from './feature.factory.js';
export { buildAgentRun } from './agent-run.factory.js';
export { buildAgentSession } from './agent-session.factory.js';
export { buildSettings } from './settings.factory.js';
export { buildRepository } from './repository.factory.js';

// Repository mock factories
export {
  buildMockFeatureRepository,
  buildMockAgentRunRepository,
  buildMockSettingsRepository,
  buildMockRepositoryRepository,
  buildMockAgentSessionRepository,
} from './repository-mocks.factory.js';
