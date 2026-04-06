/**
 * Poll Agent Events Use Case
 *
 * Polls features, agent runs, and phase timings to detect state changes
 * and return notification events. Maintains per-instance cache state so
 * each SSE connection gets its own delta-detection context.
 *
 * Business Rules:
 * - First poll seeds the cache and emits no events (avoids duplicate notifications on connect)
 * - Subsequent polls emit events only for state deltas (status, lifecycle, phase completions, PR changes)
 * - Detects crashed agents (PID dead while status is running/pending)
 * - Detects interactive session lifecycle changes (booting, ready, stopped, error)
 * - Supports optional runId filtering
 */

import { injectable, inject } from 'tsyringe';
import type { NotificationEvent, Feature } from '../../../domain/generated/output.js';
import {
  AgentRunStatus,
  InteractiveSessionStatus,
  SdlcLifecycle,
  NotificationEventType,
  NotificationSeverity,
} from '../../../domain/generated/output.js';
import type { IAgentRunRepository } from '../../ports/output/agents/agent-run-repository.interface.js';
import type { IPhaseTimingRepository } from '../../ports/output/agents/phase-timing-repository.interface.js';
import type { IInteractiveSessionRepository } from '../../ports/output/repositories/interactive-session-repository.interface.js';
import type { IProcessMonitorService } from '../../ports/output/services/process-monitor.interface.js';
import { ListFeaturesUseCase } from '../features/list-features.use-case.js';

// ---------------------------------------------------------------------------
// Internal cache types
// ---------------------------------------------------------------------------

interface CachedFeatureState {
  status: AgentRunStatus | null;
  lifecycle: string;
  completedPhases: Set<string>;
  featureName: string;
  prStatus: string | undefined;
  prMergeable: boolean | undefined;
  prCiStatus: string | undefined;
  /** Set to true once we have detected and emitted a crash event for this feature. */
  crashEmitted?: boolean;
}

interface CachedSessionState {
  status: InteractiveSessionStatus;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** Payload emitted for interactive session lifecycle SSE events. */
export interface InteractiveSessionEvent {
  type:
    | 'interactive_session_booting'
    | 'interactive_session_ready'
    | 'interactive_session_stopped'
    | 'interactive_session_error';
  sessionId: string;
  featureId: string;
}

/** A single item returned by execute() — either a notification or a session event. */
export type PollEvent =
  | { kind: 'notification'; event: NotificationEvent }
  | { kind: 'interactive_session'; event: InteractiveSessionEvent };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maps SdlcLifecycle values to agent graph node names so the client
 * can derive the correct FeatureLifecyclePhase via mapPhaseNameToLifecycle().
 */
const LIFECYCLE_TO_NODE: Record<SdlcLifecycle, string> = {
  [SdlcLifecycle.Started]: 'requirements',
  [SdlcLifecycle.Analyze]: 'analyze',
  [SdlcLifecycle.Requirements]: 'requirements',
  [SdlcLifecycle.Research]: 'research',
  [SdlcLifecycle.Planning]: 'plan',
  [SdlcLifecycle.Implementation]: 'implement',
  [SdlcLifecycle.Review]: 'merge',
  [SdlcLifecycle.Maintain]: 'maintain',
  [SdlcLifecycle.Blocked]: 'blocked',
  [SdlcLifecycle.Pending]: 'pending',
  [SdlcLifecycle.Deleting]: 'blocked',
  [SdlcLifecycle.AwaitingUpstream]: 'merge',
  [SdlcLifecycle.Archived]: 'archived',
};

const STATUS_TO_EVENT: Partial<
  Record<AgentRunStatus, { eventType: NotificationEventType; severity: NotificationSeverity }>
> = {
  [AgentRunStatus.running]: {
    eventType: NotificationEventType.AgentStarted,
    severity: NotificationSeverity.Info,
  },
  [AgentRunStatus.waitingApproval]: {
    eventType: NotificationEventType.WaitingApproval,
    severity: NotificationSeverity.Warning,
  },
  [AgentRunStatus.completed]: {
    eventType: NotificationEventType.AgentCompleted,
    severity: NotificationSeverity.Success,
  },
  [AgentRunStatus.failed]: {
    eventType: NotificationEventType.AgentFailed,
    severity: NotificationSeverity.Error,
  },
  [AgentRunStatus.interrupted]: {
    eventType: NotificationEventType.AgentFailed,
    severity: NotificationSeverity.Warning,
  },
  [AgentRunStatus.cancelled]: {
    eventType: NotificationEventType.AgentFailed,
    severity: NotificationSeverity.Warning,
  },
};

/** Map agent graph node name from AgentRun.result to a phase name. */
function resultToPhase(result: string | undefined): string | undefined {
  if (!result?.startsWith('node:')) return undefined;
  return result.slice(5); // "node:analyze" -> "analyze"
}

// ---------------------------------------------------------------------------
// Use Case
// ---------------------------------------------------------------------------

@injectable()
export class PollAgentEventsUseCase {
  /** Per-connection feature state cache. */
  private readonly featureCache = new Map<string, CachedFeatureState>();

