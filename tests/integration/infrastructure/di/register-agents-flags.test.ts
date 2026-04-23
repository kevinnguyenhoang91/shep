import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { container } from 'tsyringe';

import type { IAgentExecutorFactory } from '../../../../packages/core/src/application/ports/output/agents/agent-executor-factory.interface.js';
import { registerAgents } from '../../../../packages/core/src/infrastructure/di/modules/register-agents.js';

// Bare-minimum stub for the settings repo dependency (used only by the
// provider wiring, not by the factory selection we're testing).
class StubSettingsRepo {
  async load(): Promise<never> {
    throw new Error('not used in flag-selection tests');
  }
  async save(): Promise<void> {
    // no-op
  }
}

const originalMockEnv = process.env.SHEP_MOCK_EXECUTOR;
const originalE2eEnv = process.env.SHEP_E2E_MOCK_AGENT;
const originalScenariosDir = process.env.SHEP_E2E_SCENARIOS_DIR;

let scenariosDir: string;

beforeAll(() => {
  // Create a temp directory with one valid scenario so the sync loader
  // succeeds when we flip the E2E flag on.
  scenariosDir = mkdtempSync(join(tmpdir(), 'shep-di-scenarios-'));
  writeFileSync(
    join(scenariosDir, 'smoke.scenario.yaml'),
    ['version: 1', 'name: smoke', 'turns: []'].join('\n'),
    'utf-8'
  );
});

afterAll(() => {
  rmSync(scenariosDir, { recursive: true, force: true });
});

beforeEach(() => {
  delete process.env.SHEP_MOCK_EXECUTOR;
  delete process.env.SHEP_E2E_MOCK_AGENT;
  delete process.env.SHEP_E2E_SCENARIOS_DIR;
  container.reset();
  container.register('ISettingsRepository', { useFactory: () => new StubSettingsRepo() });
});

afterEach(() => {
  if (originalMockEnv === undefined) delete process.env.SHEP_MOCK_EXECUTOR;
  else process.env.SHEP_MOCK_EXECUTOR = originalMockEnv;
  if (originalE2eEnv === undefined) delete process.env.SHEP_E2E_MOCK_AGENT;
  else process.env.SHEP_E2E_MOCK_AGENT = originalE2eEnv;
  if (originalScenariosDir === undefined) delete process.env.SHEP_E2E_SCENARIOS_DIR;
  else process.env.SHEP_E2E_SCENARIOS_DIR = originalScenariosDir;
  container.reset();
});

describe('registerAgents flag selection', () => {
  it('binds real AgentExecutorFactory when no flags are set', () => {
    registerAgents(container);
    const factory = container.resolve<IAgentExecutorFactory>('IAgentExecutorFactory');
    expect(factory.constructor.name).toBe('AgentExecutorFactory');
  });

  it('binds MockAgentExecutorFactory when SHEP_MOCK_EXECUTOR=1 alone', () => {
    process.env.SHEP_MOCK_EXECUTOR = '1';
    registerAgents(container);
    const factory = container.resolve<IAgentExecutorFactory>('IAgentExecutorFactory');
    expect(factory.constructor.name).toBe('MockAgentExecutorFactory');
  });

  it('binds ScenarioReplayExecutorFactory when SHEP_E2E_MOCK_AGENT=1', () => {
    process.env.SHEP_E2E_MOCK_AGENT = '1';
    process.env.SHEP_E2E_SCENARIOS_DIR = scenariosDir;
    registerAgents(container);
    const factory = container.resolve<IAgentExecutorFactory>('IAgentExecutorFactory');
    expect(factory.constructor.name).toBe('ScenarioReplayExecutorFactory');
  });

  it('SHEP_E2E_MOCK_AGENT wins when both flags are set', () => {
    process.env.SHEP_MOCK_EXECUTOR = '1';
    process.env.SHEP_E2E_MOCK_AGENT = '1';
    process.env.SHEP_E2E_SCENARIOS_DIR = scenariosDir;
    registerAgents(container);
    const factory = container.resolve<IAgentExecutorFactory>('IAgentExecutorFactory');
    expect(factory.constructor.name).toBe('ScenarioReplayExecutorFactory');
  });
});
