/**
 * SupervisorAgentWorker — long-lived in-process subscriber that forwards
 * supervisor events to the {@link ISupervisorAgent} evaluator.
 *
 * One worker exists per `(scopeType, scopeId?, featureId?)` scope. It mirrors the
 * feature-agent-worker shape:
 *   - owns its own `AgentRun` row (`agentName='supervisor'`),
 *   - heartbeats at the same cadence as the feature agent (30s),
 *   - reaps itself after `idleTtlMs` of inactivity (default 10 minutes).
 *
 * The worker is *not* a forked process; it lives inside whichever Shep
 * process happens to receive the first event for a scope. Cross-process
 * coordination remains the SQLite bus's job — see research decision 12.
 *
 * The `SupervisorAgentWorkerRegistry` lazily starts a worker the first
 * time `submit(event)` is called for a new scope. Subsequent events
 * reuse the warm worker. Idle workers are reaped automatically.
 */

import { randomUUID } from 'node:crypto';

import {
  AgentRunStatus,
  AgentType,
  type AgentRun,
  type SupervisorPolicy,
} from '../../../../domain/generated/output.js';
import type { IAgentRunRepository } from '../../../../application/ports/output/agents/agent-run-repository.interface.js';
import type {
  ISupervisorAgent,
  SupervisorDecisionResult,
  SupervisorEvent,
} from '../../../../application/ports/output/agents/supervisor-agent.interface.js';

/** Heartbeat cadence — matches feature-agent-worker (30s). */
export const SUPERVISOR_HEARTBEAT_INTERVAL_MS = 30_000;

/** Default idle TTL before a worker reaps itself (10 minutes). */
export const SUPERVISOR_IDLE_TTL_MS = 10 * 60 * 1000;

/** Reserved AgentRun.agentName for supervisor runs (single source of truth). */
export const SUPERVISOR_AGENT_NAME = 'supervisor';

/** Internal scope key used by the registry. */
function scopeKey(
  scopeType: string,
  scopeId: string | undefined,
  featureId: string | undefined
): string {
  return `${scopeType}:${scopeId ?? ''}::${featureId ?? ''}`;
}

export interface SupervisorAgentWorkerScope {
  scopeType: string;
  scopeId?: string;
  featureId?: string;
}

export interface SupervisorAgentWorkerDeps {
  supervisorAgent: ISupervisorAgent;
  runRepository: IAgentRunRepository;
  /** Override for tests — defaults to {@link SUPERVISOR_HEARTBEAT_INTERVAL_MS}. */
  heartbeatIntervalMs?: number;
  /** Override for tests — defaults to {@link SUPERVISOR_IDLE_TTL_MS}. */
  idleTtlMs?: number;
  /**
   * Hook invoked after a decision is produced. The use-case layer wires
   * this to {@link EvaluateSupervisorDecisionUseCase}-style persistence
   * so the worker stays free of repository concerns.
   */
  onDecision?: (
    scope: SupervisorAgentWorkerScope,
    runId: string,
    event: SupervisorEvent,
    decision: SupervisorDecisionResult
  ) => Promise<void>;
  /** Hook invoked when the worker reaps itself. */
  onReaped?: (scope: SupervisorAgentWorkerScope, runId: string) => Promise<void>;
}

interface PolicyCarrier {
  policy: SupervisorPolicy;
}

/**
 * One worker = one scope. Owns its own AgentRun row, heartbeat timer,
 * and idle-reaper timer. `submit(event)` runs the evaluator and the
 * `onDecision` callback, then resets the idle timer.
 */
export class SupervisorAgentWorker {
  private readonly deps: Required<
    Pick<SupervisorAgentWorkerDeps, 'heartbeatIntervalMs' | 'idleTtlMs'>
  > &
    Omit<SupervisorAgentWorkerDeps, 'heartbeatIntervalMs' | 'idleTtlMs'>;
  readonly runId: string;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private started = false;
  private stopped = false;

  constructor(
    public readonly scope: SupervisorAgentWorkerScope,
    deps: SupervisorAgentWorkerDeps
  ) {
    this.deps = {
      ...deps,
      heartbeatIntervalMs: deps.heartbeatIntervalMs ?? SUPERVISOR_HEARTBEAT_INTERVAL_MS,
      idleTtlMs: deps.idleTtlMs ?? SUPERVISOR_IDLE_TTL_MS,
    };
    this.runId = randomUUID();
  }

  /**
   * Persist the AgentRun row, start heartbeat + idle timers. Idempotent.
   */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const now = new Date();
    const run: AgentRun = {
      id: this.runId,
      agentType: AgentType.ClaudeCode,
      agentName: SUPERVISOR_AGENT_NAME,
      status: AgentRunStatus.running,
      prompt: `supervisor for ${scopeKey(this.scope.scopeType, this.scope.scopeId, this.scope.featureId)}`,
      threadId: `supervisor-${this.runId}`,
      pid: process.pid,
      lastHeartbeat: now,
      startedAt: now,
      featureId: this.scope.featureId,
      createdAt: now,
      updatedAt: now,
    };
    await this.deps.runRepository.create(run);

