/**
 * InMemorySupervisorAgent — unit tests
 *
 * Verifies that the in-memory adapter forwards evaluate() to the wrapped
 * stub executor without side effects.
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { InMemorySupervisorAgent } from '@/infrastructure/adapters/in-memory/in-memory-supervisor-agent.js';
import {
  SupervisorAutonomy,
  SupervisorVerdict,
  type SupervisorPolicy,
} from '@/domain/generated/output.js';
import type { SupervisorGateEvent } from '@/application/ports/output/agents/supervisor-agent.interface.js';

function makePolicy(): SupervisorPolicy {
  const now = new Date();
  return {
    id: 'pol-1',
    scopeType: 'app',
    scopeId: 'app-1',
    enabled: true,
    autonomyLevel: SupervisorAutonomy.advisory,
    createdAt: now,
    updatedAt: now,
  } as SupervisorPolicy;
}

describe('InMemorySupervisorAgent', () => {
  it('returns the canned verdict for a gate event', async () => {
    const adapter = new InMemorySupervisorAgent();
    const event: SupervisorGateEvent = {
      kind: 'gate',
      scopeType: 'app',
      scopeId: 'app-1',
      agentRunId: 'run-1',
      gateId: 'plan',
      sourceEventId: 'gate-1',
    };
    const decision = await adapter.evaluate({ event, policy: makePolicy() });
    expect(decision.verdict).toBe(SupervisorVerdict.advise);
    expect(decision.modelId).toBeDefined();
    expect(decision.promptVersion).toBeDefined();
  });

  it('honors verdict overrides supplied via the constructor', async () => {
    const adapter = new InMemorySupervisorAgent({
      verdicts: {
        gate: {
          verdict: SupervisorVerdict.approve,
          rationale: 'override',
        },
      },
      modelId: 'm-1',
      promptVersion: 'p-1',
    });
    const decision = await adapter.evaluate({
      event: {
        kind: 'gate',
        scopeType: 'app',
        scopeId: 'app-1',
        agentRunId: 'run-1',
        gateId: 'merge',
        sourceEventId: 'gate-2',
      },
      policy: makePolicy(),
    });
    expect(decision.verdict).toBe(SupervisorVerdict.approve);
    expect(decision.rationale).toBe('override');
    expect(decision.modelId).toBe('m-1');
    expect(decision.promptVersion).toBe('p-1');
  });
});
