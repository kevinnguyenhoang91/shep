/**
 * Interactive module — Interactive session repositories, service, and use cases.
 */

import type { DependencyContainer } from 'tsyringe';
import type Database from 'better-sqlite3';

import type { IInteractiveSessionRepository } from '../../../application/ports/output/repositories/interactive-session-repository.interface.js';
import type { IInteractiveMessageRepository } from '../../../application/ports/output/repositories/interactive-message-repository.interface.js';
import type { IInteractiveSessionService } from '../../../application/ports/output/services/interactive-session-service.interface.js';
import type { IAgentExecutorFactory } from '../../../application/ports/output/agents/agent-executor-factory.interface.js';
import type { IFeatureRepository } from '../../../application/ports/output/repositories/feature-repository.interface.js';
import { SQLiteInteractiveSessionRepository } from '../../repositories/sqlite-interactive-session.repository.js';
import { SQLiteInteractiveMessageRepository } from '../../repositories/sqlite-interactive-message.repository.js';
import { InteractiveSessionService } from '../../services/interactive/interactive-session.service.js';
import { FeatureContextBuilder } from '../../services/interactive/feature-context.builder.js';

import { StartInteractiveSessionUseCase } from '../../../application/use-cases/interactive/start-interactive-session.use-case.js';
import { SendInteractiveMessageUseCase } from '../../../application/use-cases/interactive/send-interactive-message.use-case.js';
import { StopInteractiveSessionUseCase } from '../../../application/use-cases/interactive/stop-interactive-session.use-case.js';
import { GetInteractiveChatStateUseCase } from '../../../application/use-cases/interactive/get-interactive-chat-state.use-case.js';
import { RespondToInteractionUseCase } from '../../../application/use-cases/interactive/respond-to-interaction.use-case.js';

/**
 * Registers interactive session infrastructure and use cases.
 * Also performs startup cleanup (marks zombie sessions as stopped).
 */
export async function registerInteractive(container: DependencyContainer): Promise<void> {
  // Register interactive session repositories
  container.register<IInteractiveSessionRepository>('IInteractiveSessionRepository', {
    useFactory: (c) => {
      const database = c.resolve<Database.Database>('Database');
      return new SQLiteInteractiveSessionRepository(database);
    },
  });

  container.register<IInteractiveMessageRepository>('IInteractiveMessageRepository', {
    useFactory: (c) => {
      const database = c.resolve<Database.Database>('Database');
      return new SQLiteInteractiveMessageRepository(database);
    },
  });

  const interactiveSessionRepo = container.resolve<IInteractiveSessionRepository>(
    'IInteractiveSessionRepository'
  );
  const interactiveMessageRepo = container.resolve<IInteractiveMessageRepository>(
    'IInteractiveMessageRepository'
  );
  const interactiveSessionService = new InteractiveSessionService(
    interactiveSessionRepo,
    interactiveMessageRepo,
    container.resolve<IAgentExecutorFactory>('IAgentExecutorFactory'),
    container.resolve<IFeatureRepository>('IFeatureRepository'),
    new FeatureContextBuilder()
  );
  container.registerInstance<IInteractiveSessionService>(
    'IInteractiveSessionService',
    interactiveSessionService
  );

  // Register interactive session use cases
  container.registerSingleton(StartInteractiveSessionUseCase);
  container.registerSingleton(SendInteractiveMessageUseCase);
  container.registerSingleton(StopInteractiveSessionUseCase);
  container.registerSingleton(GetInteractiveChatStateUseCase);
  container.registerSingleton(RespondToInteractionUseCase);

  // Startup cleanup: mark any zombie sessions (booting/ready from a prior server run) as stopped
  await interactiveSessionRepo.markAllActiveStopped();
}