  /** Per-connection interactive session state cache. */
  private readonly sessionCache = new Map<string, CachedSessionState>();

  constructor(
    @inject(ListFeaturesUseCase)
    private readonly listFeatures: ListFeaturesUseCase,
    @inject('IAgentRunRepository')
    private readonly agentRunRepo: IAgentRunRepository,
    @inject('IPhaseTimingRepository')
    private readonly phaseTimingRepo: IPhaseTimingRepository,
    @inject('IInteractiveSessionRepository')
    private readonly sessionRepo: IInteractiveSessionRepository,
    @inject('IProcessMonitorService')
    private readonly processMonitor: IProcessMonitorService
  ) {}

  /**
   * Poll for state changes and return an array of events representing deltas
   * since the last call. The first call seeds caches and returns an empty array.
   *
   * @param runIdFilter - Optional agent run ID to restrict events to
   */
  async execute(runIdFilter?: string | null): Promise<PollEvent[]> {
    const events: PollEvent[] = [];

    // --- Feature / agent-run polling ---
    const features = await this.listFeatures.execute();

    const runIds = features.map((f) => f.agentRunId).filter((id): id is string => id != null);

    const [runs, allTimings] = await Promise.all([
      this.agentRunRepo.findByIds(runIds),
      this.phaseTimingRepo.findByRunIds(runIds),
    ]);

    // Build lookup maps for O(1) access
    const runMap = new Map(runs.map((r) => [r.id, r]));
    const timingsByRunId = new Map<string, typeof allTimings>();
    for (const t of allTimings) {
      let arr = timingsByRunId.get(t.agentRunId);
      if (!arr) {
        arr = [];
        timingsByRunId.set(t.agentRunId, arr);
      }
      arr.push(t);
    }

    for (const feature of features) {
      const run = feature.agentRunId ? (runMap.get(feature.agentRunId) ?? null) : null;
      if (!run) continue;

      // Apply runId filter if present
      if (runIdFilter && run.id !== runIdFilter) continue;

      const prev = this.featureCache.get(feature.id);

      if (!prev) {
        // First time seeing this feature -- seed cache, don't emit
        const completedPhases = new Set<string>();
        const timings = timingsByRunId.get(run.id) ?? [];
        for (const t of timings) {
          if (t.completedAt) completedPhases.add(t.phase);
        }

        this.featureCache.set(feature.id, {
          status: run.status,
          lifecycle: feature.lifecycle,
          completedPhases,
          featureName: feature.name,
          prStatus: feature.pr?.status,
          prMergeable: feature.pr?.mergeable,
          prCiStatus: feature.pr?.ciStatus,
        });
        continue;
      }

      this.detectStatusChange(prev, run, feature, events);
      this.detectCrashedAgent(prev, run, feature, events);
      this.detectFeatureNameChange(prev, run, feature, events);
      this.detectLifecycleChange(prev, run, feature, events);
      this.detectPrChanges(prev, run, feature, events);
      this.detectPhaseCompletions(prev, run, feature, timingsByRunId, events);
    }

    // --- Interactive session polling ---
    await this.pollInteractiveSessions(events);

    return events;
  }

