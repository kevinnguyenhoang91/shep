/**
 * shep agent message send — CLI command tests
 *
 * Exercises the dev-mode guard, payload parsing, and forwarding to
 * SendAgentMessageUseCase.
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentMessageKind } from '@/domain/generated/output.js';

const { mockResolve, sendExecute } = vi.hoisted(() => ({
  mockResolve: vi.fn(),
  sendExecute: vi.fn(),
}));

vi.mock('@/infrastructure/di/container.js', () => ({
  container: {
    resolve: (...args: unknown[]) => mockResolve(...args),
  },
}));

vi.mock('@/application/use-cases/agents/send-agent-message.use-case.js', () => ({
  SendAgentMessageUseCase: class {
    execute = sendExecute;
  },
}));

vi.mock('@/infrastructure/services/settings.service.js', () => ({
  getSettings: () => ({ featureFlags: { collaboration: true, debug: false } }),
  hasSettings: () => true,
}));

import { createSendCommand } from '../../../../../../../src/presentation/cli/commands/agent/message/send.command.js';
import { createMessageCommand } from '../../../../../../../src/presentation/cli/commands/agent/message/index.js';

describe('shep agent message send', () => {
  const originalEnv = process.env.SHEP_DEV_TOOLS;
  const originalNode = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    process.exitCode = undefined;
    process.env.SHEP_DEV_TOOLS = '1';
    (process.env as Record<string, string>).NODE_ENV = 'development';
    mockResolve.mockReturnValue({ execute: sendExecute });
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.SHEP_DEV_TOOLS;
    else process.env.SHEP_DEV_TOOLS = originalEnv;
    const env = process.env as Record<string, string | undefined>;
    if (originalNode === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = originalNode;
  });

  it('publishes a message via SendAgentMessageUseCase', async () => {
    sendExecute.mockResolvedValue({
      enabled: true,
      message: { id: 'msg-1' },
    });

    const cmd = createSendCommand();
    await cmd.parseAsync(
      [
        '--app',
        'app-1',
        '--from-actor',
        'agent:run-1',
        '--to-target',
        'broadcast',
        '--to-kind',
        'broadcast',
        '--message-kind',
        'status',
        '--payload',
        '{"phase":"started"}',
      ],
      { from: 'user' }
    );

    expect(sendExecute).toHaveBeenCalledOnce();
    expect(sendExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'app-1',
        fromActor: 'agent:run-1',
        toTarget: 'broadcast',
        toKind: 'broadcast',
        messageKind: AgentMessageKind.status,
        payload: { phase: 'started' },
      })
    );
    expect(process.exitCode).toBeUndefined();
  });

  it('refuses to run when SHEP_DEV_TOOLS is unset and NODE_ENV=production', async () => {
    delete process.env.SHEP_DEV_TOOLS;
    (process.env as Record<string, string>).NODE_ENV = 'production';

    const cmd = createSendCommand();
    await cmd.parseAsync(
      ['--app', 'app-1', '--from-actor', 'agent:r', '--to-target', 'broadcast', '--payload', '{}'],
      { from: 'user' }
    );

    expect(sendExecute).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it('surfaces a non-zero exit code when the flag is off', async () => {
    sendExecute.mockResolvedValue({ enabled: false });

    const cmd = createSendCommand();
    await cmd.parseAsync(
      ['--app', 'app-1', '--from-actor', 'agent:r', '--to-target', 'broadcast', '--payload', '{}'],
      { from: 'user' }
    );

    expect(process.exitCode).toBe(1);
  });

  it('hides the message command in production', () => {
    delete process.env.SHEP_DEV_TOOLS;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    const cmd = createMessageCommand();
    expect((cmd as unknown as { _hidden?: boolean })._hidden).toBe(true);
  });
});
