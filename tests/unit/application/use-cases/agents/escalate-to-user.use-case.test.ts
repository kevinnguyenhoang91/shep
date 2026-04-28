/**
 * EscalateToUserUseCase — unit tests (spec 093, task 33).
 *
 * Verifies:
 *  - Flag-off short-circuit (no notify, no activity-log write).
 *  - Flag-on dispatches NotificationEvent with the requested kind/severity.
 *  - Flag-on mirrors a single ActivityEntry with a stable actor namespace.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { EscalateToUserUseCase } from '@/application/use-cases/agents/escalate-to-user.use-case.js';
import {
  NotificationEventType,
  NotificationSeverity,
  type ActivityEntry,
  type NotificationEvent,
  type Settings,
} from '@/domain/generated/output.js';
import type { ISettingsRepository } from '@/application/ports/output/repositories/settings.repository.interface.js';
import type { INotificationService } from '@/application/ports/output/services/notification-service.interface.js';
import type { IActivityLogRepository } from '@/application/ports/output/repositories/activity-log-repository.interface.js';

function makeSettingsRepo(collaboration: boolean): ISettingsRepository {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue({ featureFlags: { collaboration } } as unknown as Settings),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

class CapturingNotificationService implements INotificationService {
  readonly events: NotificationEvent[] = [];
  notify(event: NotificationEvent): void {
    this.events.push(event);
  }
}

class CapturingActivityLog implements IActivityLogRepository {
  readonly entries: ActivityEntry[] = [];
  async create(entry: ActivityEntry): Promise<void> {
    this.entries.push({ ...entry });
  }
  async listByWorkItem(workItemId: string): Promise<ActivityEntry[]> {
    return this.entries.filter((e) => e.workItemId === workItemId).map((e) => ({ ...e }));
  }
}

describe('EscalateToUserUseCase', () => {
  let notifications: CapturingNotificationService;
  let activityLog: CapturingActivityLog;

  beforeEach(() => {
    notifications = new CapturingNotificationService();
    activityLog = new CapturingActivityLog();
  });

  function makeUseCase(flagOn: boolean): EscalateToUserUseCase {
    return new EscalateToUserUseCase(notifications, activityLog, makeSettingsRepo(flagOn));
  }

  it('returns escalated=false and writes nothing when feature flag is off', async () => {
    const useCase = makeUseCase(false);

    const result = await useCase.execute({
      eventType: NotificationEventType.SupervisorEscalated,
      severity: NotificationSeverity.Warning,
      message: 'Supervisor escalated decision',
      agentRunId: 'run-1',
      featureId: 'feat-1',
      featureName: 'feat-1',
      sourceEventId: 'gate-1',
      actorId: 'supervisor:sup-run-1',
      auditField: 'supervisor.escalation',
    });

    expect(result.escalated).toBe(false);
    expect(notifications.events).toHaveLength(0);
    expect(activityLog.entries).toHaveLength(0);
  });

  it('dispatches a NotificationEvent with the requested kind on the happy path', async () => {
    const useCase = makeUseCase(true);

    const result = await useCase.execute({
      eventType: NotificationEventType.SupervisorEscalated,
      severity: NotificationSeverity.Warning,
      message: 'Supervisor escalated decision',
      agentRunId: 'run-1',
      featureId: 'feat-1',
      featureName: 'My Feature',
      sourceEventId: 'gate-1',
      actorId: 'supervisor:sup-run-1',
      auditField: 'supervisor.escalation',
    });

    expect(result.escalated).toBe(true);
    expect(notifications.events).toHaveLength(1);
    const event = notifications.events[0];
    expect(event.eventType).toBe(NotificationEventType.SupervisorEscalated);
    expect(event.severity).toBe(NotificationSeverity.Warning);
    expect(event.message).toBe('Supervisor escalated decision');
    expect(event.agentRunId).toBe('run-1');
    expect(event.featureId).toBe('feat-1');
    expect(event.featureName).toBe('My Feature');
  });

  it('mirrors a single audit entry with the supplied actor namespace', async () => {
    const useCase = makeUseCase(true);

    await useCase.execute({
      eventType: NotificationEventType.SupervisorEscalated,
      severity: NotificationSeverity.Warning,
      message: 'Supervisor escalated decision',
      agentRunId: 'run-1',
      featureId: 'feat-1',
      featureName: 'feat-1',
      sourceEventId: 'gate-1',
      actorId: 'supervisor:sup-run-1',
      auditField: 'supervisor.escalation',
    });

    expect(activityLog.entries).toHaveLength(1);
    const entry = activityLog.entries[0];
    expect(entry.actorId).toBe('supervisor:sup-run-1');
    expect(entry.workItemId).toBe('gate-1');
    expect(entry.fieldName).toBe('supervisor.escalation');
    expect(entry.newValue).toBe(NotificationEventType.SupervisorEscalated);
  });
});
