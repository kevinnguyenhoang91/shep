/**
 * Custom agent use cases — unit tests.
 *
 * Round-trip: create → list (custom appears) → editor sees its prompts →
 * delete (cascades prompt + graph overrides). Validates rejected inputs.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';

import { CreateCustomAgentUseCase } from '@/application/use-cases/agents/create-custom-agent.use-case.js';
import { ListCustomAgentsUseCase } from '@/application/use-cases/agents/list-custom-agents.use-case.js';
import { DeleteCustomAgentUseCase } from '@/application/use-cases/agents/delete-custom-agent.use-case.js';
import { ListAgentPromptsUseCase } from '@/application/use-cases/agents/list-agent-prompts.use-case.js';
import { UpsertAgentPromptOverrideUseCase } from '@/application/use-cases/agents/upsert-agent-prompt-override.use-case.js';
import { UpsertAgentGraphOverrideUseCase } from '@/application/use-cases/agents/upsert-agent-graph-override.use-case.js';
import { GetAgentGraphUseCase } from '@/application/use-cases/agents/get-agent-graph.use-case.js';
import { InMemoryCustomAgentRepository } from '@/infrastructure/adapters/in-memory/in-memory-custom-agent.repository.js';
import { InMemoryAgentPromptOverrideRepository } from '@/infrastructure/adapters/in-memory/in-memory-agent-prompt-override.repository.js';
import { InMemoryAgentGraphOverrideRepository } from '@/infrastructure/adapters/in-memory/in-memory-agent-graph-override.repository.js';

describe('Custom agent use cases', () => {
  let agentsRepo: InMemoryCustomAgentRepository;
  let promptsRepo: InMemoryAgentPromptOverrideRepository;
  let graphsRepo: InMemoryAgentGraphOverrideRepository;
  let create: CreateCustomAgentUseCase;
  let list: ListCustomAgentsUseCase;
  let remove: DeleteCustomAgentUseCase;
  let listPrompts: ListAgentPromptsUseCase;
  let upsertPrompt: UpsertAgentPromptOverrideUseCase;
  let upsertGraph: UpsertAgentGraphOverrideUseCase;
  let getGraph: GetAgentGraphUseCase;

  beforeEach(() => {
    agentsRepo = new InMemoryCustomAgentRepository();
    promptsRepo = new InMemoryAgentPromptOverrideRepository();
    graphsRepo = new InMemoryAgentGraphOverrideRepository();
    create = new CreateCustomAgentUseCase(agentsRepo, promptsRepo);
    list = new ListCustomAgentsUseCase(agentsRepo);
    remove = new DeleteCustomAgentUseCase(agentsRepo, promptsRepo, graphsRepo);
    listPrompts = new ListAgentPromptsUseCase(promptsRepo, agentsRepo);
    upsertPrompt = new UpsertAgentPromptOverrideUseCase(promptsRepo, agentsRepo);
    upsertGraph = new UpsertAgentGraphOverrideUseCase(graphsRepo, agentsRepo);
    getGraph = new GetAgentGraphUseCase(graphsRepo, agentsRepo);
  });

  it('creates a custom agent and lists it', async () => {
    const result = await create.execute({
      agentType: 'code-review',
      name: 'Code Review',
      description: 'Reviews PRs for code smells',
    });
    expect(result.agent.agentType).toBe('code-review');
    expect(result.initialPromptOverride).toBeUndefined();

    const all = await list.execute();
    expect(all).toHaveLength(1);
    expect(all[0]?.agentType).toBe('code-review');
  });

  it('seeds the first prompt slot when initialPrompt is provided', async () => {
    const result = await create.execute({
      agentType: 'code-review',
      name: 'Code Review',
      description: 'desc',
      initialPrompt: { promptId: 'system', body: 'You are a code reviewer.' },
    });
    expect(result.initialPromptOverride).toBeDefined();

    const entries = await listPrompts.execute({ agentType: 'code-review' });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.promptId).toBe('system');
    expect(entries[0]?.effectiveBody).toBe('You are a code reviewer.');
  });

  it('lets the user upsert additional prompt slots on a custom agent', async () => {
    await create.execute({ agentType: 'code-review', name: 'Code Review', description: 'desc' });

    await upsertPrompt.execute({
      agentType: 'code-review',
      promptId: 'plan.system',
      body: 'You plan reviews.',
    });

    const entries = await listPrompts.execute({ agentType: 'code-review' });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.promptId).toBe('plan.system');
  });

  it('lets the user upsert + read a graph for a custom agent', async () => {
    await create.execute({ agentType: 'code-review', name: 'Code Review', description: 'desc' });

    const before = await getGraph.execute({ agentType: 'code-review' });
    expect(before?.hasOverride).toBe(false);
    expect(before?.nodes).toHaveLength(1); // seeded "Start" node

    await upsertGraph.execute({
      agentType: 'code-review',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });

    const after = await getGraph.execute({ agentType: 'code-review' });
    expect(after?.hasOverride).toBe(true);
    expect(after?.nodes).toHaveLength(2);
  });

  it('rejects creating an agent that collides with a built-in', async () => {
    await expect(
      create.execute({
        agentType: 'feature-agent',
        name: 'Bogus',
        description: 'desc',
      })
    ).rejects.toThrow(/collides with a built-in/);
  });

  it('rejects malformed agentType ids', async () => {
    await expect(
      create.execute({ agentType: 'NotKebab', name: 'X', description: 'X' })
    ).rejects.toThrow(/lowercase kebab-case/);
  });

  it('delete cascades prompt + graph overrides', async () => {
    await create.execute({
      agentType: 'code-review',
      name: 'Code Review',
      description: 'desc',
      initialPrompt: { promptId: 'system', body: 'a' },
    });
    await upsertGraph.execute({
      agentType: 'code-review',
      nodes: [{ id: 'a', label: 'A' }],
      edges: [],
    });

    await remove.execute({ agentType: 'code-review' });

    expect(await agentsRepo.findByType('code-review')).toBeNull();
    expect(await promptsRepo.listForAgent('code-review')).toHaveLength(0);
    expect(await graphsRepo.findActive('code-review')).toBeNull();
  });

  it('refuses to delete a built-in agent', async () => {
    await expect(remove.execute({ agentType: 'feature-agent' })).rejects.toThrow(
      /cannot be deleted/
    );
  });

  it('lists built-ins + customs through listAgentTypesAsync', async () => {
    await create.execute({ agentType: 'code-review', name: 'Code Review', description: 'desc' });
    const types = await listPrompts.listAgentTypesAsync();
    const names = types.map((t) => t.agentType);
    expect(names).toContain('feature-agent');
    expect(names).toContain('supervisor-agent');
    expect(names).toContain('code-review');
    expect(types.find((t) => t.agentType === 'code-review')?.isCustom).toBe(true);
    expect(types.find((t) => t.agentType === 'feature-agent')?.isCustom).toBe(false);
  });
});
