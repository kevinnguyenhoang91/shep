'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, Square } from 'lucide-react';

export interface PlaygroundChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

let nextMessageId = 0;
function newMessageId(): string {
  nextMessageId += 1;
  return `msg-${nextMessageId}`;
}

export interface AgentPlaygroundProps {
  agentType: string;
  /** Currently selected prompt slot — used for the system prompt + UI context. */
  promptId: string;
  /** Inline prompt body the user is currently editing (overrides the saved one). */
  inlinePromptBody?: string;
  /** Optional override of the streaming endpoint — used by tests/Storybook. */
  fetchOverride?: typeof fetch;
}

interface StreamEvent {
  type: 'system' | 'delta' | 'done' | 'error';
  content: string;
}

export function AgentPlayground({
  agentType,
  promptId,
  inlinePromptBody,
  fetchOverride,
}: AgentPlaygroundProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<PlaygroundChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
  }, [messages]);

  async function send(prompt: string) {
    if (!prompt.trim() || streaming) return;
    setError(null);

    const nextMessages: PlaygroundChatMessage[] = [
      ...messages,
      { id: newMessageId(), role: 'user', content: prompt },
      { id: newMessageId(), role: 'assistant', content: '' },
    ];
    setMessages(nextMessages);
    setInput('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const fetcher = fetchOverride ?? fetch;
      const res = await fetcher('/api/agents/playground', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agentType,
          promptId,
          ...(inlinePromptBody && { promptBody: inlinePromptBody }),
          messages: nextMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const message = `Playground request failed (${res.status})`;
        setError(message);
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const block of events) {
          const line = block.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const event = JSON.parse(payload) as StreamEvent;
            if (event.type === 'delta') {
              setMessages((prev) => appendDelta(prev, event.content));
            } else if (event.type === 'error') {
              setError(event.content);
            }
          } catch {
            // ignore malformed line
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4" data-testid="agent-playground">
      <header className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <p className="text-sm font-semibold">Playground</p>
          <p className="text-muted-foreground text-xs">
            Streaming against {agentType} · {promptId}
            {inlinePromptBody ? ' (inline override)' : ''}
          </p>
        </div>
        {messages.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMessages([])}
            disabled={streaming}
          >
            Clear
          </Button>
        ) : null}
      </header>

      <div
        ref={transcriptRef}
        className="bg-muted/20 flex h-72 flex-col gap-2 overflow-y-auto rounded border p-3"
        data-testid="playground-transcript"
      >
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Send a message to test this prompt against the configured executor.
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={m.id}
              className={
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground max-w-[85%] self-end rounded-lg px-3 py-2 text-sm'
                  : 'bg-card max-w-[85%] self-start rounded-lg border px-3 py-2 text-sm whitespace-pre-wrap'
              }
              data-testid={`playground-msg-${i}-${m.role}`}
            >
              {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
            </div>
          ))
        )}
      </div>

      {error ? (
        <Alert variant="destructive" data-testid="playground-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder="Try a prompt…"
          className="font-mono text-xs"
          data-testid="playground-input"
          disabled={streaming}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        {streaming ? (
          <Button type="button" variant="secondary" onClick={stop} data-testid="playground-stop">
            <Square className="size-3" />
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!input.trim()} data-testid="playground-send">
            <Send className="size-3" />
            Send
          </Button>
        )}
      </form>
    </div>
  );
}

function appendDelta(prev: PlaygroundChatMessage[], delta: string): PlaygroundChatMessage[] {
  if (prev.length === 0) return prev;
  const last = prev[prev.length - 1];
  if (last?.role !== 'assistant') return prev;
  const next = [...prev];
  next[next.length - 1] = { ...last, content: last.content + delta };
  return next;
}
