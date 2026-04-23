import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { HARNESS_ENV_FILE } from './tests/e2e/web/helpers/mock-harness.js';

/**
 * Playwright configuration for the MOCKED agent e2e suite.
 *
 * Fully isolated from the developer's running `pnpm dev:web`:
 *   - unique free port per run (chosen in globalSetup)
 *   - unique SHEP_HOME temp dir per run
 *   - SHEP_E2E_MOCK_AGENT=1 so the web server boots with the scenario
 *     replay executor instead of hitting real LLMs / cloud / GitHub
 *
 * Run with:  pnpm test:e2e:web:bdd
 */

// The harness file is written by global-setup.mock.ts and read here
// during Playwright config evaluation (after global setup fires).
// To ensure `webServer.env` has the right values BEFORE the server
// starts, Playwright re-resolves the config per test run. When the
// file isn't present yet (initial config parse), fall back to sane
// defaults — globalSetup will overwrite and re-export values.
function readHarnessEnv(): {
  port: number;
  baseURL: string;
  shepHome: string;
  scenariosDir: string;
} {
  if (existsSync(HARNESS_ENV_FILE)) {
    return JSON.parse(readFileSync(HARNESS_ENV_FILE, 'utf-8')) as {
      port: number;
      baseURL: string;
      shepHome: string;
      scenariosDir: string;
    };
  }
  // Fallback — sentinel values that will be replaced once globalSetup
  // runs. Using 0 would break webServer; pick a high random port.
  const fallbackPort = 39000 + Math.floor(Math.random() * 1000);
  return {
    port: fallbackPort,
    baseURL: `http://127.0.0.1:${fallbackPort}`,
    shepHome: '/tmp/shep-e2e-unset',
    scenariosDir: join(process.cwd(), 'tests/e2e/web/scenarios'),
  };
}

const harness = readHarnessEnv();

// Compile .feature files into Playwright specs under .features-gen/
const testDir = defineBddConfig({
  features: 'tests/e2e/web/features/**/*.feature',
  steps: 'tests/e2e/web/steps/**/*.ts',
  outputDir: '.features-gen/e2e',
});

export default defineConfig({
  testDir,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? 'github'
    : [['html', { open: 'never', outputFolder: 'playwright-report-mock' }]],
  outputDir: 'test-results/e2e-mock',

  globalSetup: './tests/e2e/web/global-setup.mock.ts',

  use: {
    baseURL: harness.baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm dev:web',
    env: {
      PORT: String(harness.port),
      SHEP_HOME: harness.shepHome,
      SHEP_E2E_MOCK_AGENT: '1',
      SHEP_E2E_SCENARIOS_DIR: harness.scenariosDir,
    },
    url: harness.baseURL,
    // Never reuse a server — local dev instance is on a different
    // port anyway and we want a clean DB every run.
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
