/**
 * E2E: Supervisor dashboard happy path (spec 093, task-56).
 *
 * Verifies that GET /supervisor renders the dashboard with both
 * sections visible — Policies (grouped by scope) and Recent Decisions —
 * regardless of whether any policies or decisions are configured. The
 * dashboard renders empty-state copy when nothing is present, so the
 * test only asserts the structural surfaces are visible (no content
 * setup required).
 *
 * The whole surface is gated behind the `collaboration` feature flag.
 * See `tests/e2e/web/global-setup.ts` for the flip.
 */

import { test, expect } from '@playwright/test';

test.describe('Supervisor dashboard happy path (spec 093)', () => {
  test('renders dashboard with policies and recent-decisions sections', async ({ page }) => {
    await page.goto('/supervisor');

    const isNotFound = await page
      .getByRole('heading', { name: 'Not Found' })
      .isVisible()
      .catch(() => false);
    test.skip(
      isNotFound,
      'Collaboration flag is OFF in the running dev server. Restart `pnpm dev:web` to pick up the globalSetup flip.'
    );

    await expect(page.getByTestId('supervisor-dashboard')).toBeVisible();
    await expect(page.getByTestId('supervisor-policies')).toBeVisible();
    await expect(page.getByTestId('supervisor-recent-decisions')).toBeVisible();
  });
});
