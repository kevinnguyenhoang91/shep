/**
 * Turn Executor
 *
 * Handles turn execution logic: sending messages to the SDK session handle,
 * processing the response stream, persisting messages, and managing the
 * turn queue and user interactions.
 */

import * as crypto from 'node:crypto';
import type { IInteractiveSessionRepository } from '../../../application/ports/output/repositories/interactive-session-repository.interface.js';
import type { IInteractiveMessageRepository } from '../../../application/ports/output/repositories/interactive-message-repository.interface.js';
import type { UserInteractionData } from '../../../application/ports/output/agents/interactive-agent-executor.interface.js';
import type { InteractiveMessage } from '../../../domain/generated/output.js';
import {
  InteractiveSessionStatus,
  InteractiveMessageRole,
} from '../../../domain/generated/output.js';
import type { SessionState } from './session-state.js';
import type { SubscriberNotifier } from './subscriber-notifier.js';

export class TurnExecutor {
  constructor(
    private readonly sessionRepo: IInteractiveSessionRepository,
    private readonly messageRepo: IInteractiveMessageRepository,
    private readonly notifier: SubscriberNotifier,
    private readonly resetTimer: (state: SessionState) => void
  ) {}

  /**
   * Send a message within an existing ready session.
   * Guards concurrent turns via the turnInProgress flag and turn queue.
   */
  async sendMessage(
    sessionId: string,
    content: string,
    sessions: Map<string, SessionState>,
    stoppedAgentSessionIds: Map<string, string>
  ): Promise<InteractiveMessage> {
    const dbSession = await this.sessionRepo.findById(sessionId);
    if (!dbSession || dbSession.status !== InteractiveSessionStatus.ready) {
      throw new Error(`Session ${sessionId} is not ready — cannot send message`);
    }

    const state = sessions.get(sessionId);
    if (!state) {
      throw new Error(`Session ${sessionId} is not ready — cannot send message`);
    }

    // Persist user message
    const now = new Date();
    const message: InteractiveMessage = {
      id: crypto.randomUUID(),
      featureId: state.featureId,
      sessionId,
      role: InteractiveMessageRole.user,
      content,
      createdAt: now,
      updatedAt: now,
    };
    await this.messageRepo.create(message);

    // Reset idle timer on user activity
    this.resetTimer(state);
    await this.sessionRepo.updateLastActivity(sessionId, now);

    // Guard: only one turn at a time per session (SDK stream is not concurrent-safe)
    if (state.turnInProgress) {
      state.turnQueue.push(content);
    } else {
      state.turnInProgress = true;
      void this.executeAndPersistTurn(state, content, sessions, stoppedAgentSessionIds);
    }

    return message;
  }

  /**
   * Feature-scoped send: persist user message, find/boot session, and dispatch.
   */
  async sendUserMessage(
    featureId: string,
    content: string,
    worktreePath: string,
    sessions: Map<string, SessionState>,
    stoppedAgentSessionIds: Map<string, string>,
    startSession: (
      featureId: string,
      worktreePath: string,
      model?: string,
      agentType?: string
    ) => Promise<{ id: string }>,
    findActiveStateForFeature: (featureId: string) => SessionState | undefined,
    model?: string,
    agentType?: string
  ): Promise<InteractiveMessage> {
    // 1. Persist user message to DB immediately — this is the source of truth
    const now = new Date();
    const userMsg: InteractiveMessage = {
      id: crypto.randomUUID(),
      featureId,
      role: InteractiveMessageRole.user,
      content,
      createdAt: now,
      updatedAt: now,
    };
    await this.messageRepo.create(userMsg);

    // 2. Find active session for this feature
    let state = findActiveStateForFeature(featureId);

    // If the caller requested a different model/agent than the running session,
    // silently stop the current session so a new one boots with the new config.
    // Also clear the cached agentSessionId so we create a fresh SDK session
    // instead of resuming the old one (which would keep the old model).
    if (state && model && state.model !== model) {
      await this.stopSessionForFeature(state.sessionId, sessions, stoppedAgentSessionIds);
      stoppedAgentSessionIds.delete(featureId);
      state = undefined;
    } else if (state && agentType && state.agentType !== agentType) {
      await this.stopSessionForFeature(state.sessionId, sessions, stoppedAgentSessionIds);
      stoppedAgentSessionIds.delete(featureId);
      state = undefined;
    }

    if (state) {
      const dbSession = await this.sessionRepo.findById(state.sessionId);
      if (dbSession?.status === InteractiveSessionStatus.ready) {
        // Session ready — send to agent (guarded: one turn at a time)
        this.resetTimer(state);
        await this.sessionRepo.updateLastActivity(state.sessionId, now);
        if (state.turnInProgress) {
          state.turnQueue.push(content);
        } else {
          state.turnInProgress = true;
          void this.executeAndPersistTurn(state, content, sessions, stoppedAgentSessionIds);
        }
      } else if (dbSession?.status === InteractiveSessionStatus.booting) {
        // Session booting — queue the message
        state.pendingUserContent = content;
      }
    } else {
      // No in-memory session — check DB for an orphaned active session (e.g. after
      // service restart / hot-reload) and mark it stopped before booting a new one.
      // The agentSessionId is persisted in DB so startSession will pick it up for
      // SDK session resumption.
      const dbSession = await this.sessionRepo.findByFeatureId(featureId);
      if (
        dbSession &&
        (dbSession.status === InteractiveSessionStatus.ready ||
          dbSession.status === InteractiveSessionStatus.booting)
      ) {
        await this.sessionRepo.updateStatus(
          dbSession.id,
          InteractiveSessionStatus.stopped,
          new Date()
        );
      }

      // Boot a new session — startSession will find the agentSessionId from DB
      const session = await startSession(featureId, worktreePath, model, agentType);
      const newState = sessions.get(session.id);
      if (newState) {
        newState.pendingUserContent = content;
      }
    }

    return userMsg;
  }

