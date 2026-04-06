/**
 * Subscriber Notifier
 *
 * Manages real-time subscription maps (session-level + feature-level) and
 * dispatches StreamChunk events to all registered listeners.
 */

import type {
  StreamChunk,
  UnsubscribeFn,
} from '../../../application/ports/output/services/interactive-session-service.interface.js';
import type { SessionState } from './session-state.js';

export class SubscriberNotifier {
  /**
   * Feature-level subscribers that survive session restarts.
   *
   * Unlike session-level subscribers (in SessionState.subscribers), these
   * persist when a session dies and a new one boots. SSE connections
   * subscribe here so they continue receiving events from new sessions.
   */
  private featureSubscribers = new Map<string, Set<(chunk: StreamChunk) => void>>();

  /**
   * Subscribe to real-time stdout chunks for a specific session.
   */
  subscribeBySession(
    sessionId: string,
    sessions: Map<string, SessionState>,
    onChunk: (chunk: StreamChunk) => void
  ): UnsubscribeFn {
    const state = sessions.get(sessionId);
    if (!state) {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return () => {};
    }
    state.subscribers.add(onChunk);
    return () => state.subscribers.delete(onChunk);
  }

  /**
   * Subscribe to real-time chunks for a feature's active session.
   * The callback survives session restarts.
   */
  subscribeByFeature(featureId: string, onChunk: (chunk: StreamChunk) => void): UnsubscribeFn {
    let subs = this.featureSubscribers.get(featureId);
    if (!subs) {
      subs = new Set();
      this.featureSubscribers.set(featureId, subs);
    }
    subs.add(onChunk);
    return () => {
      subs!.delete(onChunk);
      if (subs!.size === 0) {
        this.featureSubscribers.delete(featureId);
      }
    };
  }

  /**
   * Dispatch a StreamChunk to all subscribers for a session.
   *
   * Sends to both session-level subscribers (legacy, for sessionId-based
   * subscribe()) and feature-level subscribers (for SSE connections that
   * must survive session restarts).
   */
  notify(state: SessionState, chunk: StreamChunk): void {
    state.subscribers.forEach((sub) => sub(chunk));
    const featureSubs = this.featureSubscribers.get(state.featureId);
    if (featureSubs) {
      featureSubs.forEach((sub) => sub(chunk));
    }
  }
}
