/**
 * Interactive Session Service (Facade)
 *
 * Thin facade that delegates to focused sub-classes:
 * - SubscriberNotifier — real-time subscription management
 * - SessionStateManager — session CRUD, stop, markRead, turn statuses
 * - ChatStateBuilder — chat UI state reconstruction
 * - TurnExecutor — turn execution, message persistence, user interactions
 * - SessionBootSequence — session initialization and agent boot
 *
 * Must be registered as a singleton in the DI container.
 *
 * **Polymorphic `featureId` scope key:** The `featureId` parameter accepted
 * by public methods (`sendUserMessage`, `getChatState`, `subscribeByFeature`,
 * etc.) is a polymorphic scope key — not necessarily a feature UUID:
 * - Feature chat: actual feature UUID (e.g. `"feat-abc123"`)
 * - Repository chat: repo identifier (e.g. `"repo-<repoId>"`)
 * - Global chat: literal string `"global"`
 *
 * Sessions and messages are isolated by this key regardless of chat type.
 */

import type {
  IInteractiveSessionService,
  StreamChunk,
  UnsubscribeFn,
  ChatState,
} from '../../../application/ports/output/services/interactive-session-service.interface.js';
import type { IInteractiveSessionRepository } from '../../../application/ports/output/repositories/interactive-session-repository.interface.js';
import type { IInteractiveMessageRepository } from '../../../application/ports/output/repositories/interactive-message-repository.interface.js';
import type { IAgentExecutorFactory } from '../../../application/ports/output/agents/agent-executor-factory.interface.js';
import type { IFeatureRepository } from '../../../application/ports/output/repositories/feature-repository.interface.js';
import type { InteractiveSession, InteractiveMessage } from '../../../domain/generated/output.js';
import type { FeatureContextBuilder } from './feature-context.builder.js';
import type { SessionState } from './session-state.js';
import { DEFAULT_TIMEOUT_MS } from './session-state.js';
import { SubscriberNotifier } from './subscriber-notifier.js';
import { SessionStateManager } from './session-state-manager.js';
import { ChatStateBuilder } from './chat-state-builder.js';
import { TurnExecutor } from './turn-executor.js';
import { SessionBootSequence } from './session-boot-sequence.js';
import { getSettings, hasSettings } from '../settings.service.js';

export class InteractiveSessionService implements IInteractiveSessionService {
  /** Live sessions indexed by sessionId. */
  private sessions = new Map<string, SessionState>();
  /** Cached agentSessionIds from stopped sessions, keyed by featureId. */
  private stoppedAgentSessionIds = new Map<string, string>();

  // Sub-services
  private readonly notifier: SubscriberNotifier;
  private readonly stateManager: SessionStateManager;
  private readonly chatStateBuilder: ChatStateBuilder;
  private readonly turnExecutor: TurnExecutor;
  private readonly bootSequence: SessionBootSequence;

  constructor(
    sessionRepo: IInteractiveSessionRepository,
    messageRepo: IInteractiveMessageRepository,
    executorFactory: IAgentExecutorFactory,
    featureRepo: IFeatureRepository,
    contextBuilder: FeatureContextBuilder
  ) {
    this.notifier = new SubscriberNotifier();
    this.stateManager = new SessionStateManager(sessionRepo, messageRepo);
    this.chatStateBuilder = new ChatStateBuilder(sessionRepo, messageRepo);

    // Bind resetTimer so sub-classes can use it
    const resetTimer = (state: SessionState): void => this.resetTimer(state);

    this.turnExecutor = new TurnExecutor(sessionRepo, messageRepo, this.notifier, resetTimer);
    this.bootSequence = new SessionBootSequence(
      sessionRepo,
      messageRepo,
      executorFactory,
      featureRepo,
      contextBuilder,
      this.notifier,
      this.turnExecutor,
      resetTimer
    );
  }

  // ---------------------------------------------------------------------------
  // Public API — delegates to sub-classes
  // ---------------------------------------------------------------------------

