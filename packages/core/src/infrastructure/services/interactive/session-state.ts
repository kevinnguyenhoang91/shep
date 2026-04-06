/**
 * Shared in-memory session state and types used across all interactive
 * session sub-services.
 */

import type {
  InteractiveAgentSessionHandle,
  UserInteractionData,
} from '../../../application/ports/output/agents/interactive-agent-executor.interface.js';
import type { StreamChunk } from '../../../application/ports/output/services/interactive-session-service.interface.js';

/** Default idle timeout if no settings are loaded (15 minutes). */
export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

/** Default concurrent session cap. */
export const DEFAULT_CAP = 3;

/** Maximum time to wait for the agent to become ready (60 seconds). */
export const BOOT_TIMEOUT_MS = 60_000;

/** In-memory state for a single live session. */
export interface SessionState {
  sessionId: string;
  featureId: string;
  worktreePath: string;
  /** Agent SDK session handle — null until session is created. */
  handle: InteractiveAgentSessionHandle | null;
  /** Agent SDK session ID for resumption across service restarts. */
  agentSessionId?: string;
  timer: NodeJS.Timeout | null;
  /** Accumulates assistant text between user turns for persistence. */
  currentAssistantBuffer: string;
  /** Accumulates tool events during a turn for rich message persistence. */
  toolEventsLog: string[];
  /** Subscriber callbacks for real-time stdout chunk forwarding. */
  subscribers: Set<(chunk: StreamChunk) => void>;
  /** User message content queued while session boots. */
  pendingUserContent?: string;
  /** Model override for the agent process (e.g. 'claude-sonnet-4-6'). */
  model?: string;
  /** Agent type for this session. */
  agentType?: string;
  /** AbortController to cancel active stream iteration on stop. */
  streamAbort?: AbortController;
  /** Whether a turn is currently executing (prevents concurrent turns). */
  turnInProgress: boolean;
  /** Queue of user messages waiting to be sent after the current turn completes. */
  turnQueue: string[];
  /** Pending user interaction (AskUserQuestion) — agent stream is paused, waiting for response. */
  pendingInteraction: UserInteractionData | null;
  /** Resolver for the pending interaction Promise — call to resume the agent. */
  pendingInteractionResolver: ((answers: Record<string, string>) => void) | null;
}
