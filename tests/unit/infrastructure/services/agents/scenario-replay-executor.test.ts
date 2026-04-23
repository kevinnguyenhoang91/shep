import { describe, it, expect } from 'vitest';
import { ScenarioReplayExecutorService } from '../../../../../packages/core/src/infrastructure/services/agents/common/executors/scenario-replay-executor.service.js';
import type { Scenario } from '../../../../../packages/core/src/infrastructure/services/agents/common/executors/scenario/schema.js';
import type { AgentExecutionStreamEvent } from '../../../../../packages/core/src/application/ports/output/agents/agent-executor.interface.js';

function makeScenario(partial: Partial<Scenario> = {}): Scenario {
  return {
    version: 1,
    name: 'test',
    turns: [],
    ...partial,
  } as Scenario;
}

async function collect(
  iter: AsyncIterable<AgentExecutionStreamEvent>
): Promise<AgentExecutionStreamEvent[]> {
  const out: AgentExecutionStreamEvent[] = [];
  for await (const event of iter) {
    out.push(event);
  }
  return out;
}

describe('ScenarioReplayExecutorService', () => {
  it('emits text turns as progress events then a final result event', async () => {
    const scenario = makeScenario({
      turns: [
        { kind: 'text', text: 'Analyzing' },
        { kind: 'text', text: 'Applying' },
      ],
    });
    const executor = new ScenarioReplayExecutorService(() => scenario);

    const events = await collect(executor.executeStream('prompt'));

    const progress = events.filter((e) => e.type === 'progress');
    expect(progress.map((e) => e.content)).toEqual(['Analyzing', 'Applying']);
    expect(events[events.length - 1]?.type).toBe('result');
  });

  it('emits tool-call turns as progress events carrying a JSON envelope', async () => {
    const scenario = makeScenario({
      turns: [{ kind: 'tool-call', tool: 'writeFile', input: { path: 'a.html' } }],
    });
    const executor = new ScenarioReplayExecutorService(() => scenario);

    const events = await collect(executor.executeStream('prompt'));

    const toolProgress = events.find(
      (e) => e.type === 'progress' && e.content.includes('tool-call')
    );
    expect(toolProgress).toBeDefined();
    expect(toolProgress?.content).toContain('writeFile');
  });

  it('honors delayMs between turns (non-zero total duration)', async () => {
    const scenario = makeScenario({
      turns: [
        { kind: 'text', text: 'a', delayMs: 25 },
        { kind: 'text', text: 'b' },
      ],
    });
    const executor = new ScenarioReplayExecutorService(() => scenario);

    const start = Date.now();
    await collect(executor.executeStream('prompt'));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(25);
  });

  it('execute() returns a non-streaming result using the last text turn', async () => {
    const scenario = makeScenario({
      turns: [
        { kind: 'text', text: 'intermediate' },
        { kind: 'text', text: 'final answer' },
      ],
    });
    const executor = new ScenarioReplayExecutorService(() => scenario);

    const result = await executor.execute('prompt');
    expect(result.result).toBe('final answer');
  });

  it('execute() on empty scenario returns an empty string (safe default)', async () => {
    const executor = new ScenarioReplayExecutorService(() => makeScenario({ turns: [] }));
    const result = await executor.execute('prompt');
    expect(result.result).toBe('');
  });

  it('propagates resolver errors (e.g. scenario not set)', async () => {
    const executor = new ScenarioReplayExecutorService(() => {
      throw new Error('scenario not set');
    });
    await expect(executor.execute('prompt')).rejects.toThrow(/scenario not set/);
  });
});
