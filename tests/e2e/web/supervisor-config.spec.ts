/**
 * E2E: Supervisor configuration round-trip (spec 093, task-46).
 *
 * Verifies that a user can:
 *   1. navigate to /application/<appId>/supervisor,
 *   2. configure a SupervisorPolicy via the form,
 *   3. reload the page,
 *   4. observe the configured values still persisted.
 *
 * The whole surface is gated behind the `collaboration` feature flag — the
 * Playwright globalSetup flips it on before the dev server starts (see
 * `tests/e2e/web/global-setup.ts`).
 *
 * Local-dev caveat: if a `pnpm dev:web` server is already running when this
 * test runs, restart it once so the in-memory `Settings` cache picks up the
 * flag flip. CI starts the dev server fresh, so this is automatic there.
 */

import { test, expect } from '@playwright/test';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { openShepDb } from './helpers/collaboration-flag';

const TEST_APP_ID = `e2e-app-supervisor-${randomUUID().slice(0, 8)}`;

function clearPolicy(db: Database.Database, appId: string): void {
  db.prepare("DELETE FROM supervisor_policies WHERE scope_type = 'app' AND scope_id = ?").run(
    appId
  );
}

interface PolicyRow {
  id: string;
  scope_type: string;
  scope_id: string | null;
  feature_id: string | null;
  enabled: number;
  autonomy_level: string;
  model_id: string | null;
  prompt_version: string | null;
  gate_authority_json: string | null;
}

function readPolicy(db: Database.Database, appId: string): PolicyRow | undefined {
  return db
    .prepare(
      "SELECT id, scope_type, scope_id, feature_id, enabled, autonomy_level, model_id, prompt_version, gate_authority_json FROM supervisor_policies WHERE scope_type = 'app' AND scope_id = ? AND feature_id IS NULL"
    )
    .get(appId) as PolicyRow | undefined;
}

test.describe('Supervisor configuration round-trip (spec 093)', () => {
  let db: Database.Database;

  test.beforeAll(() => {
    db = openShepDb();
    clearPolicy(db, TEST_APP_ID);
  });

  test.afterAll(() => {
    if (db) {
      clearPolicy(db, TEST_APP_ID);
      db.close();
    }
  });

  test('configure → persist → reload shows the same values', async ({ page }) => {
    await page.goto(`/application/${TEST_APP_ID}/supervisor`);

    // If the flag is still off (e.g. local dev with a stale dev server), the
    // page returns notFound. Skip with a helpful pointer rather than failing
    // ambiguously.
    const isNotFound = await page
      .getByRole('heading', { name: 'Not Found' })
      .isVisible()
      .catch(() => false);
    test.skip(
      isNotFound,
      'Collaboration flag is OFF in the running dev server. Restart `pnpm dev:web` to pick up the globalSetup flip.'
    );

    // Form renders with the page header + the supervisor config form.
    await expect(page.getByRole('heading', { name: 'Supervisor', exact: true })).toBeVisible();
    await expect(page.getByTestId('supervisor-config-form')).toBeVisible();

    // Fill the form: switch autonomy → autonomous, set model + prompt version.
    await page.getByTestId('autonomy-trigger').click();
    await page.getByRole('option', { name: 'Autonomous' }).click();

    await page.getByTestId('model-id-input').fill('claude-sonnet-4');
    await page.getByTestId('prompt-version-input').fill('v1');

    // Override the merge gate to advisory while leaving prd/plan inheriting.
    await page.getByTestId('gate-trigger-merge').click();
    await page.getByRole('option', { name: 'Advisory' }).click();

    // Submit and wait for the success banner.
    await page.getByTestId('submit').click();
    await expect(page.getByTestId('form-saved')).toBeVisible({ timeout: 10000 });

    // Persistence: a row exists in supervisor_policies with the chosen values.
    const persisted = readPolicy(db, TEST_APP_ID);
    expect(persisted).toBeDefined();
    expect(persisted?.autonomy_level).toBe('autonomous');
    expect(persisted?.model_id).toBe('claude-sonnet-4');
    expect(persisted?.prompt_version).toBe('v1');
    expect(persisted?.feature_id).toBeNull();
    expect(persisted?.enabled).toBe(1);
    expect(persisted?.gate_authority_json).toBeTruthy();
    const gateAuthority = JSON.parse(persisted?.gate_authority_json ?? '{}');
    expect(gateAuthority).toMatchObject({ merge: 'advisory' });

    // Reload the page; the form must hydrate with the saved values.
    await page.reload();

    await expect(page.getByTestId('supervisor-config-form')).toBeVisible();
    await expect(page.getByTestId('autonomy-trigger')).toContainText('Autonomous');
    await expect(page.getByTestId('model-id-input')).toHaveValue('claude-sonnet-4');
    await expect(page.getByTestId('prompt-version-input')).toHaveValue('v1');
    await expect(page.getByTestId('gate-trigger-merge')).toContainText('Advisory');
  });
});
