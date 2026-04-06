/**
 * Dependency Injection Container
 *
 * Configures tsyringe DI container with all application dependencies.
 * Registers repository implementations, use cases, and services.
 *
 * Registration is split into focused modules under ./modules/.
 * This orchestrator calls each module in the correct dependency order.
 *
 * Usage:
 * ```typescript
 * import { container } from './infrastructure/di/container.js';
 * const useCase = container.resolve(InitializeSettingsUseCase);
 * ```
 */

import 'reflect-metadata';
import { container } from 'tsyringe';

import { registerDatabase } from './modules/database.module.js';
import { registerRepositories } from './modules/repositories.module.js';
import { registerServices } from './modules/services.module.js';
import { registerAgentInfrastructure } from './modules/agent-infrastructure.module.js';
import { registerNotifications } from './modules/notifications.module.js';
import { registerUseCases } from './modules/use-cases.module.js';
import { registerInteractive } from './modules/interactive.module.js';
import { registerWebTokens } from './modules/web-tokens.module.js';

let _initialized = false;

/**
 * Initialize the DI container with all dependencies.
 * Must be called before resolving any dependencies.
 * Safe to call multiple times — returns existing container if already initialized.
 *
 * @returns Configured container instance
 */
export async function initializeContainer(): Promise<typeof container> {
  if (_initialized) {
    return container;
  }

  // 1. Database — must come first; other modules depend on 'Database' token
  const db = await registerDatabase(container);

  // 2. Repositories — depend on Database
  registerRepositories(container);

  // 3. Services — depend on Database + Repositories
  registerServices(container, db);

  // 4. Agent infrastructure — depends on Repositories + Services
  registerAgentInfrastructure(container);

  // 5. Notifications — standalone
  registerNotifications(container);

  // 6. Use cases — depend on Repositories + Services + Agent infra
  registerUseCases(container);

  // 7. Interactive sessions — depend on Repositories + Agent infra; includes async cleanup
  await registerInteractive(container);

  // 8. Web string-token aliases — must come after use cases are registered
  registerWebTokens(container);

  _initialized = true;
  return container;
}

/**
 * Check whether the DI container has been initialized.
 * Useful for diagnostics and conditional initialization in instrumentation.ts.
 */
export function isContainerInitialized(): boolean {
  return _initialized;
}

/**
 * Get the configured container instance.
 * Container must be initialized first via initializeContainer().
 */
export { container };