  /**
   * Respond to a pending user interaction (AskUserQuestion).
   * Sends the user's answers back to the agent as a tool result,
   * clears the pending interaction, and resumes the agent's turn.
   */
  async respondToInteraction(
    featureId: string,
    answers: Record<string, string>,
    findActiveStateForFeature: (featureId: string) => SessionState | undefined
  ): Promise<void> {
    const state = findActiveStateForFeature(featureId);
    if (!state?.pendingInteraction || !state.pendingInteractionResolver) {
      throw new Error(`No pending interaction for feature ${featureId}`);
    }

    // Persist the user's answers as a structured user message.
    const interactionPayload = {
      questions: state.pendingInteraction.questions.map((q) => ({
        header: q.header,
        question: q.question,
      })),
      answers,
    };
    const now = new Date();
    const userMsg: InteractiveMessage = {
      id: crypto.randomUUID(),
      featureId: state.featureId,
      sessionId: state.sessionId,
      role: InteractiveMessageRole.user,
      content: `{{interaction}}${JSON.stringify(interactionPayload)}`,
      createdAt: now,
      updatedAt: now,
    };
    await this.messageRepo.create(userMsg);

    // Resolve the Promise that the canUseTool callback is awaiting.
    state.pendingInteractionResolver(answers);

    // Clear pending interaction state
    state.pendingInteraction = null;
    state.pendingInteractionResolver = null;

    // Update turn status back to processing
    void this.sessionRepo.updateTurnStatus(state.sessionId, 'processing');

    // Clear the "Waiting for your response..." log
    state.subscribers.forEach((sub) => sub({ delta: '', done: false }));
  }

  /**
   * Build the onUserQuestion callback for a session.
   * Called by the SDK's canUseTool when the agent invokes AskUserQuestion.
   * Returns a Promise that doesn't resolve until the user submits their answers.
   */
  buildOnUserQuestionCallback(state: SessionState) {
    return async (interaction: UserInteractionData): Promise<Record<string, string>> => {
      // Flush any accumulated assistant text as a separate message BEFORE
      // the interaction.
      if (state.currentAssistantBuffer.trim()) {
        const now = new Date();
        const msg: InteractiveMessage = {
          id: crypto.randomUUID(),
          featureId: state.featureId,
          sessionId: state.sessionId,
          role: InteractiveMessageRole.assistant,
          content: state.currentAssistantBuffer,
          createdAt: now,
          updatedAt: now,
        };
        await this.messageRepo.create(msg);
        state.currentAssistantBuffer = '';
        state.toolEventsLog = [];

        // Notify subscribers so the frontend picks up the new message
        state.subscribers.forEach((sub) => sub({ delta: '', done: true }));
        // Small delay so the refetch completes before the interaction appears
        await new Promise<void>((r) => setTimeout(r, 100));
      }

      // Store the interaction data for the frontend
      state.pendingInteraction = interaction;

      // Update turn status so the dot indicator shows amber
      void this.sessionRepo.updateTurnStatus(state.sessionId, 'awaiting_input');

      // Notify subscribers so SSE pushes the interaction to the frontend
      state.subscribers.forEach((sub) =>
        sub({
          delta: '',
          done: false,
          log: 'Waiting for your response...',
          interaction,
        })
      );

      // Create a Promise that will be resolved when the user calls respondToInteraction
      return new Promise<Record<string, string>>((resolve) => {
        state.pendingInteractionResolver = resolve;
      });
    };
  }

