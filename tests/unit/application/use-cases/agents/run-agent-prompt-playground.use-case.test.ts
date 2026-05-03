/**
 * RunAgentPromptPlaygroundUseCase — unit tests (spec 093, task 54).
 *
 * Verifies the use case streams chunks from a stub executor, honors an
 * inline `promptBody` override, and rejects unknown slots / empty
 * messages.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';

import { RunAgentPromptPlaygroundUseCase } from '@/application/use-cases/agents/run-agent-prompt-playground.use-case.js';
import { InMemoryAgentPromptOverrideRepository } from '@/infrastructure/adapters/in-memory/in-memory-agent-prompt-override.repository.js';
import { SQLiteAgentPromptResolver } from '@/infrastructure/services/agents/prompt-resolver/sqlite-agent-prompt-resolver.service.js';
import { UpsertAgentPromptOverrideUseCase } from '@/application/use-cases/agents/upsert-agent-prompt-override.use-case.js';
import { InMemoryCustomAgentRepository } from '@/infrastructure/adapters/in-memory/in-memory-custom-agent.repository.js';
import { AgentType, AgentFeature } from '@/domain/generated/output.js';
import type {
  IAgentExecutor,
  AgentExecutionStreamEvent,
} from '@/application/ports/output/agents/agent-executor.interface.js';
import type { IAgentExecutorProvider } from '@/application/ports/output/agents/agent-executor-provider.interface.js';

function stubExecutor(chunks: string[]): IAgentExecutor {
  let lastSystem: string | undefined;
  const exec: IAgentExecutor = {
    agentType: AgentType.ClaudeCode,
    async execute() {
      return { result: chunks.join('') };
    },
    async *executeStream(_prompt: string, opts): AsyncIterable<AgentExecutionStreamEvent> {
      lastSystem = opts?.systemPrompt;
      for (const chunk of chunks) {
        yield { type: 'progress', content: chunk, timestamp: new Date() };
      }
      yield { type: 'result', content: '', timestamp: new Date() };
    },
    supportsFeature(f) {
      return f === AgentFeature.streaming;
    },
  };
  // Expose the captured system prompt for assertions
  (exec as unknown as { __getLastSystem: () => string | undefined }).__getLastSystem = () =>
    lastSystem;
  return exec;
}

function provider(executor: IAgentExecutor): IAgentExecutorProvider {
  return {
    async getExecutor() {
      return executor;
    },
  };
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iter) out.push(item);
  return out;
}

describe('RunAgentPromptPlaygroundUseCase', () => {
  let repo: InMemoryAgentPromptOverrideRepository;
  let resolver: SQLiteAgentPromptResolver;
  let upsert: UpsertAgentPromptOverrideUseCase;

  beforeEach(() => {
    repo = new InMemoryAgentPromptOverrideRepository();
    resolver = new SQLiteAgentPromptResolver(repo);
    upsert = new UpsertAgentPromptOverrideUseCase(repo, new InMemoryCustomAgentRepository());
  });

  it('forwards stub stream chunks as delta events ending with a done event', async () => {
    const exec = stubExecutor(['Hello ', 'world']);
    const useCase = new RunAgentPromptPlaygroundUseCase(provider(exec), resolver);

    const events = await collect(
      useCase.execute({
        agentType: 'feature-agent',
        promptId: 'implement.system',
        messages: [{ role: 'user', content: 'hi' }],
      })
    );

    expect(events[0]?.type).toBe('system');
    expect(events.find((e) => e.content === 'Hello ')?.type).toBe('delta');
    expect(events.find((e) => e.content === 'world')?.type).toBe('delta');
    expect(events[events.length - 1]?.type).toBe('done');
  });

  it('uses the inline promptBody as the system prompt', async () => {
    const exec = stubExecutor(['ok']);
    const useCase = new RunAgentPromptPlaygroundUseCase(provider(exec), resolver);

    await collect(
      useCase.execute({
        agentType: 'feature-agent',
        promptId: 'implement.system',
        promptBody: 'INLINE OVERRIDE',
        messages: [{ role: 'user', content: 'hi' }],
      })
    );

    const captured = (exec as unknown as { __getLastSystem: () => string }).__getLastSystem();
    expect(captured).toBe('INLINE OVERRIDE');
  });

  it('falls back to the active stored override when no promptBody is supplied', async () => {
    await upsert.execute({
      agentType: 'feature-agent',
      promptId: 'implement.system',
      body: 'STORED OVERRIDE',
    });
    const exec = stubExecutor(['ok']);
    const useCase = new RunAgentPromptPlaygroundUseCase(provider(exec), resolver);

    await collect(
      useCase.execute({
        agentType: 'feature-agent',
        promptId: 'implement.system',
        messages: [{ role: 'user', content: 'hi' }],
      })
    );

    const captured = (exec as unknown as { __getLastSystem: () => string }).__getLastSystem();
    expect(captured).toBe('STORED OVERRIDE');
  });

  it('rejects unknown prompt slots', async () => {
    const exec = stubExecutor(['ok']);
    const useCase = new RunAgentPromptPlaygroundUseCase(provider(exec), resolver);

    await expect(
      collect(
        useCase.execute({
          agentType: 'feature-agent',
          promptId: 'made-up',
          messages: [{ role: 'user', content: 'hi' }],
        })
      )
    ).rejects.toThrow(/Unknown prompt slot/);
  });

  it('rejects empty messages', async () => {
    const exec = stubExecutor(['ok']);
    const useCase = new RunAgentPromptPlaygroundUseCase(provider(exec), resolver);

    await expect(
      collect(
        useCase.execute({
          agentType: 'feature-agent',
          promptId: 'implement.system',
          messages: [],
        })
      )
    ).rejects.toThrow(/non-empty/);
  });
});
