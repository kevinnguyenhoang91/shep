/**
 * EvaluateSupervisorDecisionUseCase — unit tests (spec 093, task 27).
 *
 * Verifies the four short-circuit / happy-path contracts from the task
 * acceptance criteria:
 *   - flag-off → returns null, writes nothing
 *   - no policy → returns null, writes nothing
 *   - flag-on + policy → persists decision and mirrors to activity_log
 *   - mirror payload carries the supervisor:<id> actor namespace
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { EvaluateSupervisorDecisionUseCase } from '@/application/use-cases/agents/evaluate-supervisor-decision.use-case.js';
import { GetSupervisorPolicyUseCase } from '@/application/use-cases/agents/get-supervisor-policy.use-case.js';
import { ConfigureSupervisorUseCase } from '@/application/use-cases/agents/configure-supervisor.use-case.js';
import { InMemorySupervisorPolicyRepository } from '@/infrastructure/adapters/in-memory/in-memory-supervisor-policy-repository.js';
import { InMemorySupervisorDecisionRepository } from '@/infrastructure/adapters/in-memory/in-memory-supervisor-decision-repository.js';
import { InMemorySupervisorAgent } from '@/infrastructure/adapters/in-memory/in-memory-supervisor-agent.js';
import {
  SupervisorAutonomy,
  SupervisorVerdict,
  type ActivityEntry,
  type Settings,
} from '@/domain/generated/output.js';
import type { ISettingsRepository } from '@/application/ports/output/repositories/settings.repository.interface.js';
import type { IActivityLogRepository } from '@/application/ports/output/repositories/activity-log-repository.interface.js';
import type { SupervisorGateEvent } from '@/application/ports/output/agents/supervisor-agent.interface.js';

function makeSettingsRepo(collaboration: boolean): ISettingsRepository {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue({ featureFlags: { collaboration } } as unknown as Settings),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

class InMemoryActivityLogRepository implements IActivityLogRepository {
  readonly entries: ActivityEntry[] = [];
  async create(entry: ActivityEntry): Promise<void> {
    this.entries.push({ ...entry });
  }
  async listByWorkItem(workItemId: string): Promise<ActivityEntry[]> {
    return this.entries.filter((e) => e.workItemId === workItemId).map((e) => ({ ...e }));
  }
}

function gateEvent(): SupervisorGateEvent {
  return {
    kind: 'gate',
    appId: 'app-1',
    agentRunId: 'run-1',
    gateId: 'plan',
    sourceEventId: 'gate-1',
  };
}

describe('EvaluateSupervisorDecisionUseCase', () => {
  let policyRepo: InMemorySupervisorPolicyRepository;
  let decisionRepo: InMemorySupervisorDecisionRepository;
  let activityLog: InMemoryActivityLogRepository;
  let supervisorAgent: InMemorySupervisorAgent;
  let configure: ConfigureSupervisorUseCase;
  let getPolicy: GetSupervisorPolicyUseCase;

  beforeEach(() => {
    policyRepo = new InMemorySupervisorPolicyRepository();
    decisionRepo = new InMemorySupervisorDecisionRepository();
    activityLog = new InMemoryActivityLogRepository();
    supervisorAgent = new InMemorySupervisorAgent();
    configure = new ConfigureSupervisorUseCase(policyRepo);
    getPolicy = new GetSupervisorPolicyUseCase(policyRepo);
  });

  function makeUseCase(flagOn: boolean): EvaluateSupervisorDecisionUseCase {
    return new EvaluateSupervisorDecisionUseCase(
      supervisorAgent,
      decisionRepo,
      activityLog,
      makeSettingsRepo(flagOn),
      getPolicy
    );
  }

  it('returns evaluated=false with skippedReason="flag-off" when flag is off', async () => {
    await configure.execute({
      appId: 'app-1',
      autonomyLevel: SupervisorAutonomy.advisory,
    });
    const useCase = makeUseCase(false);
    const result = await useCase.execute({
      event: gateEvent(),
      supervisorRunId: 'sup-run-1',
    });
    expect(result.evaluated).toBe(false);
    expect(result.skippedReason).toBe('flag-off');
    expect(result.decision).toBeUndefined();
    expect(activityLog.entries).toHaveLength(0);
  });

  it('returns evaluated=false with skippedReason="no-policy" when no policy exists for the scope', async () => {
    const useCase = makeUseCase(true);
    const result = await useCase.execute({
      event: gateEvent(),
      supervisorRunId: 'sup-run-1',
    });
    expect(result.evaluated).toBe(false);
    expect(result.skippedReason).toBe('no-policy');
    expect(result.decision).toBeUndefined();
    expect(activityLog.entries).toHaveLength(0);
  });

  it('persists a SupervisorDecision and mirrors to activity_log on the happy path', async () => {
    await configure.execute({
      appId: 'app-1',
      autonomyLevel: SupervisorAutonomy.advisory,
    });
    const useCase = makeUseCase(true);

    const result = await useCase.execute({
      event: gateEvent(),
      supervisorRunId: 'sup-run-1',
    });

    expect(result.evaluated).toBe(true);
    expect(result.decision).toBeDefined();
    expect(result.decision?.verdict).toBe(SupervisorVerdict.advise);
    expect(result.decision?.appId).toBe('app-1');
    expect(result.decision?.sourceEventId).toBe('gate-1');
    expect(result.decision?.sourceEventKind).toBe('gate');
    expect(result.decision?.modelId).toBeDefined();
    expect(result.decision?.promptVersion).toBeDefined();
    expect(result.decision?.supervisorRunId).toBe('sup-run-1');

    // The decision row was persisted.
    const persisted = await decisionRepo.findById(result.decision!.id);
    expect(persisted?.id).toBe(result.decision!.id);

    // Activity log mirror has the supervisor actor namespace and the
    // verdict as newValue.
    expect(activityLog.entries).toHaveLength(1);
    const entry = activityLog.entries[0];
    expect(entry.actorId).toBe('supervisor:sup-run-1');
    expect(entry.workItemId).toBe('gate-1');
    expect(entry.fieldName).toBe('supervisor.gate');
    expect(entry.newValue).toBe(SupervisorVerdict.advise);
  });

  it('uses the feature-scoped policy when both feature and app rows exist', async () => {
    await configure.execute({
      appId: 'app-1',
      autonomyLevel: SupervisorAutonomy.advisory,
    });
    const featurePolicy = await configure.execute({
      appId: 'app-1',
      featureId: 'feat-7',
      autonomyLevel: SupervisorAutonomy.cosign,
    });
    const useCase = makeUseCase(true);

    const result = await useCase.execute({
      event: { ...gateEvent(), featureId: 'feat-7' },
      supervisorRunId: 'sup-run-1',
    });

    expect(result.evaluated).toBe(true);
    // The persisted decision carries the feature scope.
    expect(result.decision?.featureId).toBe('feat-7');
    // The supervisor saw the feature-scoped policy via the resolution
    // helper; we verify by re-fetching what the helper would return.
    const resolved = await getPolicy.execute({ appId: 'app-1', featureId: 'feat-7' });
    expect(resolved?.id).toBe(featurePolicy.id);
  });
});