  /**
   * Execute a turn via the SDK session handle and persist the assistant response.
   */
  async executeAndPersistTurn(
    state: SessionState,
    prompt: string,
    sessions: Map<string, SessionState>,
    stoppedAgentSessionIds: Map<string, string>
  ): Promise<void> {
    try {
      if (!state.handle) {
        throw new Error('No active session handle — cannot execute turn');
      }

      state.currentAssistantBuffer = '';
      state.toolEventsLog = [];

      // Mark turn as processing for dot indicator
      void this.sessionRepo.updateTurnStatus(state.sessionId, 'processing');

      // Send the message to the SDK session
      await state.handle.send(prompt);

      // Set up abort controller for this stream
      const abort = new AbortController();
      state.streamAbort = abort;

      let responseText = '';

      try {
        for await (const event of state.handle.stream()) {
          if (abort.signal.aborted) break;

          // Reset idle timer on each event received
          this.resetTimer(state);

          switch (event.type) {
            case 'delta':
              if (event.content) {
                responseText += event.content;
                state.currentAssistantBuffer += event.content;
                this.notifier.notify(state, { delta: event.content!, done: false });
              }
              break;

            case 'tool_use':
              if (event.label) {
                const toolLabel = event.label;
                const toolDetail = event.detail;
                void this.persistToolEvent(state, toolLabel, toolDetail);
                this.notifier.notify(state, {
                  delta: '',
                  done: false,
                  log: `Using tool: ${toolLabel}`,
                  activity: { kind: 'tool_use', label: toolLabel, detail: toolDetail },
                });
              }
              break;

            case 'tool_result':
              if (event.label) {
                const resultLabel = event.label;
                const resultDetail = event.detail;
                void this.persistToolEvent(state, resultLabel, resultDetail);
                this.notifier.notify(state, {
                  delta: '',
                  done: false,
                  log: `Completed: ${resultLabel}`,
                  activity: { kind: 'tool_result', label: resultLabel, detail: resultDetail },
                });
              }
              break;

            case 'status':
              if (event.content) {
                const statusContent = event.content;
                this.notifier.notify(state, { delta: '', done: false, log: statusContent });
              }
              break;

            case 'done': {
              // Use result text if provided and non-empty, otherwise use accumulated buffer
              const resultText =
                event.content && event.content.length > 0 ? event.content : responseText;

              // Persist assistant message
              const now = new Date();
              const msg: InteractiveMessage = {
                id: crypto.randomUUID(),
                featureId: state.featureId,
                sessionId: state.sessionId,
                role: InteractiveMessageRole.assistant,
                content: resultText,
                createdAt: now,
                updatedAt: now,
              };
              await this.messageRepo.create(msg);

              state.currentAssistantBuffer = '';
              state.toolEventsLog = [];

              // Accumulate usage from this turn
              if (event.usage) {
                void this.sessionRepo.accumulateUsage(state.sessionId, {
                  costUsd: event.usage.costUsd ?? 0,
                  inputTokens: event.usage.inputTokens ?? 0,
                  outputTokens: event.usage.outputTokens ?? 0,
                  turns: event.usage.numTurns ?? 1,
                });
              }

              // Mark as unread
              void this.sessionRepo.updateTurnStatus(state.sessionId, 'unread');

              // Notify subscribers of end-of-turn
              this.notifier.notify(state, { delta: '', done: true });
              return; // Turn complete
            }

            case 'error':
              // eslint-disable-next-line no-console
              console.error(
                `[InteractiveSession] agent error during turn for session ${state.sessionId}:`,
                event.content
              );
              // Accumulate usage even on errors — cost was still incurred
              if (event.usage) {
                void this.sessionRepo.accumulateUsage(state.sessionId, {
                  costUsd: event.usage.costUsd ?? 0,
                  inputTokens: event.usage.inputTokens ?? 0,
                  outputTokens: event.usage.outputTokens ?? 0,
                  turns: event.usage.numTurns ?? 1,
                });
              }
              this.notifier.notify(state, {
                delta: '',
                done: true,
                log: `Error: ${event.content ?? 'unknown'}`,
              });
              break;

            case 'init':
              // The SDK emits init on every turn, but we only show "Session started"
              // during boot (handled in session-boot-sequence). Ignore it here.
              break;

            case 'api_retry':
              this.notifier.notify(state, {
                delta: '',
                done: false,
                log: event.content ?? 'Retrying API call...',
              });
              break;

            case 'rate_limit':
              this.notifier.notify(state, {
                delta: '',
                done: false,
                log: event.content ?? 'Rate limited',
              });
              break;

            case 'task_started':
              if (event.content) {
                void this.persistToolEvent(state, 'Subtask started', event.content);
                this.notifier.notify(state, {
                  delta: '',
                  done: false,
                  log: `Subtask: ${event.content}`,
                  activity: { kind: 'system', label: 'Subtask started', detail: event.content },
                });
              }
              break;

            case 'task_progress':
              if (event.content) {
                this.notifier.notify(state, {
                  delta: '',
                  done: false,
                  log: `Subtask: ${event.content}`,
                });
              }
              break;

            case 'task_done':
              if (event.content) {
                const taskStatus = event.detail ?? 'completed';
                void this.persistToolEvent(state, `Subtask ${taskStatus}`, event.content);
                this.notifier.notify(state, {
                  delta: '',
                  done: false,
                  log: `Subtask ${taskStatus}: ${event.content}`,
                  activity: {
                    kind: 'system',
                    label: `Subtask ${taskStatus}`,
                    detail: event.content,
                  },
                });
              }
              break;

            case 'user_question':
              // AskUserQuestion is handled by the canUseTool callback
              // (buildOnUserQuestionCallback). Ignore it here.
              break;
          }
        }
      } finally {
        state.streamAbort = undefined;
      }

      // If we exit the stream loop without a 'done' event (stream ended),
      // persist whatever text we accumulated
      if (responseText && state.currentAssistantBuffer) {
        const now = new Date();
        const msg: InteractiveMessage = {
          id: crypto.randomUUID(),
          featureId: state.featureId,
          sessionId: state.sessionId,
          role: InteractiveMessageRole.assistant,
          content: responseText,
          createdAt: now,
          updatedAt: now,
        };
        await this.messageRepo.create(msg);

        state.currentAssistantBuffer = '';
        state.toolEventsLog = [];
        this.notifier.notify(state, { delta: '', done: true });
      } else if (!responseText) {
        // Stream ended without any response — SDK session likely died.
        // eslint-disable-next-line no-console
        console.error(
          `[InteractiveSession] stream ended without response for session ${state.sessionId} — session may have died`
        );
        this.notifier.notify(state, {
          delta: '',
          done: true,
          log: 'Session disconnected — will restart on next message',
        });
        if (state.agentSessionId) {
          stoppedAgentSessionIds.set(state.featureId, state.agentSessionId);
        }
        sessions.delete(state.sessionId);
        try {
          await this.sessionRepo.updateStatus(state.sessionId, InteractiveSessionStatus.error);
        } catch {
          // Best-effort DB update
        }
        return; // Skip queue drain — session is dead
      }
    } catch (err) {
      // If session was already stopped, ignore
      if (!sessions.has(state.sessionId)) return;
      // eslint-disable-next-line no-console
      console.error(`[InteractiveSession] turn failed for session ${state.sessionId}:`, err);
    } finally {
      // Release the turn lock and drain the queue
      state.turnInProgress = false;
      if (sessions.has(state.sessionId) && state.turnQueue.length > 0) {
        const nextContent = state.turnQueue.shift()!;
        state.turnInProgress = true;
        void this.executeAndPersistTurn(state, nextContent, sessions, stoppedAgentSessionIds);
      }
    }
  }

