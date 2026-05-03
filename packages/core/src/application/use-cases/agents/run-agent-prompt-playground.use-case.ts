/**
 * RunAgentPromptPlaygroundUseCase
 *
 * Streams a chat completion against the configured executor for an
 * agent type. The user can supply an inline `promptBody` to test an
 * unsaved override; otherwise the resolver falls back to the bundled
 * prompt for the requested slot (or the slot's stored override when
 * one already exists).
 *
 * Operates on an isolated transcript — does NOT touch agent_runs,
 * agent_messages, or supervisor_decisions tables (FR-40, NFR-18).
 */

import { inject, injectable } from 'tsyringe';

import type { IAgentExecutorProvider } from '../../ports/output/agents/agent-executor-provider.interface.js';
import type { IAgentPromptResolver } from '../../ports/output/agents/agent-prompt-resolver.interface.js';
import { getBuiltinPrompt, isKnownPromptSlot } from '../../services/builtin-prompt-registry.js';

export interface PlaygroundChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface RunAgentPromptPlaygroundInput {
  agentType: string;
  promptId: string;
  /** Optional inline override body — used to preview an unsaved edit. */
  promptBody?: string;
  /** Conversation transcript, oldest first; the latest user turn is the prompt to send. */
  messages: PlaygroundChatMessage[];
  /** Optional model id passed straight through to the executor. */
  modelId?: string;
}

export interface PlaygroundStreamEvent {
  type: 'system' | 'delta' | 'done' | 'error';
  content: string;
}

@injectable()
export class RunAgentPromptPlaygroundUseCase {
  constructor(
    @inject('IAgentExecutorProvider')
    private readonly executorProvider: IAgentExecutorProvider,
    @inject('IAgentPromptResolver')
    private readonly promptResolver: IAgentPromptResolver
  ) {}

  async *execute(input: RunAgentPromptPlaygroundInput): AsyncIterable<PlaygroundStreamEvent> {
    if (!input.agentType.trim()) throw new Error('agentType is required');
    if (!input.promptId.trim()) throw new Error('promptId is required');
    if (!Array.isArray(input.messages) || input.messages.length === 0) {
      throw new Error('messages must be a non-empty array');
    }
    if (!isKnownPromptSlot(input.agentType, input.promptId)) {
      throw new Error(
        `Unknown prompt slot: ${input.agentType}/${input.promptId}. ` +
          'Only slots in the built-in registry can be played with.'
      );
    }

    const lastUser = [...input.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser?.content?.trim()) {
      throw new Error('messages must end with a non-empty user turn');
    }

    const builtin = getBuiltinPrompt(input.agentType, input.promptId);
    const systemPrompt = input.promptBody?.length
      ? input.promptBody
      : await this.promptResolver.resolve(input.agentType, input.promptId, builtin?.body ?? '');

    yield { type: 'system', content: systemPrompt };

    const executor = await this.executorProvider.getExecutor();
    const transcript = renderTranscript(input.messages);

    try {
      for await (const event of executor.executeStream(transcript, {
        ...(input.modelId && { model: input.modelId }),
        systemPrompt,
        silent: true,
        // Playground runs are isolated — no MCP tools, no FS sandbox needed.
        disableMcp: true,
      })) {
        if (event.type === 'error') {
          yield { type: 'error', content: event.content };
          return;
        }
        if (event.content.length > 0) {
          yield { type: 'delta', content: event.content };
        }
        if (event.type === 'result') {
          yield { type: 'done', content: '' };
          return;
        }
      }
      yield { type: 'done', content: '' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      yield { type: 'error', content: message };
    }
  }
}

function renderTranscript(messages: PlaygroundChatMessage[]): string {
  return messages
    .map(
      (m) =>
        `${m.role === 'assistant' ? 'Assistant' : m.role === 'user' ? 'User' : 'System'}: ${m.content}`
    )
    .join('\n\n');
}