    this.heartbeatTimer = setInterval(() => {
      void this.heartbeat();
    }, this.deps.heartbeatIntervalMs);
    this.resetIdleTimer();
  }

  /**
   * Evaluate one event and forward the resulting decision to `onDecision`.
   * Resets the idle reaper.
   */
  async submit(
    event: SupervisorEvent,
    policy: SupervisorPolicy
  ): Promise<SupervisorDecisionResult> {
    if (!this.started) {
      throw new Error('SupervisorAgentWorker.submit() called before start()');
    }
    if (this.stopped) {
      throw new Error('SupervisorAgentWorker.submit() called after stop()');
    }
    this.resetIdleTimer();

    const decision = await this.deps.supervisorAgent.evaluate({ event, policy });
    if (this.deps.onDecision) {
      await this.deps.onDecision(this.scope, this.runId, event, decision);
    }
    return decision;
  }

  /** Stop heartbeat + idle timers and mark the run completed. Idempotent. */
  async stop(reason: 'reaped' | 'shutdown' = 'shutdown'): Promise<void> {
    if (!this.started || this.stopped) return;
    this.stopped = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.heartbeatTimer = undefined;
    this.idleTimer = undefined;

    try {
      const completedAt = new Date();
      await this.deps.runRepository.updateStatus(this.runId, AgentRunStatus.completed, {
        completedAt,
        updatedAt: completedAt,
        result: reason,
      });
    } catch {
      // Best-effort — DB write failure on stop is non-fatal.
    }

    if (reason === 'reaped' && this.deps.onReaped) {
      try {
        await this.deps.onReaped(this.scope, this.runId);
      } catch {
        // Best-effort.
      }
    }
  }

  isRunning(): boolean {
    return this.started && !this.stopped;
  }

  /** Reset the idle timer to the configured TTL. */
  private resetIdleTimer(): void {
    if (this.stopped) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      void this.stop('reaped');
    }, this.deps.idleTtlMs);
  }

  /** Single heartbeat tick. Failures are non-fatal. */
  private async heartbeat(): Promise<void> {
    if (this.stopped) return;
    try {
      const now = new Date();
      await this.deps.runRepository.updateStatus(this.runId, AgentRunStatus.running, {
        lastHeartbeat: now,
        updatedAt: now,
      });
    } catch {
      // Best-effort.
    }
  }
}

export type SupervisorAgentWorkerRegistryDeps = SupervisorAgentWorkerDeps;

/**
 * Lazily starts (and reaps) one worker per `(scopeType, scopeId?, featureId?)` scope.
 *
 * Production code submits events via `submitEvent`; the registry starts
 * a worker on first event for a new scope and reuses warm workers for
 * subsequent events. Idle workers reap themselves after `idleTtlMs` and
 * deregister via the registry's `onReaped` hook.
 */
export class SupervisorAgentWorkerRegistry {
  private readonly workers = new Map<string, SupervisorAgentWorker>();

  constructor(private readonly deps: SupervisorAgentWorkerRegistryDeps) {}

  /**
   * Submit one event for the given policy's scope. Starts a worker
   * lazily on first call and forwards the event to it.
   */
  async submitEvent(
    event: SupervisorEvent,
    carrier: PolicyCarrier
  ): Promise<SupervisorDecisionResult> {
    const policy = carrier.policy;
    const scope: SupervisorAgentWorkerScope = {
      scopeType: policy.scopeType,
      scopeId: policy.scopeId,
      featureId: policy.featureId,
    };
    const key = scopeKey(scope.scopeType, scope.scopeId, scope.featureId);

    let worker = this.workers.get(key);
    if (!worker) {
      worker = await this.createAndStartWorker(scope);
      this.workers.set(key, worker);
    }
    return worker.submit(event, policy);
  }

  /** Stop every active worker. Used on process shutdown. */
  async stopAll(reason: 'reaped' | 'shutdown' = 'shutdown'): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const worker of this.workers.values()) {
      promises.push(worker.stop(reason));
    }
    this.workers.clear();
    await Promise.all(promises);
  }

  /** True if a warm worker exists for the given scope. */
  hasWorker(
    scopeType: string,
    scopeId: string | undefined,
    featureId: string | undefined
  ): boolean {
    const worker = this.workers.get(scopeKey(scopeType, scopeId, featureId));
    return worker?.isRunning() ?? false;
  }

  private async createAndStartWorker(
    scope: SupervisorAgentWorkerScope
  ): Promise<SupervisorAgentWorker> {
    const key = scopeKey(scope.scopeType, scope.scopeId, scope.featureId);

    const innerOnReaped = this.deps.onReaped;
    const worker = new SupervisorAgentWorker(scope, {
      ...this.deps,
      onReaped: async (s, runId) => {
        // Drop the entry from the registry first so a follow-up event
        // boots a fresh worker rather than reusing the stopped one.
        const existing = this.workers.get(key);
        if (existing?.runId === runId) this.workers.delete(key);
        if (innerOnReaped) await innerOnReaped(s, runId);
      },
    });
    await worker.start();
    return worker;
  }
}
