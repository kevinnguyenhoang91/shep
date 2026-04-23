# E2E Testing (Mocked Agent)

Scalable Playwright + BDD infrastructure for the web UI's applications
flow. The harness runs the **real** Next.js server in-process, swaps
the LLM layer for a scenario-replay adapter, and isolates every run
from your running `pnpm dev:web` instance.

> **Status:** v1 delivers infrastructure + a smoke feature. The
> golden-path `new-app-html-elements` scenario ships as `@pending`
> until the scaffolder side of the flow is hermetic enough for CI.

## Architecture

```
Playwright test (.feature → generated .spec.ts via playwright-bdd)
     │
     │ navigates to /applications?e2eScenario=<name>
     ▼
Next.js request (real web server, real DI container)
     │
     │ request context sets scenario name in AsyncLocalStorage
     ▼
Use case → resolve('IAgentExecutorProvider')
     │
     ▼
ScenarioReplayExecutorFactory       [bound only when SHEP_E2E_MOCK_AGENT=1]
     │  reads scenario name from AsyncLocalStorage
     │  looks up the scenario in the pre-loaded map
     ▼
ScenarioReplayExecutor streams scripted turns:
     ├─ `text` turns → progress events carrying raw text
     └─ `tool-call` turns → progress events carrying a JSON envelope
```

## Isolation

The mock harness is **fully hermetic**. Running it does not touch
your local `pnpm dev:web` or `~/.shep/`:

| Risk                  | Mitigation                                                        |
| --------------------- | ----------------------------------------------------------------- |
| Port collision (3001) | `globalSetup` reserves a free port via `net.createServer(0)`      |
| Local DB pollution    | Fresh `SHEP_HOME=$(mktemp -d ...)` per run                        |
| Real LLM calls        | `SHEP_E2E_MOCK_AGENT=1` swaps `IAgentExecutorFactory` in DI       |
| Real cloud / GitHub   | _Planned_ — follow-up ships scenario-driven mocks behind the flag |
| Reused stale server   | `reuseExistingServer: false` — every run boots fresh              |

## Running

```bash
pnpm test:e2e:web:bdd
```

This runs `bddgen` to compile `.feature` files into generated specs
under `.features-gen/e2e/`, then launches Playwright against the
mocked harness. Output:

- HTML report: `playwright-report-mock/`
- Trace artifacts on failure: `test-results/e2e-mock/`

## Adding a new feature

1. **Write the scenario YAML.** Drop
   `tests/e2e/web/scenarios/<name>.scenario.yaml` following the
   schema documented in
   [`tests/e2e/web/scenarios/README.md`](../../tests/e2e/web/scenarios/README.md).

2. **Write the Gherkin feature.** Create
   `tests/e2e/web/features/<name>.feature` and reference the scenario:

   ```gherkin
   Feature: My new flow
     Scenario: happy path
       Given I am running scenario "<name>"
       When I open the applications list
       Then the web server should respond with the applications page
   ```

3. **Reuse existing steps if possible.** Shared step definitions live
   in [`tests/e2e/web/steps/applications.steps.ts`](../../tests/e2e/web/steps/applications.steps.ts).
   If you need a new step, append it to that file — do not introduce
   page.locator() calls at the step layer; go through page objects in
   [`tests/e2e/web/pages/`](../../tests/e2e/web/pages/).

4. **Run locally.**
   ```bash
   pnpm test:e2e:web:bdd tests/e2e/web/features/<name>.feature
   ```

## Relationship to existing test suites

| Command                   | What runs                                                |
| ------------------------- | -------------------------------------------------------- |
| `pnpm test:e2e:web`       | Existing Playwright suite against a normal dev server    |
| `pnpm test:e2e:web:bdd`   | This mocked-agent BDD suite (isolated server, scenarios) |
| `pnpm test:unit`          | Unit tests including scenario schema + loader            |
| `pnpm test:int`           | Integration tests including DI flag selection            |

The two Playwright suites are independent: they use different configs,
different ports, different home dirs, different scenarios. Running
one does not affect the other.

## Reference

- Replay executor: `packages/core/src/infrastructure/services/agents/common/executors/scenario-replay-executor.service.ts`
- Factory + AsyncLocalStorage: `packages/core/src/infrastructure/services/agents/common/executors/scenario-replay-executor-factory.service.ts`
- DI wiring: `packages/core/src/infrastructure/di/modules/register-agents.ts` (look for `SHEP_E2E_MOCK_AGENT`)
- Harness: `tests/e2e/web/helpers/mock-harness.ts`, `tests/e2e/web/global-setup.mock.ts`
- Playwright config: `playwright.mock.config.ts`
