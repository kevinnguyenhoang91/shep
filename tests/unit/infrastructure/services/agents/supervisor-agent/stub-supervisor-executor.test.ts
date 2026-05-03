/**
 * StubSupervisorAgentExecutor — unit tests
 *
 * Verifies that the deterministic stub returns the configured verdict per
 * event kind and snapshots modelId / promptVersion on every decision so
 * the surrounding use case can persist them as audit data.
 */

import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { StubSupervisorAgentExecutor } from '@/infrastructure/services/agents/supervisor-agent/stub-supervisor-executor.js';
import {
  SupervisorAutonomy,
  SupervisorVerdict,
  type SupervisorPolicy,
} from '@/domain/generated/output.js';
import type {
  SupervisorGateEvent,
  SupervisorMessageEvent,
  SupervisorQuestionEvent,
} from '@/application/ports/output/agents/supervisor-agent.interface.js';

function makePolicy(overrides: Partial<SupervisorPolicy> = {}): SupervisorPolicy {
  const now = new Date();
  return {
    id: 'pol-1',
    scopeType: 'app',
    scopeId: 'app-1',
    enabled: true,
    autonomyLevel: SupervisorAutonomy.advisory,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as SupervisorPolicy;
}

describe('StubSupervisorAgentExecutor', () => {
  it('returns the default verdict for a gate event', async () => {
    const stub = new StubSupervisorAgentExecutor();
    const event: SupervisorGateEvent = {
      kind: 'gate',
      scopeType: 'app',
      scopeId: 'app-1',
      agentRunId: 'run-1',
      gateId: 'prd',
      sourceEventId: 'gate-1',
    };
    const decision = await stub.evaluate({ event, policy: makePolicy() });
    expect(decision.verdict).toBe(SupervisorVerdict.advise);
    expect(decision.rationale).toMatch(/gate/);
  });

  it('returns the default escalate verdict for a question event', async () => {
    const stub = new StubSupervisorAgentExecutor();
    const event: SupervisorQuestionEvent = {
      kind: 'question',
      scopeType: 'app',
      scopeId: 'app-1',
      agentRunId: 'run-1',
      questionId: 'q-1',
      questionKind: 'blocking',
      prompt: 'which library should I use?',
      sourceEventId: 'q-1',
    };
    const decision = await stub.evaluate({ event, policy: makePolicy() });
    expect(decision.verdict).toBe(SupervisorVerdict.escalate);
  });

  it('returns the default verdict for a message event', async () => {
    const stub = new StubSupervisorAgentExecutor();
    const event: SupervisorMessageEvent = {
      kind: 'message',
      scopeType: 'app',
      scopeId: 'app-1',
      messageId: 'm-1',
      messageKind: 'status',
      fromActor: 'agent:run-1',
      toTarget: 'broadcast',
      payload: '{}',
      sourceEventId: 'm-1',
    };
    const decision = await stub.evaluate({ event, policy: makePolicy() });
    expect(decision.verdict).toBe(SupervisorVerdict.advise);
  });

  it('honors per-kind verdict overrides', async () => {
    const stub = new StubSupervisorAgentExecutor({
      verdicts: {
        gate: {
          verdict: SupervisorVerdict.approve,
          rationale: 'auto-approved by stub',
          ruleRef: 'rule-42',
          confidence: 0.9,
        },
      },
    });
    const event: SupervisorGateEvent = {
      kind: 'gate',
      scopeType: 'app',
      scopeId: 'app-1',
      agentRunId: 'run-1',
      gateId: 'merge',
      sourceEventId: 'gate-2',
    };
    const decision = await stub.evaluate({ event, policy: makePolicy() });
    expect(decision.verdict).toBe(SupervisorVerdict.approve);
    expect(decision.rationale).toBe('auto-approved by stub');
    expect(decision.ruleRef).toBe('rule-42');
    expect(decision.confidence).toBe(0.9);
  });

  it('snapshots modelId and promptVersion on every decision', async () => {
    const stub = new StubSupervisorAgentExecutor({
      modelId: 'test-model',
      promptVersion: 'eval-v3',
    });
    const event: SupervisorGateEvent = {
      kind: 'gate',
      scopeType: 'app',
      scopeId: 'app-1',
      agentRunId: 'run-1',
      gateId: 'prd',
      sourceEventId: 'gate-1',
    };
    const decision = await stub.evaluate({ event, policy: makePolicy() });
    expect(decision.modelId).toBe('test-model');
    expect(decision.promptVersion).toBe('eval-v3');
  });
});
