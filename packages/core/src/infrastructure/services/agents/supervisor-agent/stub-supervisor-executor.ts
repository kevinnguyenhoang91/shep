/**
 * StubSupervisorAgentExecutor — deterministic supervisor evaluator used in
 * tests and as the GREEN-path implementation behind {@link InMemorySupervisorAgent}.
 *
 * Rather than calling an LLM, the stub looks up a canned verdict keyed by
 * the input event kind. This keeps every test that exercises supervisor
 * logic free of LLM cost, network dependency, and flakiness while still
 * verifying the surrounding plumbing (persistence, activity-log mirroring,
 * autonomy ladder, conflict resolution).
 *
 * The stub is intentionally *not* registered in the production DI container.
 * It is consumed directly by tests and by the InMemory adapter.
 */

import { SupervisorVerdict } from '../../../../domain/generated/output.js';
import type {
  ISupervisorAgent,
  SupervisorDecisionResult,
  SupervisorEvaluateInput,
  SupervisorEventKind,
} from '../../../../application/ports/output/agents/supervisor-agent.interface.js';

/** Canned verdict + rationale keyed by event kind. */
export interface StubSupervisorVerdictTemplate {
  verdict: SupervisorVerdict;
  rationale: string;
  ruleRef?: string;
  confidence?: number;
}

export interface StubSupervisorAgentExecutorOptions {
  /** Per-event-kind canned verdicts. Falls back to the default below. */
  verdicts?: Partial<Record<SupervisorEventKind, StubSupervisorVerdictTemplate>>;
  /** Snapshot stored on every produced decision (audit reproducibility). */
  modelId?: string;
  promptVersion?: string;
}

const DEFAULT_VERDICTS: Record<SupervisorEventKind, StubSupervisorVerdictTemplate> = {
  gate: { verdict: SupervisorVerdict.advise, rationale: 'stub: gate observed, advising user' },
  question: {
    verdict: SupervisorVerdict.escalate,
    rationale: 'stub: question requires user attention',
  },
  message: {
    verdict: SupervisorVerdict.advise,
    rationale: 'stub: message acknowledged',
  },
};

const DEFAULT_MODEL_ID = 'stub-supervisor';
const DEFAULT_PROMPT_VERSION = 'stub-v1';

/**
 * Deterministic stub. Implements {@link ISupervisorAgent} so it can be
 * dropped into any caller that depends on the port.
 */
export class StubSupervisorAgentExecutor implements ISupervisorAgent {
  private readonly verdicts: Record<SupervisorEventKind, StubSupervisorVerdictTemplate>;
  private readonly modelId: string;
  private readonly promptVersion: string;

  constructor(options: StubSupervisorAgentExecutorOptions = {}) {
    this.verdicts = {
      ...DEFAULT_VERDICTS,
      ...(options.verdicts ?? {}),
    };
    this.modelId = options.modelId ?? DEFAULT_MODEL_ID;
    this.promptVersion = options.promptVersion ?? DEFAULT_PROMPT_VERSION;
  }

  async evaluate(input: SupervisorEvaluateInput): Promise<SupervisorDecisionResult> {
    const template = this.verdicts[input.event.kind];
    return {
      verdict: template.verdict,
      rationale: template.rationale,
      modelId: this.modelId,
      promptVersion: this.promptVersion,
      ruleRef: template.ruleRef,
      confidence: template.confidence,
    };
  }
}
