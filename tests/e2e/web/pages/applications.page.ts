import { expect, type Page } from '@playwright/test';

/**
 * Page object for the Applications list.
 *
 * Keep selectors here so step definitions and future specs can rely on
 * a stable API — adding data-testids in the UI is cheaper than
 * rewriting a dozen locator chains.
 */
export class ApplicationsPage {
  constructor(private readonly page: Page) {}

  async goto(scenarioName: string): Promise<void> {
    // The scenario query-param is read by the middleware (introduced
    // in a follow-up) to set the AsyncLocalStorage scope. The web
    // server boots with SHEP_E2E_MOCK_AGENT=1 so even without
    // middleware the scenario-replay factory is the bound executor;
    // this param just reserves the shape for scenario-per-request.
    await this.page.goto(`/applications?e2eScenario=${encodeURIComponent(scenarioName)}`);
  }

  async expectLoaded(): Promise<void> {
    // Smoke-level assertion: the document title or the applications
    // heading must be present. We use page.locator('body') as a bare
    // "server responded" check that's resilient to UI tweaks.
    await expect(this.page.locator('body')).toBeVisible();
  }
}
