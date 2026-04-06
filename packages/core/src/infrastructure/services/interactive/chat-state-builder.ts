/**
 * Chat State Builder
 *
 * Reconstructs the full ChatState for the frontend by merging DB records,
 * in-memory streaming state, session info, turn status, and pending interactions.
 */

import type { IInteractiveSessionRepository } from '../../../application/ports/output/repositories/interactive-session-repository.interface.js';
import type { IInteractiveMessageRepository } from '../../../application/ports/output/repositories/interactive-message-repository.interface.js';
import type { ChatState } from '../../../application/ports/output/services/interactive-session-service.interface.js';
import { InteractiveSessionStatus } from '../../../domain/generated/output.js';
import type { SessionState } from './session-state.js';
import { getSettings, hasSettings } from '../settings.service.js';
import { DEFAULT_TIMEOUT_MS } from './session-state.js';

export class ChatStateBuilder {
  constructor(
    private readonly sessionRepo: IInteractiveSessionRepository,
    private readonly messageRepo: IInteractiveMessageRepository
  ) {}

  async getChatState(featureId: string, sessions: Map<string, SessionState>): Promise<ChatState> {
    // DB messages
    const messages = await this.messageRepo.findByFeatureId(featureId);

    // Find active in-memory session
    const state = this.findActiveStateForFeature(featureId, sessions);
    let sessionStatus: string | null = null;
    let streamingText: string | null = null;
    let sessionInfo: ChatState['sessionInfo'] = null;

    if (state) {
      const dbSession = await this.sessionRepo.findById(state.sessionId);
      sessionStatus = dbSession?.status ?? null;
      if (state.currentAssistantBuffer) {
        streamingText = state.currentAssistantBuffer;
      }
      // Resolve model display: explicit override > default
      const displayModel = state.model ?? 'claude-sonnet-4-6';

      const usage = await this.sessionRepo.getUsage(state.sessionId);
      sessionInfo = {
        pid: null, // SDK manages process internally
        sessionId: state.agentSessionId ?? state.sessionId,
        model: displayModel,
        startedAt: dbSession?.startedAt
          ? new Date(dbSession.startedAt as unknown as string).toISOString()
          : new Date().toISOString(),
        idleTimeoutMinutes: Math.round(this.getTimeoutMs() / 60_000),
        lastActivityAt: dbSession?.lastActivityAt
          ? new Date(dbSession.lastActivityAt as unknown as string).toISOString()
          : new Date().toISOString(),
        totalCostUsd: usage?.totalCostUsd ?? null,
        totalInputTokens: usage?.totalInputTokens ?? null,
        totalOutputTokens: usage?.totalOutputTokens ?? null,
      };
    } else {
      // No in-memory state — check DB for last session (e.g. after server restart / hot-reload)
      const latest = await this.sessionRepo.findByFeatureId(featureId);
      if (latest) {
        sessionStatus = latest.status as string;
        // Show DB info even without live process (process was lost on restart)
        if (
          latest.status !== InteractiveSessionStatus.stopped &&
          latest.status !== InteractiveSessionStatus.error
        ) {
          const latestUsage = await this.sessionRepo.getUsage(latest.id);
          sessionInfo = {
            pid: null,
            sessionId: latest.id,
            model: null,
            startedAt: latest.startedAt
              ? new Date(latest.startedAt as unknown as string).toISOString()
              : new Date().toISOString(),
            idleTimeoutMinutes: Math.round(this.getTimeoutMs() / 60_000),
            lastActivityAt: latest.lastActivityAt
              ? new Date(latest.lastActivityAt as unknown as string).toISOString()
              : new Date().toISOString(),
            totalCostUsd: latestUsage?.totalCostUsd ?? null,
            totalInputTokens: latestUsage?.totalInputTokens ?? null,
            totalOutputTokens: latestUsage?.totalOutputTokens ?? null,
          };
        }
      }
    }

    // Resolve turn status from DB
    let turnStatus = 'idle';
    const activeState = state;
    if (activeState) {
      const statuses = await this.sessionRepo.getTurnStatuses([featureId]);
      turnStatus = statuses.get(featureId) ?? 'idle';
    } else {
      // Check DB for the latest session's turn status
      const latest = await this.sessionRepo.findByFeatureId(featureId);
      if (latest) {
        const statuses = await this.sessionRepo.getTurnStatuses([featureId]);
        turnStatus = statuses.get(featureId) ?? 'idle';
      }
    }

    // Include pending interaction if one exists
    const pendingInteraction = state?.pendingInteraction ?? null;

    return { messages, sessionStatus, streamingText, sessionInfo, turnStatus, pendingInteraction };
  }

  /** Read the auto-timeout from settings or fall back to default. */
  private getTimeoutMs(): number {
    if (!hasSettings()) return DEFAULT_TIMEOUT_MS;
    const settings = getSettings();
    const minutes = settings.interactiveAgent?.autoTimeoutMinutes ?? 15;
    return minutes * 60 * 1000;
  }

  /** Find the in-memory state for an active session for a feature. */
  private findActiveStateForFeature(
    featureId: string,
    sessions: Map<string, SessionState>
  ): SessionState | undefined {
    for (const state of sessions.values()) {
      if (state.featureId === featureId) return state;
    }
    return undefined;
  }
}
