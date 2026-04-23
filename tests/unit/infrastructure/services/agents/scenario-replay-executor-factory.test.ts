import { describe, it, expect, beforeEach } from 'vitest';
import type { AgentType } from '../../../../../packages/core/src/domain/generated/output.js';
import { ScenarioReplayExecutorFactory } from '../../../../../packages/core/src/infrastructure/services/agents/common/executors/scenario-replay-executor-factory.service.js';
import { runWithScenario } from '../../../../../packages/core/src/infrastructure/services/agents/common/executors/scenario/scenario-scope.js';
import type { Scenario } from '../../../../../packages/core/src/infrastructure/services/agents/common/executors/scenario/schema.js';

function makeMap(entries: [string, Scenario][]): Map<string, Scenario> {
  return new Map(entries);
}

function s(name: string, text = 'hi'): Scenario {
  return { version: 1, name, turns: [{ kind: 'text', text }] } as Scenario;
}

describe('ScenarioReplayExecutorFactory', () => {
  let factory: ScenarioReplayExecutorFactory;

  beforeEach(() => {
    factory = new ScenarioReplayExecutorFactory(makeMap([['golden', s('golden', 'GOLDEN')]]));
  });

  it('createExecutor returns an executor that resolves the current scenario', async () => {
    const executor = factory.createExecutor('claude-code' as AgentType, {} as never);
    const result = await runWithScenario('golden', () => executor.execute('prompt'));
    expect(result.result).toBe('GOLDEN');
  });

  it('throws a clear error when no scenario is in scope', async () => {
    const executor = factory.createExecutor('claude-code' as AgentType, {} as never);
    await expect(executor.execute('prompt')).rejects.toThrow(/no e2e scenario/i);
  });

  it('throws a clear error when the scoped scenario name is unknown', async () => {
    const executor = factory.createExecutor('claude-code' as AgentType, {} as never);
    await expect(
      runWithScenario('does-not-exist', () => executor.execute('prompt'))
    ).rejects.toThrow(/does-not-exist/);
  });

  it('getSupportedAgents returns a single entry (claude-code)', () => {
    expect(factory.getSupportedAgents()).toEqual(['claude-code']);
  });

  it('supportsInteractive is false', () => {
    expect(factory.supportsInteractive('claude-code' as AgentType)).toBe(false);
  });
});