  /**
   * Persist a tool/system event as its own assistant message in the DB.
   */
  private async persistToolEvent(
    state: SessionState,
    label: string,
    detail?: string
  ): Promise<void> {
    try {
      const content = detail ? `**${label}** \`${detail}\`` : `**${label}**`;
      const msg: InteractiveMessage = {
        id: crypto.randomUUID(),
        featureId: state.featureId,
        sessionId: state.sessionId,
        role: InteractiveMessageRole.assistant,
        content,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.messageRepo.create(msg);
    } catch {
      // Non-critical — don't fail the turn for a tool event
    }
  }

  /**
   * Stop a session (used internally when model/agent type changes).
   * Mirrors the sessionStateManager.stopSession logic needed here.
   */
  private async stopSessionForFeature(
    sessionId: string,
    sessions: Map<string, SessionState>,
    stoppedAgentSessionIds: Map<string, string>
  ): Promise<void> {
    const state = sessions.get(sessionId);
    if (!state) return;

    if (state.streamAbort) {
      state.streamAbort.abort();
      state.streamAbort = undefined;
    }
    state.turnQueue.length = 0;
    state.turnInProgress = false;

    if (state.timer !== null) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    if (state.agentSessionId) {
      stoppedAgentSessionIds.set(state.featureId, state.agentSessionId);
    }
    sessions.delete(sessionId);

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
}
