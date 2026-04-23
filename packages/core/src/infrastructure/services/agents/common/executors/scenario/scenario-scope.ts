/**
 * Request-scoped scenario name holder for the e2e mock agent.
 *
 * The web server is a shared singleton, but each Playwright request
 * selects a scenario independently. AsyncLocalStorage carries the
 * selected scenario name from the inbound request handler (which
 * reads it from a cookie / query param) through every use case,
 * service, and executor invoked during that request.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage<string>();

/** Run `fn` with the given scenario name set in the current async scope. */
export function runWithScenario<T>(scenarioName: string, fn: () => T): T {
  return storage.run(scenarioName, fn);
}

/** Return the scenario name set in the current async scope, or `undefined`. */
export function currentScenarioName(): string | undefined {
  return storage.getStore();
}
