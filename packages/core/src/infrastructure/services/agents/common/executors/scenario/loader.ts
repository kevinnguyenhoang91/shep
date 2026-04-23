import { readdir, readFile, stat } from 'node:fs/promises';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import yaml from 'js-yaml';

import { ScenarioSchema, type Scenario } from './schema.js';

/**
 * Recursively find all *.scenario.yaml files under `dir` (async).
 */
async function findScenarioFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await findScenarioFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.scenario.yaml')) {
      out.push(full);
    }
  }
  return out;
}

function findScenarioFilesSync(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findScenarioFilesSync(full));
    } else if (entry.isFile() && entry.name.endsWith('.scenario.yaml')) {
      out.push(full);
    }
  }
  return out;
}

function parseAndValidate(displayPath: string, raw: string): Scenario {
  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse YAML in ${displayPath}: ${msg}`);
  }

  const validation = ScenarioSchema.safeParse(parsed);
  if (!validation.success) {
    const first = validation.error.issues[0];
    const path = first?.path.join('.') ?? '(root)';
    throw new Error(
      `Scenario schema violation in ${displayPath} at ${path}: ${first?.message ?? 'unknown'}`
    );
  }

  return validation.data;
}

function indexByName(
  entries: { displayPath: string; scenario: Scenario }[]
): Map<string, Scenario> {
  const result = new Map<string, Scenario>();
  const sourceByName = new Map<string, string>();

  for (const { displayPath, scenario } of entries) {
    const existing = sourceByName.get(scenario.name);
    if (existing !== undefined) {
      throw new Error(
        `Duplicate scenario name "${scenario.name}" in ${displayPath} (already defined in ${existing})`
      );
    }
    sourceByName.set(scenario.name, displayPath);
    result.set(scenario.name, scenario);
  }

  return result;
}

/**
 * Load and validate every scenario under `dir` (async).
 *
 * Fails fast on invalid YAML, schema violations, or duplicate names.
 */
export async function loadAllScenarios(dir: string): Promise<Map<string, Scenario>> {
  await stat(dir);

  const files = await findScenarioFiles(dir);
  const parsed: { displayPath: string; scenario: Scenario }[] = [];

  for (const file of files) {
    const displayPath = relative(dir, file) || file;
    const raw = await readFile(file, 'utf-8');
    parsed.push({ displayPath, scenario: parseAndValidate(displayPath, raw) });
  }

  return indexByName(parsed);
}

/**
 * Synchronous variant — used from DI bootstrap where the container
 * factory must return a fully-resolved map without awaiting.
 */
export function loadAllScenariosSync(dir: string): Map<string, Scenario> {
  statSync(dir);

  const files = findScenarioFilesSync(dir);
  const parsed: { displayPath: string; scenario: Scenario }[] = [];

  for (const file of files) {
    const displayPath = relative(dir, file) || file;
    const raw = readFileSync(file, 'utf-8');
    parsed.push({ displayPath, scenario: parseAndValidate(displayPath, raw) });
  }

  return indexByName(parsed);
}

/**
 * Look up a single scenario in a pre-loaded map. Throws a clear error
 * if the name is unknown — scenarios must be declared ahead of time.
 */
export function getScenario(scenarios: Map<string, Scenario>, name: string): Scenario {
  const hit = scenarios.get(name);
  if (!hit) {
    const known = [...scenarios.keys()].sort().join(', ') || '(none)';
    throw new Error(`Unknown e2e scenario "${name}". Known scenarios: ${known}`);
  }
  return hit;
}
