import { createBdd } from 'playwright-bdd';
import { ApplicationsPage } from '../pages/applications.page.js';

/**
 * Step definitions for the applications flow.
 *
 * Steps are additive: any new .feature file is welcome to reuse the
 * Given/When/Then below, and to introduce new steps by appending to
 * this file. Keep each step a 1-line dispatch into a page object —
 * do NOT put raw page.locator() calls in here.
 */

const { Given, When, Then } = createBdd();

// ── Given ──────────────────────────────────────────────────────────

Given('I am running scenario {string}', async ({ page }, name: string) => {
  const apps = new ApplicationsPage(page);
  await apps.goto(name);
});

// ── When ───────────────────────────────────────────────────────────

When('I open the applications list', async ({ page }) => {
  const apps = new ApplicationsPage(page);
  await apps.goto('smoke');
});

// ── Then ───────────────────────────────────────────────────────────

Then('the web server should respond with the applications page', async ({ page }) => {
  const apps = new ApplicationsPage(page);
  await apps.expectLoaded();
});