  // -----------------------------------------------------------------------
  // Private delta detection methods
  // -----------------------------------------------------------------------

  private detectStatusChange(
    prev: CachedFeatureState,
    run: { id: string; status: AgentRunStatus; result?: string },
    feature: Feature,
    events: PollEvent[]
  ): void {
    if (prev.status === run.status) return;
    prev.status = run.status;

    const mapping = STATUS_TO_EVENT[run.status];
    if (!mapping) return;

    const phase = resultToPhase(run.result);
    events.push({
      kind: 'notification',
      event: {
        eventType: mapping.eventType,
        agentRunId: run.id,
        featureId: feature.id,
        featureName: feature.name,
        ...(phase && { phaseName: phase }),
        message: `Agent status: ${run.status}`,
        severity: mapping.severity,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private detectCrashedAgent(
    prev: CachedFeatureState,
    run: { id: string; status: AgentRunStatus; pid?: number; result?: string },
    feature: Feature,
    events: PollEvent[]
  ): void {
    const isActive = run.status === AgentRunStatus.running || run.status === AgentRunStatus.pending;
    if (!isActive || !run.pid || prev.crashEmitted) return;
    if (this.processMonitor.isAlive(run.pid)) return;

    prev.crashEmitted = true;
    const phase = resultToPhase(run.result);
    events.push({
      kind: 'notification',
      event: {
        eventType: NotificationEventType.AgentFailed,
        agentRunId: run.id,
        featureId: feature.id,
        featureName: feature.name,
        ...(phase && { phaseName: phase }),
        message: `Agent crashed (PID ${run.pid} dead)`,
        severity: NotificationSeverity.Error,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private detectFeatureNameChange(
    prev: CachedFeatureState,
    run: { id: string },
    feature: Feature,
    events: PollEvent[]
  ): void {
    if (prev.featureName === feature.name) return;
    prev.featureName = feature.name;

    const nodeName = LIFECYCLE_TO_NODE[feature.lifecycle as SdlcLifecycle] ?? 'requirements';
    events.push({
      kind: 'notification',
      event: {
        eventType: NotificationEventType.PhaseCompleted,
        agentRunId: run.id,
        featureId: feature.id,
        featureName: feature.name,
        phaseName: nodeName,
        message: `Feature metadata updated`,
        severity: NotificationSeverity.Info,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private detectLifecycleChange(
    prev: CachedFeatureState,
    run: { id: string },
    feature: Feature,
    events: PollEvent[]
  ): void {
    if (prev.lifecycle === feature.lifecycle) return;

    const prevLifecycle = prev.lifecycle;
    prev.lifecycle = feature.lifecycle;
    const nodeName = LIFECYCLE_TO_NODE[feature.lifecycle as SdlcLifecycle];

    // Emit MergeReviewReady when lifecycle transitions TO Review
    if (feature.lifecycle === SdlcLifecycle.Review && prevLifecycle !== SdlcLifecycle.Review) {
      const prUrl = feature.pr?.url;
      const message = prUrl ? `Ready for merge review — PR: ${prUrl}` : 'Ready for merge review';
      events.push({
        kind: 'notification',
        event: {
          eventType: NotificationEventType.MergeReviewReady,
          agentRunId: run.id,
          featureId: feature.id,
          featureName: feature.name,
          phaseName: 'merge',
          message,
          severity: NotificationSeverity.Info,
          timestamp: new Date().toISOString(),
        },
      });
    } else if (nodeName) {
      events.push({
        kind: 'notification',
        event: {
          eventType: NotificationEventType.PhaseCompleted,
          agentRunId: run.id,
          featureId: feature.id,
          featureName: feature.name,
          phaseName: nodeName,
          message: `Entered ${nodeName} phase`,
          severity: NotificationSeverity.Info,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  private detectPrChanges(
    prev: CachedFeatureState,
    run: { id: string },
    feature: Feature,
    events: PollEvent[]
  ): void {
    const curPrStatus = feature.pr?.status;
    const curMergeable = feature.pr?.mergeable;
    const curCiStatus = feature.pr?.ciStatus;

    if (
      curPrStatus === prev.prStatus &&
      curMergeable === prev.prMergeable &&
      curCiStatus === prev.prCiStatus
    ) {
      return;
    }

    prev.prStatus = curPrStatus;
    prev.prMergeable = curMergeable;
    prev.prCiStatus = curCiStatus;

    const nodeName = LIFECYCLE_TO_NODE[feature.lifecycle as SdlcLifecycle] ?? 'merge';
    events.push({
      kind: 'notification',
      event: {
        eventType: NotificationEventType.PhaseCompleted,
        agentRunId: run.id,
        featureId: feature.id,
        featureName: feature.name,
        phaseName: nodeName,
        message:
          curMergeable === false
            ? `PR #${feature.pr?.number} has merge conflicts`
            : `PR status updated`,
        severity: curMergeable === false ? NotificationSeverity.Warning : NotificationSeverity.Info,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private detectPhaseCompletions(
    prev: CachedFeatureState,
    run: { id: string },
    feature: Feature,
    timingsByRunId: Map<string, { phase: string; completedAt?: Date | null; agentRunId: string }[]>,
    events: PollEvent[]
  ): void {
    const timings = timingsByRunId.get(run.id) ?? [];
    for (const t of timings) {
      if (t.completedAt && !prev.completedPhases.has(t.phase)) {
        prev.completedPhases.add(t.phase);
        events.push({
          kind: 'notification',
          event: {
            eventType: NotificationEventType.PhaseCompleted,
            agentRunId: run.id,
            featureId: feature.id,
            featureName: feature.name,
            phaseName: t.phase,
            message: `Completed ${t.phase} phase`,
            severity: NotificationSeverity.Info,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
  }

  private async pollInteractiveSessions(events: PollEvent[]): Promise<void> {
    try {
      const activeSessions = await this.sessionRepo.findAllActive();

      for (const session of activeSessions) {
        const prev = this.sessionCache.get(session.id);
        if (prev?.status !== session.status) {
          this.sessionCache.set(session.id, { status: session.status });
          const eventType =
            session.status === InteractiveSessionStatus.booting
              ? 'interactive_session_booting'
              : session.status === InteractiveSessionStatus.ready
                ? 'interactive_session_ready'
                : session.status === InteractiveSessionStatus.error
                  ? 'interactive_session_error'
                  : 'interactive_session_stopped';
          events.push({
            kind: 'interactive_session',
            event: { type: eventType, sessionId: session.id, featureId: session.featureId },
          });
        }
      }

      // Emit stopped/error events for sessions that disappeared from active list
      for (const [sessionId, cached] of this.sessionCache) {
        if (
          (cached.status === InteractiveSessionStatus.booting ||
            cached.status === InteractiveSessionStatus.ready) &&
          !activeSessions.find((s) => s.id === sessionId)
        ) {
          // Session no longer active -- fetch to get final status
          const session = await this.sessionRepo.findById(sessionId);
          if (session) {
            this.sessionCache.set(sessionId, { status: session.status });
            const eventType =
              session.status === InteractiveSessionStatus.error
                ? 'interactive_session_error'
                : 'interactive_session_stopped';
            events.push({
              kind: 'interactive_session',
              event: { type: eventType, sessionId: session.id, featureId: session.featureId },
            });
          } else {
            this.sessionCache.delete(sessionId);
          }
        }
      }
    } catch {
      // Ignore interactive session poll errors to not affect main polling
    }
  }
}