  async startSession(
    featureId: string,
    worktreePath: string,
    model?: string,
    agentType?: string
  ): Promise<InteractiveSession> {
    return this.bootSequence.startSession(
      featureId,
      worktreePath,
      this.sessions,
      this.stoppedAgentSessionIds,
      model,
      agentType
    );
  }

  async stopSession(sessionId: string): Promise<void> {
    return this.stateManager.stopSession(sessionId, this.sessions, this.stoppedAgentSessionIds);
  }

  async sendMessage(sessionId: string, content: string): Promise<InteractiveMessage> {
    return this.turnExecutor.sendMessage(
      sessionId,
      content,
      this.sessions,
      this.stoppedAgentSessionIds
    );
  }

  async getMessages(featureId: string, limit?: number): Promise<InteractiveMessage[]> {
    return this.stateManager.getMessages(featureId, limit);
  }

  async clearMessages(featureId: string): Promise<void> {
    return this.stateManager.clearMessages(
      featureId,
      this.sessions,
      this.stoppedAgentSessionIds,
      (sessionId) => this.stopSession(sessionId)
    );
  }

  async getSession(sessionId: string): Promise<InteractiveSession | null> {
    return this.stateManager.getSession(sessionId);
  }

  subscribe(sessionId: string, onChunk: (chunk: StreamChunk) => void): UnsubscribeFn {
    return this.notifier.subscribeBySession(sessionId, this.sessions, onChunk);
  }

  // ---------------------------------------------------------------------------
  // Feature-scoped API (frontend doesn't manage sessions)
  // ---------------------------------------------------------------------------

  async sendUserMessage(
    featureId: string,
    content: string,
    worktreePath: string,
    model?: string,
    agentType?: string
  ): Promise<InteractiveMessage> {
    return this.turnExecutor.sendUserMessage(
      featureId,
      content,
      worktreePath,
      this.sessions,
      this.stoppedAgentSessionIds,
      (fId, wPath, m, aType) => this.startSession(fId, wPath, m, aType),
      (fId) => this.stateManager.findActiveStateForFeature(fId, this.sessions),
      model,
      agentType
    );
  }

  async getChatState(featureId: string): Promise<ChatState> {
    return this.chatStateBuilder.getChatState(featureId, this.sessions);
  }

  subscribeByFeature(featureId: string, onChunk: (chunk: StreamChunk) => void): UnsubscribeFn {
    return this.notifier.subscribeByFeature(featureId, onChunk);
  }

  async stopByFeature(featureId: string): Promise<void> {
    return this.stateManager.stopByFeature(featureId, this.sessions, this.stoppedAgentSessionIds);
  }

  async markRead(featureId: string): Promise<void> {
    return this.stateManager.markRead(featureId, this.sessions);
  }

  async getTurnStatuses(featureIds: string[]): Promise<Map<string, string>> {
    return this.stateManager.getTurnStatuses(featureIds);
  }

  async getAllActiveTurnStatuses(): Promise<Map<string, string>> {
    return this.stateManager.getAllActiveTurnStatuses();
  }

  async respondToInteraction(featureId: string, answers: Record<string, string>): Promise<void> {
    return this.turnExecutor.respondToInteraction(featureId, answers, (fId) =>
      this.stateManager.findActiveStateForFeature(fId, this.sessions)
    );
  }

  // ---------------------------------------------------------------------------
  // Timer helpers (shared by sub-classes via bound callback)
  // ---------------------------------------------------------------------------

  /** Start or restart the idle timeout timer for a session. */
  private resetTimer(state: SessionState): void {
    this.clearTimer(state);
    const timeoutMs = this.getTimeoutMs();
    state.timer = setTimeout(() => {
      void this.stopSession(state.sessionId);
    }, timeoutMs);
  }

  /** Cancel the idle timer for a session. */
  private clearTimer(state: SessionState): void {
    if (state.timer !== null) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  }

  /** Read the auto-timeout from settings or fall back to default. */
  private getTimeoutMs(): number {
    if (!hasSettings()) return DEFAULT_TIMEOUT_MS;
    const settings = getSettings();
    const minutes = settings.interactiveAgent?.autoTimeoutMinutes ?? 15;
    return minutes * 60 * 1000;
  }
}
