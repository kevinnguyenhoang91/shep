/**
 * Scenario Replay Agent Executor
 *
 * Streams scripted turns from a test scenario as AgentExecutionStreamEvents.
 * Activated via SHEP_E2E_MOCK_AGENT=1 so production DI is untouched.
 *
 * Text turns → `progress` events carrying the text.
 * Tool-call turns → `progress` events carrying a JSON envelope so the
 * consuming UI / logs can surface them. Real tool execution (file writes)
 * is NOT performed here — the real `IApplicationScaffolder` still runs
 * for setup-time artifacts; scenarios only mock the LLM surface.
 *
 * The scenario is resolved lazily via a caller-supplied function so
 * per-request selection (AsyncLocalStorage in the factory) stays out of
 * this class.
 */

import type { AgentType, AgentFeature } from '../../../../../domain/generated/output.js';
import type {
  IAgentExecutor,
  AgentExecutionOptions,
  AgentExecutionResult,
  AgentExecutionStreamEvent,
} from '../../../../../application/ports/output/agents/agent-executor.interface.js';
import type { Scenario, ScenarioTurn } from './scenario/schema.js';

export type ScenarioResolver = () => Scenario;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toolCallEnvelope(turn: Extract<ScenarioTurn, { kind: 'tool-call' }>): string {
  return JSON.stringify({
    kind: 'tool-call',
    tool: turn.tool,
    input: turn.input ?? {},
    result: turn.result,
  });
}

export class ScenarioReplayExecutorService implements IAgentExecutor {
  readonly agentType: AgentType = 'claude-code' as AgentType;

  constructor(private readonly resolveScenario: ScenarioResolver) {}

  async execute(_prompt: string, _options?: AgentExecutionOptions): Promise<AgentExecutionResult> {
    const scenario = this.resolveScenario();
    const lastText = [...scenario.turns]
      .reverse()
      .find((t): t is Extract<ScenarioTurn, { kind: 'text' }> => t.kind === 'text');

    return {
      result: lastText?.text ?? '',
      metadata: { scenarioName: scenario.name, turnCount: scenario.turns.length },
    };
  }

  async *executeStream(
    _prompt: string,
    _options?: AgentExecutionOptions
  ): AsyncIterable<AgentExecutionStreamEvent> {
    const scenario = this.resolveScenario();

    let finalText = '';

    for (const turn of scenario.turns) {
      if (turn.delayMs !== undefined && turn.delayMs > 0) {
        await sleep(turn.delayMs);
      }

      if (turn.kind === 'text') {
        finalText = turn.text;
        yield { type: 'progress', content: turn.text, timestamp: new Date() };
      } else {
        yield { type: 'progress', content: toolCallEnvelope(turn), timestamp: new Date() };
      }
    }

    yield { type: 'result', content: finalText, timestamp: new Date() };
  }

  supportsFeature(_feature: AgentFeature): boolean {
    return false;
  }
}
