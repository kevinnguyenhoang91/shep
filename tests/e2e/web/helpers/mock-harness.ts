import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pickFreePort } from './pick-free-port.js';

/**
 * One-time global setup for the mocked e2e suite.
 *
 * Guarantees isolation from any running prod/dev instance on the same
 * machine by:
 *   - picking a free TCP port (not 3001, which `pnpm dev:web` uses)
 *   - allocating a fresh SHEP_HOME temp dir so the test database and
 *     state never touch the developer's real `~/.shep/`
 *   - setting SHEP_E2E_MOCK_AGENT=1 and SHEP_E2E_SCENARIOS_DIR so the
 *     web server boots with the scenario-replay executor
 *
 * The resolved values are persisted to a small JSON file that the
 * Playwright config reads synchronously so every worker sees the same
 * port and home dir.
 */

export interface MockHarnessEnv {
  port: number;
  baseURL: string;
  shepHome: string;
  scenariosDir: string;
}

export const HARNESS_ENV_FILE = join(tmpdir(), `shep-e2e-harness-${process.pid}.json`);

export async function allocateHarnessEnv(scenariosDir: string): Promise<MockHarnessEnv> {
  const port = await pickFreePort();
  const shepHome = mkdtempSync(join(tmpdir(), 'shep-e2e-home-'));
  const env: MockHarnessEnv = {
    port,
    baseURL: `http://127.0.0.1:${port}`,
    shepHome,
    scenariosDir,
  };
  writeFileSync(HARNESS_ENV_FILE, JSON.stringify(env, null, 2), 'utf-8');
  return env;
}
