import { join } from 'node:path';
import { allocateHarnessEnv } from './helpers/mock-harness.js';

/**
 * Playwright global setup for the mocked-agent e2e suite.
 *
 * Runs ONCE before any worker boots. We pick a free port, allocate a
 * scratch SHEP_HOME, and write both to a temp harness file that the
 * config reads when it spawns the web server.
 */
export default async function globalSetup(): Promise<void> {
  const scenariosDir = join(process.cwd(), 'tests/e2e/web/scenarios');
  const env = await allocateHarnessEnv(scenariosDir);
  console.log(
    `[e2e-mock] Using port ${env.port}, SHEP_HOME=${env.shepHome}, scenarios=${env.scenariosDir}`
  );
}
