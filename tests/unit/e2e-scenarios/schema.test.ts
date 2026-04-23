import { describe, it, expect } from 'vitest';
import { ScenarioSchema } from '../../../packages/core/src/infrastructure/services/agents/common/executors/scenario/schema.js';

describe('ScenarioSchema', () => {
  it('accepts a minimal valid scenario (version 1, name, empty turns)', () => {
    const sample = {
      version: 1,
      name: 'minimal',
      turns: [],
    };
    const parsed = ScenarioSchema.parse(sample);
    expect(parsed.version).toBe(1);
    expect(parsed.name).toBe('minimal');
    expect(parsed.turns).toEqual([]);
  });

  it('accepts a text turn with delayMs', () => {
    const sample = {
      version: 1,
      name: 'with-text',
      turns: [{ kind: 'text', text: 'Hello', delayMs: 10 }],
    };
    const parsed = ScenarioSchema.parse(sample);
    expect(parsed.turns[0]).toMatchObject({ kind: 'text', text: 'Hello', delayMs: 10 });
  });

  it('accepts a tool-call turn with a tool name and input', () => {
    const sample = {
      version: 1,
      name: 'with-tool',
      turns: [{ kind: 'tool-call', tool: 'writeFile', input: { path: 'a.html', content: '<p/>' } }],
    };
    const parsed = ScenarioSchema.parse(sample);
    expect(parsed.turns[0]).toMatchObject({ kind: 'tool-call', tool: 'writeFile' });
  });

  it('accepts optional mocks section for cloud and github', () => {
    const sample = {
      version: 1,
      name: 'with-mocks',
      turns: [],
      mocks: {
        cloud: { deploymentId: 'dep_1', finalUrl: 'https://x.pages.dev' },
        github: { owners: ['shep-bot'], createRepoResults: ['ok'] },
      },
    };
    const parsed = ScenarioSchema.parse(sample);
    expect(parsed.mocks?.cloud?.deploymentId).toBe('dep_1');
    expect(parsed.mocks?.github?.owners).toEqual(['shep-bot']);
  });

  it('rejects unknown version', () => {
    expect(() => ScenarioSchema.parse({ version: 999, name: 'bad', turns: [] })).toThrow(
      /version/i
    );
  });

  it('rejects missing name', () => {
    expect(() => ScenarioSchema.parse({ version: 1, turns: [] })).toThrow();
  });

  it('rejects a turn with unknown kind', () => {
    expect(() =>
      ScenarioSchema.parse({
        version: 1,
        name: 'bad-turn',
        turns: [{ kind: 'banana' }],
      })
    ).toThrow();
  });

  it('rejects tool-call turn without a tool name', () => {
    expect(() =>
      ScenarioSchema.parse({
        version: 1,
        name: 'bad-tool-call',
        turns: [{ kind: 'tool-call', input: {} }],
      })
    ).toThrow();
  });
});
