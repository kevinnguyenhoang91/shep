/**
 * POST /api/agents/playground
 *
 * Streams chat completions for the agent editor playground (FR-39).
 * Wraps `RunAgentPromptPlaygroundUseCase` and emits a simple
 * `text/event-stream` payload — one `data: <json>` line per stream
 * chunk. Operates on an isolated transcript; never writes to
 * agent_runs / agent_messages (NFR-18).
 *
 * Gated by the `collaboration` feature flag; returns 404 when off.
 */

import { resolve } from '@/lib/server-container';
import type {
  RunAgentPromptPlaygroundUseCase,
  PlaygroundChatMessage,
  PlaygroundStreamEvent,
} from '@shepai/core/application/use-cases/agents/run-agent-prompt-playground.use-case';
import { getFeatureFlags } from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

interface PlaygroundRequestBody {
  agentType?: unknown;
  promptId?: unknown;
  promptBody?: unknown;
  modelId?: unknown;
  messages?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const flags = getFeatureFlags();
  if (!flags.collaboration) {
    return new Response('Not Found', { status: 404 });
  }

  let body: PlaygroundRequestBody;
  try {
    body = (await request.json()) as PlaygroundRequestBody;
  } catch {
    return jsonError(400, 'Body must be valid JSON');
  }

  const validation = validateBody(body);
  if ('error' in validation) {
    return jsonError(400, validation.error);
  }

  const useCase = resolve<RunAgentPromptPlaygroundUseCase>('RunAgentPromptPlaygroundUseCase');

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: PlaygroundStreamEvent): void => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        for await (const event of useCase.execute(validation.input)) {
          send(event);
          if (event.type === 'done' || event.type === 'error') break;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        send({ type: 'error', content: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}

interface ValidatedInput {
  input: {
    agentType: string;
    promptId: string;
    promptBody?: string;
    modelId?: string;
    messages: PlaygroundChatMessage[];
  };
}

function validateBody(body: PlaygroundRequestBody): ValidatedInput | { error: string } {
  if (typeof body.agentType !== 'string' || body.agentType.trim().length === 0) {
    return { error: 'agentType is required' };
  }
  if (typeof body.promptId !== 'string' || body.promptId.trim().length === 0) {
    return { error: 'promptId is required' };
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { error: 'messages must be a non-empty array' };
  }

  const messages: PlaygroundChatMessage[] = [];
  for (const raw of body.messages as unknown[]) {
    if (typeof raw !== 'object' || raw === null) return { error: 'messages must be objects' };
    const m = raw as { role?: unknown; content?: unknown };
    if (m.role !== 'user' && m.role !== 'assistant' && m.role !== 'system') {
      return { error: 'message.role must be user|assistant|system' };
    }
    if (typeof m.content !== 'string') return { error: 'message.content must be a string' };
    messages.push({ role: m.role, content: m.content });
  }

  return {
    input: {
      agentType: body.agentType,
      promptId: body.promptId,
      ...(typeof body.promptBody === 'string' &&
        body.promptBody.length > 0 && {
          promptBody: body.promptBody,
        }),
      ...(typeof body.modelId === 'string' && body.modelId.length > 0 && { modelId: body.modelId }),
      messages,
    },
  };
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
