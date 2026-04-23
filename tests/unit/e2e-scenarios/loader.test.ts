import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAllScenarios } from '../../../packages/core/src/infrastructure/services/agents/common/executors/scenario/loader.js';

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'shep-scenarios-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function writeFile(relPath: string, contents: string): void {
  const full = join(workDir, relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, contents, 'utf-8');
}

describe('loadAllScenarios', () => {
  it('returns an empty map for an empty directory', async () => {
    const result = await loadAllScenarios(workDir);
    expect(result.size).toBe(0);
  });

  it('loads and indexes a valid scenario by its name', async () => {
    writeFile(
      'golden.scenario.yaml',
      ['version: 1', 'name: golden', 'turns:', '  - kind: text', '    text: hi'].join('\n')
    );
    const result = await loadAllScenarios(workDir);
    expect(result.size).toBe(1);
    expect(result.get('golden')?.name).toBe('golden');
  });

  it('loads scenarios from nested subdirectories', async () => {
    writeFile('a/nested.scenario.yaml', ['version: 1', 'name: nested', 'turns: []'].join('\n'));
    const result = await loadAllScenarios(workDir);
    expect(result.get('nested')).toBeDefined();
  });

  it('ignores files that are not *.scenario.yaml', async () => {
    writeFile('README.md', '# not a scenario');
    writeFile('random.yaml', 'hello: world');
    const result = await loadAllScenarios(workDir);
    expect(result.size).toBe(0);
  });

  it('throws on invalid YAML with file path in the message', async () => {
    writeFile('broken.scenario.yaml', 'version: 1\nname: x\nturns: - this is not yaml');
    await expect(loadAllScenarios(workDir)).rejects.toThrow(/broken\.scenario\.yaml/);
  });

  it('throws on schema violation with file path in the message', async () => {
    writeFile('bad.scenario.yaml', ['version: 999', 'name: bad', 'turns: []'].join('\n'));
    await expect(loadAllScenarios(workDir)).rejects.toThrow(/bad\.scenario\.yaml/);
  });

  it('throws on duplicate scenario names across files', async () => {
    writeFile('a.scenario.yaml', ['version: 1', 'name: dup', 'turns: []'].join('\n'));
    writeFile('b.scenario.yaml', ['version: 1', 'name: dup', 'turns: []'].join('\n'));
    await expect(loadAllScenarios(workDir)).rejects.toThrow(/duplicate/i);
  });

  it('throws if the directory does not exist', async () => {
    await expect(loadAllScenarios(join(workDir, 'does-not-exist'))).rejects.toThrow();
  });
});
