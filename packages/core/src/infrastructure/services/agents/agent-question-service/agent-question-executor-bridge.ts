/**
 * AgentQuestionExecutorBridge
 *
 * Concrete {@link AgentQuestionBridge} that wires the SDK V2
 * `canUseTool` callback for `AskUserQuestion` to the unified
 * agent-question pipeline (spec 093, task 19).
 *
 * Behavior:
 *  - With `featureFlags.collaboration` ON, persists ONE
 *    {@link AgentQuestion} of kind `blocking` whose `prompt` carries the
 *    JSON-encoded array of `UserQuestion`s. Awaits the registered
 *    Deferred entry until {@link AnswerAgentQuestionUseCase} settles it,
 *    then converts the answer string back into the SDK-expected
 *    `Record<question, answer>` map.
 *  - With the flag OFF, returns `null` so the executor falls through to
 *    the legacy `onUserQuestion` path (NFR-14 byte-identical default).
 *
 * Answer encoding: the answer string is expected to be a JSON object
 * keyed by question text. If the caller answers with a plain string and
 * there is exactly one question, it is mapped to that single question
 * for ergonomics.
 *
 * Cancellation: when the awaiter rejects (timeout / cancel), the bridge
 * propagates the rejection so the SDK callback fails-fast — the SDK
 * surfaces this as an error in the conversation, which is the desired
 * behavior for a cancelled blocking question.
 */

import type {
  AgentQuestionBridge,
  UserQuestion,
} from '@/application/ports/output/agents/interactive-agent-executor.interface.js';
import type { AskAgentQuestionUseCase } from '@/application/use-cases/agents/ask-agent-question.use-case.js';
import { AgentQuestionAnswerer, AgentQuestionKind } from '@/domain/generated/output.js';

/** Scope passed to AskAgentQuestion when the bridge is used. */
export interface AgentQuestionExecutorBridgeScope {
  appId: string;
  featureId?: string;
  agentRunId: string;
}

export class AgentQuestionExecutorBridge implements AgentQuestionBridge {
  constructor(
    private readonly askAgentQuestion: AskAgentQuestionUseCase,
    private readonly scope: AgentQuestionExecutorBridgeScope
  ) {}

  async ask(args: {
    toolCallId: string;
    questions: UserQuestion[];
  }): Promise<Record<string, string> | null> {
    const result = await this.askAgentQuestion.execute({
      appId: this.scope.appId,
      featureId: this.scope.featureId,
      agentRunId: this.scope.agentRunId,
      kind: AgentQuestionKind.blocking,
      prompt: JSON.stringify({ toolCallId: args.toolCallId, questions: args.questions }),
      answerer: AgentQuestionAnswerer.either,
    });

    // Flag-off short-circuit: caller falls back to legacy onUserQuestion.
    if (!result.enabled || !result.awaiter) return null;

    const rawAnswer = await result.awaiter;
    return decodeAnswer(rawAnswer, args.questions);
  }
}

function decodeAnswer(raw: string, questions: UserQuestion[]): Record<string, string> {
  // Try JSON first — the canonical encoding when there is more than one
  // question or when the caller explicitly answers with the structured shape.
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const map: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'string') map[k] = v;
      }
      if (Object.keys(map).length > 0) return map;
    }
  } catch {
    // Fall through to plain-string handling.
  }

  // Plain-string fallback: useful when there is exactly one question.
  if (questions.length === 1 && questions[0]?.question) {
    return { [questions[0].question]: raw };
  }

  // Multi-question call answered with a plain string — assign to every
  // question. This is a graceful degradation rather than a hard error.
  const out: Record<string, string> = {};
  for (const q of questions) {
    if (q.question) out[q.question] = raw;
  }
  return out;
}
