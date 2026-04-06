/**
 * Session State Manager
 *
 * Handles session CRUD operations, state queries, stop/cleanup logic,
 * markRead, and turn status retrieval.
 */

import type { IInteractiveSessionRepository } from '../../../application/ports/output/repositories/interactive-session-repository.interface.js';
import type { IInteractiveMessageRepository } from '../../../application/ports/output/repositories/interactive-message-repository.interface.js';
import type { InteractiveSession, InteractiveMessage } from '../../../domain/generated/output.js';
import { InteractiveSessionStatus } from '../../../domain/generated/output.js';
import type { SessionState } from './session-state.js';

export class SessionStateManager {
  constructor(
    private readonly sessionRepo: IInteractiveSessionRepository,
    private readonly messageRepo: IInteractiveMessageRepository
  ) {}

  async getSession(sessionId: string): Promise<InteractiveSession | null> {
    return this.sessionRepo.findById(sessionId);
  }

  async getMessages(featureId: string, limit?: number): Promise<InteractiveMessage[]> {
    return this.messageRepo.findByFeatureId(featureId, limit);
  }

  async clearMessages(
    featureId: string,
    sessions: Map<string, SessionState>,
    stoppedAgentSessionIds: Map<string, string>,
    stopSession: (sessionId: string) => Promise<void>
  ): Promise<void> {
    // Stop any active session so the agent doesn't retain old context
    const state = this.findActiveStateForFeature(featureId, sessions);
    if (state) {
      await stopSession(state.sessionId);
    }
    // Also clear the cached agentSessionId so next session starts fresh
    stoppedAgentSessionIds.delete(featureId);
    return this.messageRepo.deleteByFeatureId(featureId);
  }

  async stopSession(
    sessionId: string,
    sessions: Map<string, SessionState>,
    stoppedAgentSessionIds: Map<string, string>
  ): Promise<void> {
    const state = sessions.get(sessionId);
    if (!state) {
      // Already stopped — idempotent
      return;
    }

    // eslint-disable-next-line no-console
    console.log(
      `[InteractiveSession] stopSession called for ${sessionId} (feature: ${state.featureId})`,
      new Error().stack?.split('\n').slice(1, 4).join(' <- ')
    );

    // Abort any active stream iteration and clear pending turns
    if (state.streamAbort) {
      state.streamAbort.abort();
      state.streamAbort = undefined;
    }
    state.turnQueue.length = 0;
    state.turnInProgress = false;

    this.clearTimer(state);
    // Cache agentSessionId so resumption works when session restarts
    if (state.agentSessionId) {
      stoppedAgentSessionIds.set(state.featureId, state.agentSessionId);
    }
    sessions.delete(sessionId);

    // Close the SDK session handle
    if (state.handle) {
      try {
        await state.handle.close();
      } catch {
        // Session may already be closed
      }
      state.handle = null;
    }

    await this.sessionRepo.updateStatus(sessionId, InteractiveSessionStatus.stopped, new Date());
    void this.sessionRepo.updateTurnStatus(sessionId, 'idle');
  }

  async stopByFeature(
    featureId: string,
    sessions: Map<string, SessionState>,
    stoppedAgentSessionIds: Map<string, string>
  ): Promise<void> {
    const state = this.findActiveStateForFeature(featureId, sessions);
    if (!state) return;
    await this.stopSession(state.sessionId, sessions, stoppedAgentSessionIds);
  }

  async markRead(featureId: string, sessions: Map<string, SessionState>): Promise<void> {
    // Find the active session for this feature and clear unread status
    const state = this.findActiveStateForFeature(featureId, sessions);
    if (state) {
      void this.sessionRepo.updateTurnStatus(state.sessionId, 'idle');
      return;
    }
    // Fallback: check DB for the latest active session
    const latest = await this.sessionRepo.findByFeatureId(featureId);
    if (latest) {
      void this.sessionRepo.updateTurnStatus(latest.id, 'idle');
    }
  }

  async getTurnStatuses(featureIds: string[]): Promise<Map<string, string>> {
    return this.sessionRepo.getTurnStatuses(featureIds);
  }

  async getAllActiveTurnStatuses(): Promise<Map<string, string>> {
    return this.sessionRepo.getAllActiveTurnStatuses();
  }

  /** Find the in-memory state for an active session for a feature. */
  findActiveStateForFeature(
    featureId: string,
    sessions: Map<string, SessionState>
  ): SessionState | undefined {
    for (const state of sessions.values()) {
      if (state.featureId === featureId) return state;
    }
    return undefined;
  }

  /** Cancel the idle timer for a session. */
  private clearTimer(state: SessionState): void {
    if (state.timer !== null) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  }
}
