/**
 * Scenario Replay Agent Executor Factory
 *
 * Serves a ScenarioReplayExecutorService that resolves its active
 * scenario per-request via AsyncLocalStorage. This lets a single web
 * server handle parallel Playwright tests, each using a different
 * scenario, without any mutable module state.
 *
 * Activated via SHEP_E2E_MOCK_AGENT=1 in `register-agents.ts`.
 */

import type { AgentType, AgentConfig } from '../../../../../domain/generated/output.js';
import type { IAgentExecutor } from '../../../../../application/ports/output/agents/agent-executor.interface.js';
import type { IInteractiveAgentExecutor } from '../../../../../application/ports/output/agents/interactive-agent-executor.interface.js';
import type {
  IAgentExecutorFactory,
  AgentCliInfo,
  AgentModelListing,
} from '../../../../../application/ports/output/agents/agent-executor-factory.interface.js';

import { ScenarioReplayExecutorService } from './scenario-replay-executor.service.js';
import { currentScenarioName } from './scenario/scenario-scope.js';
import { getScenario } from './scenario/loader.js';
import type { Scenario } from './scenario/schema.js';

export class ScenarioReplayExecutorFactory implements IAgentExecutorFactory {
  constructor(private readonly scenarios: Map<string, Scenario>) {}

  createExecutor(_agentType: AgentType, _authConfig: AgentConfig): IAgentExecutor {
    return new ScenarioReplayExecutorService(() => {
      const name = currentScenarioName();
      if (!name) {
        throw new Error(
          'No e2e scenario in scope. Ensure the web request passed through the ' +
            'scenario-scope middleware before resolving the agent executor.'
        );
      }
      return getScenario(this.scenarios, name);
    });
  }

  getSupportedAgents(): AgentType[] {
    return ['claude-code' as AgentType];
  }

  getCliInfo(): AgentCliInfo[] {
    return [];
  }

  getSupportedModels(_agentType: AgentType): string[] {
    return [];
  }

  async listAvailableModels(
    _agentType: AgentType,
    _authConfig?: AgentConfig
  ): Promise<AgentModelListing[]> {
    return [];
  }

  createInteractiveExecutor(
    _agentType: AgentType,
    _authConfig: AgentConfig
  ): IInteractiveAgentExecutor {
    throw new Error('Interactive sessions are not supported by the scenario-replay executor');
  }

  supportsInteractive(_agentType: AgentType): boolean {
    return false;
  }
}
