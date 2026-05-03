/**
 * shep supervisor * — CLI command tests
 *
 * Each subcommand resolves its use case via the DI container; the tests
 * stub the container and assert that the right use case + inputs flow
 * through. Output is captured via spies on console.log / console.error.
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupervisorAutonomy, SupervisorScopeType } from '@/domain/generated/output.js';
import type { SupervisorPolicy } from '@/domain/generated/output.js';

const {
  mockResolve,
  configureExecute,
  statusExecute,
  enableExecute,
  disableExecute,
  approveExecute,
  rejectExecute,
} = vi.hoisted(() => ({
  mockResolve: vi.fn(),
  configureExecute: vi.fn(),
  statusExecute: vi.fn(),
  enableExecute: vi.fn(),
  disableExecute: vi.fn(),
  approveExecute: vi.fn(),
  rejectExecute: vi.fn(),
}));

vi.mock('@/infrastructure/di/container.js', () => ({
  container: {
    resolve: (...args: unknown[]) => mockResolve(...args),
  },
}));

vi.mock('@/application/use-cases/agents/configure-supervisor.use-case.js', () => ({
  ConfigureSupervisorUseCase: class {
    execute = configureExecute;
  },
}));
vi.mock('@/application/use-cases/agents/get-supervisor-policy.use-case.js', () => ({
  GetSupervisorPolicyUseCase: class {
    execute = statusExecute;
  },
}));
vi.mock('@/application/use-cases/agents/enable-supervisor.use-case.js', () => ({
  EnableSupervisorUseCase: class {
    execute = enableExecute;
  },
}));
vi.mock('@/application/use-cases/agents/disable-supervisor.use-case.js', () => ({
  DisableSupervisorUseCase: class {
    execute = disableExecute;
  },
}));
vi.mock('@/application/use-cases/agents/approve-agent-run.use-case.js', () => ({
  ApproveAgentRunUseCase: class {
    execute = approveExecute;
  },
}));
vi.mock('@/application/use-cases/agents/reject-agent-run.use-case.js', () => ({
  RejectAgentRunUseCase: class {
    execute = rejectExecute;
  },
}));

import { createConfigureCommand } from '../../../../../../src/presentation/cli/commands/supervisor/configure.command.js';
import { createStatusCommand } from '../../../../../../src/presentation/cli/commands/supervisor/status.command.js';
import { createEnableCommand } from '../../../../../../src/presentation/cli/commands/supervisor/enable.command.js';
import { createDisableCommand } from '../../../../../../src/presentation/cli/commands/supervisor/disable.command.js';
import { createApproveCommand } from '../../../../../../src/presentation/cli/commands/supervisor/approve.command.js';
import { createRejectCommand } from '../../../../../../src/presentation/cli/commands/supervisor/reject.command.js';

function policy(overrides: Partial<SupervisorPolicy> = {}): SupervisorPolicy {
  return {
    id: 'pol-1',
    scopeType: SupervisorScopeType.app,
    scopeId: 'app-1',
    enabled: true,
    autonomyLevel: SupervisorAutonomy.advisory,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('shep supervisor commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    process.exitCode = undefined;
    mockResolve.mockImplementation((cls: { name?: string }) => {
      const name = (cls as { name?: string }).name;
      switch (name) {
        case 'ConfigureSupervisorUseCase':
          return { execute: configureExecute };
        case 'GetSupervisorPolicyUseCase':
          return { execute: statusExecute };
        case 'EnableSupervisorUseCase':
          return { execute: enableExecute };
        case 'DisableSupervisorUseCase':
          return { execute: disableExecute };
        case 'ApproveAgentRunUseCase':
          return { execute: approveExecute };
        case 'RejectAgentRunUseCase':
          return { execute: rejectExecute };
        default:
          throw new Error(`Unknown class in test stub: ${name}`);
      }
    });
  });

  it('configure invokes ConfigureSupervisorUseCase with the parsed options', async () => {
    configureExecute.mockResolvedValue(policy({ autonomyLevel: SupervisorAutonomy.cosign }));

    const cmd = createConfigureCommand();
    await cmd.parseAsync(
      [
        '--scope',
        'app',
        '--scope-id',
        'app-1',
        '--autonomy',
        'cosign',
        '--merge-authority',
        'autonomous',
      ],
      { from: 'user' }
    );

    expect(configureExecute).toHaveBeenCalledOnce();
    expect(configureExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeType: 'app',
        scopeId: 'app-1',
        autonomyLevel: SupervisorAutonomy.cosign,
        gateAuthority: { merge: SupervisorAutonomy.autonomous },
      })
    );
    expect(process.exitCode).toBeUndefined();
  });

  it('status renders the resolved policy', async () => {
    statusExecute.mockResolvedValue(policy({ modelId: 'claude-sonnet' }));

    const cmd = createStatusCommand();
    await cmd.parseAsync(['--scope', 'app', '--scope-id', 'app-1'], { from: 'user' });

    expect(statusExecute).toHaveBeenCalledWith({
      scopeType: 'app',
      scopeId: 'app-1',
      featureId: undefined,
    });
    expect(process.exitCode).toBeUndefined();
  });

  it('status reports when no policy is configured', async () => {
    statusExecute.mockResolvedValue(null);
    const cmd = createStatusCommand();
    await cmd.parseAsync(['--scope', 'app', '--scope-id', 'app-2'], { from: 'user' });
    expect(process.exitCode).toBeUndefined();
  });

  it('enable invokes EnableSupervisorUseCase', async () => {
    enableExecute.mockResolvedValue(policy());
    const cmd = createEnableCommand();
    await cmd.parseAsync(['--scope', 'app', '--scope-id', 'app-1'], { from: 'user' });
    expect(enableExecute).toHaveBeenCalledWith({
      scopeType: 'app',
      scopeId: 'app-1',
      featureId: undefined,
    });
  });

  it('disable invokes DisableSupervisorUseCase', async () => {
    disableExecute.mockResolvedValue(policy({ enabled: false }));
    const cmd = createDisableCommand();
    await cmd.parseAsync(['--scope', 'app', '--scope-id', 'app-1', '--feature', 'feat-9'], {
      from: 'user',
    });
    expect(disableExecute).toHaveBeenCalledWith({
      scopeType: 'app',
      scopeId: 'app-1',
      featureId: 'feat-9',
    });
  });

  it('approve uses the supervisor:<id> actor namespace', async () => {
    approveExecute.mockResolvedValue({ approved: true, reason: 'ok' });

    const cmd = createApproveCommand();
    await cmd.parseAsync(['--run', 'run-1', '--supervisor-id', 'guardian-7'], { from: 'user' });

    expect(approveExecute).toHaveBeenCalledOnce();
    const [, , actor] = approveExecute.mock.calls[0];
    expect(actor.value).toBe('supervisor:guardian-7');
  });

  it('reject uses the supervisor:<id> actor namespace and forwards reason', async () => {
    rejectExecute.mockResolvedValue({ rejected: true, reason: 'ok', iteration: 2 });

    const cmd = createRejectCommand();
    await cmd.parseAsync(
      ['--run', 'run-2', '--reason', 'tests fail', '--supervisor-id', 'guardian'],
      { from: 'user' }
    );

    expect(rejectExecute).toHaveBeenCalledOnce();
    const [runId, reason, , actor] = rejectExecute.mock.calls[0];
    expect(runId).toBe('run-2');
    expect(reason).toBe('tests fail');
    expect(actor.value).toBe('supervisor:guardian');
  });

  it('approve sets process.exitCode = 1 when use case returns approved=false', async () => {
    approveExecute.mockResolvedValue({ approved: false, reason: 'blocked' });
    const cmd = createApproveCommand();
    await cmd.parseAsync(['--run', 'run-1'], { from: 'user' });
    expect(process.exitCode).toBe(1);
  });
});
