/**
 * SendAgentMessageUseCase — unit tests (spec 093, task 12).
 *
 * Verifies:
 *  - Flag-off short-circuit (no publish, returns enabled=false).
 *  - Flag-on publish through IAgentMessageBus.
 *  - Peer-addressing rejection at the use-case boundary.
 *  - Cross-app input is preserved on the published message.
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SendAgentMessageUseCase } from '@/application/use-cases/agents/send-agent-message.use-case.js';
import type { IAgentMessageBus } from '@/application/ports/output/agents/agent-message-bus.interface.js';
import type { ISettingsRepository } from '@/application/ports/output/repositories/settings.repository.interface.js';
import type { Settings } from '@/domain/generated/output.js';
import { AgentMessageKind } from '@/domain/generated/output.js';
import { PeerAddressingForbiddenError } from '@/domain/errors/peer-addressing-forbidden.error.js';

function makeBus(overrides: Partial<IAgentMessageBus> = {}): IAgentMessageBus {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    listFor: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeSettingsRepo(collaboration: boolean): ISettingsRepository {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue({
      featureFlags: { collaboration },
    } as unknown as Settings),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

describe('SendAgentMessageUseCase', () => {
  let bus: IAgentMessageBus;
  let useCase: SendAgentMessageUseCase;

  beforeEach(() => {
    bus = makeBus();
  });

  it('returns enabled=false and does NOT publish when feature flag is off', async () => {
    useCase = new SendAgentMessageUseCase(bus, makeSettingsRepo(false));

    const result = await useCase.execute({
      appId: 'app-1',
      featureId: 'feat-1',
      fromActor: 'agent:run-1',
      fromAgentRunId: 'run-1',
      toTarget: 'broadcast',
      toKind: 'broadcast',
      messageKind: AgentMessageKind.status,
      payload: { phase: 'started' },
    });

    expect(result.enabled).toBe(false);
    expect(result.message).toBeUndefined();
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it('publishes through the bus when feature flag is on', async () => {
    useCase = new SendAgentMessageUseCase(bus, makeSettingsRepo(true));

    const result = await useCase.execute({
      appId: 'app-1',
      featureId: 'feat-1',
      fromActor: 'agent:run-1',
      fromAgentRunId: 'run-1',
      toTarget: 'broadcast',
      toKind: 'broadcast',
      messageKind: AgentMessageKind.status,
      payload: { phase: 'started' },
    });

    expect(result.enabled).toBe(true);
    expect(result.message).toBeDefined();
    expect(bus.publish).toHaveBeenCalledTimes(1);
    const sent = (bus.publish as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(sent?.appId).toBe('app-1');
    expect(sent?.featureId).toBe('feat-1');
    expect(sent?.payload).toBe(JSON.stringify({ phase: 'started' }));
    expect(sent?.id).toBeTruthy();
  });

  it('rejects peer addressing with the typed error (does not call publish)', async () => {
    useCase = new SendAgentMessageUseCase(bus, makeSettingsRepo(true));

    await expect(
      useCase.execute({
        appId: 'app-1',
        fromActor: 'agent:run-1',
        toTarget: 'run-other',
        toKind: 'peer',
        messageKind: AgentMessageKind.status,
        payload: {},
      })
    ).rejects.toBeInstanceOf(PeerAddressingForbiddenError);

    expect(bus.publish).not.toHaveBeenCalled();
  });

  it('serializes a string payload as-is', async () => {
    useCase = new SendAgentMessageUseCase(bus, makeSettingsRepo(true));

    await useCase.execute({
      appId: 'app-1',
      fromActor: 'agent:run-1',
      toTarget: 'broadcast',
      toKind: 'broadcast',
      messageKind: AgentMessageKind.info,
      payload: 'plain string payload',
    });

    const sent = (bus.publish as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(sent?.payload).toBe('plain string payload');
  });
});
