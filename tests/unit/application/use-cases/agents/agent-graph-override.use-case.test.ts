/**
 * Agent graph override use cases — unit tests (spec 093, FR-38 ext).
 *
 * Round-trip: get → upsert → get (override visible) → delete → get
 * (back to bundled). Validates that unknown agents and malformed
 * payloads are rejected.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';

import { GetAgentGraphUseCase } from '@/application/use-cases/agents/get-agent-graph.use-case.js';
import { UpsertAgentGraphOverrideUseCase } from '@/application/use-cases/agents/upsert-agent-graph-override.use-case.js';
import { DeleteAgentGraphOverrideUseCase } from '@/application/use-cases/agents/delete-agent-graph-override.use-case.js';
import { InMemoryAgentGraphOverrideRepository } from '@/infrastructure/adapters/in-memory/in-memory-agent-graph-override.repository.js';
import { InMemoryCustomAgentRepository } from '@/infrastructure/adapters/in-memory/in-memory-custom-agent.repository.js';

describe('Agent graph override use cases', () => {
  let repo: InMemoryAgentGraphOverrideRepository;
  let get: GetAgentGraphUseCase;
  let upsert: UpsertAgentGraphOverrideUseCase;
  let remove: DeleteAgentGraphOverrideUseCase;

  beforeEach(() => {
    repo = new InMemoryAgentGraphOverrideRepository();
    const customAgentRepo = new InMemoryCustomAgentRepository();
    get = new GetAgentGraphUseCase(repo, customAgentRepo);
    upsert = new UpsertAgentGraphOverrideUseCase(repo, customAgentRepo);
    remove = new DeleteAgentGraphOverrideUseCase(repo);
  });

  it('returns bundled descriptor when no override exists', async () => {
    const result = await get.execute({ agentType: 'feature-agent' });
    expect(result).not.toBeNull();
    expect(result?.hasOverride).toBe(false);
    expect(result?.nodes.length).toBeGreaterThan(0);
    expect(result?.bundled.nodes).toEqual(result?.nodes);
  });

  it('returns null for an unknown agent type', async () => {
    const result = await get.execute({ agentType: 'unknown-agent' });
    expect(result).toBeNull();
  });

  it('upserts an override and surfaces it on subsequent get', async () => {
    await upsert.execute({
      agentType: 'feature-agent',
      nodes: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta', description: 'extra step' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });

    const result = await get.execute({ agentType: 'feature-agent' });
    expect(result?.hasOverride).toBe(true);
    expect(result?.nodes).toHaveLength(2);
    expect(result?.nodes[0]?.label).toBe('Alpha');
    expect(result?.bundled.nodes.length).toBeGreaterThan(2);
  });

  it('bumps version on every upsert', async () => {
    const first = await upsert.execute({
      agentType: 'feature-agent',
      nodes: [{ id: 'a', label: 'A' }],
      edges: [],
    });
    const second = await upsert.execute({
      agentType: 'feature-agent',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(second.id).toBe(first.id);
  });

  it('rejects unknown agent types on upsert', async () => {
    await expect(
      upsert.execute({
        agentType: 'unknown',
        nodes: [{ id: 'a', label: 'A' }],
        edges: [],
      })
    ).rejects.toThrow(/Unknown graph agent/);
  });

  it('rejects empty nodes', async () => {
    await expect(
      upsert.execute({ agentType: 'feature-agent', nodes: [], edges: [] })
    ).rejects.toThrow(/non-empty array/);
  });

  it('rejects edges that reference unknown nodes', async () => {
    await expect(
      upsert.execute({
        agentType: 'feature-agent',
        nodes: [{ id: 'a', label: 'A' }],
        edges: [{ from: 'a', to: 'missing' }],
      })
    ).rejects.toThrow(/unknown target node/);
  });

  it('rejects duplicate node ids', async () => {
    await expect(
      upsert.execute({
        agentType: 'feature-agent',
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'a', label: 'A2' },
        ],
        edges: [],
      })
    ).rejects.toThrow(/duplicate node id/);
  });

  it('delete restores the bundled descriptor', async () => {
    await upsert.execute({
      agentType: 'feature-agent',
      nodes: [{ id: 'only', label: 'Only' }],
      edges: [],
    });
    const overridden = await get.execute({ agentType: 'feature-agent' });
    expect(overridden?.hasOverride).toBe(true);

    await remove.execute({ agentType: 'feature-agent' });

    const restored = await get.execute({ agentType: 'feature-agent' });
    expect(restored?.hasOverride).toBe(false);
    expect(restored?.nodes).toEqual(restored?.bundled.nodes);
  });

  it('delete is a no-op when no override exists', async () => {
    await expect(remove.execute({ agentType: 'feature-agent' })).resolves.toBeUndefined();
  });
});
