/**
 * InMemorySupervisorAgent — test-time adapter for {@link ISupervisorAgent}.
 *
 * Wraps a {@link StubSupervisorAgentExecutor} and forwards `evaluate` calls
 * straight through. The wrapper exists so DI tests can resolve a real
 * ISupervisorAgent token without booting the LangGraph workflow.
 *
 * Decision persistence is the EvaluateSupervisorDecisionUseCase's job —
 * this adapter is intentionally side-effect free so unit tests can assert
 * exactly what the use case writes.
 */

import { injectable } from 'tsyringe';

import type {
  ISupervisorAgent,
  SupervisorDecisionResult,
  SupervisorEvaluateInput,
} from '@/application/ports/output/agents/supervisor-agent.interface.js';
import {
  StubSupervisorAgentExecutor,
  type StubSupervisorAgentExecutorOptions,
} from '@/infrastructure/services/agents/supervisor-agent/stub-supervisor-executor.js';

@injectable()
export class InMemorySupervisorAgent implements ISupervisorAgent {
  private readonly executor: StubSupervisorAgentExecutor;

  constructor(options: StubSupervisorAgentExecutorOptions = {}) {
    this.executor = new StubSupervisorAgentExecutor(options);
  }

  async evaluate(input: SupervisorEvaluateInput): Promise<SupervisorDecisionResult> {
    return this.executor.evaluate(input);
  }
}
