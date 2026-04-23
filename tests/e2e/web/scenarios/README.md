# E2E Agent Scenarios

This directory holds declarative YAML fixtures that drive the mocked
agent in web e2e tests. Each file defines one **scenario** — a
scripted sequence of agent turns (text deltas, tool calls, timings)
plus optional mocks for remote services (cloud deploy, GitHub).

Scenarios are loaded once at web-server boot when the server is
started with `SHEP_E2E_MOCK_AGENT=1`. Each Playwright request selects
a scenario by name via `?e2eScenario=<name>`; the scenario is read
per request through `AsyncLocalStorage`, so a single web server can
serve parallel tests running different scenarios.

## File format

File naming: `<name>.scenario.yaml`. Nested subdirectories are allowed.

```yaml
version: 1
name: my-scenario
description: Optional human-readable summary.
turns:
  - kind: text
    text: Analyzing the project.
    delayMs: 30 # optional — pause in ms before emitting this turn
  - kind: tool-call
    tool: writeFile
    input: { path: 'src/App.tsx', content: '…' }
    result: { ok: true } # optional scripted tool result
mocks: # optional
  cloud:
    deploymentId: dep_abc
    finalUrl: https://example.pages.dev
    statusSequence:
      - { status: queued }
      - { status: deployed, url: https://example.pages.dev }
  github:
    owners: [shep-bot]
    createRepoResults: [conflict, ok]
```

The schema is defined in
[`packages/core/src/infrastructure/services/agents/common/executors/scenario/schema.ts`](../../../../packages/core/src/infrastructure/services/agents/common/executors/scenario/schema.ts).
Any schema violation fails fast at web-server boot with the file
path and offending field name — it will never surface as a
mid-request 500.

## Authoring a new scenario

1. Drop `my-thing.scenario.yaml` in this directory.
2. Reference it in a `.feature` file: `Given I am running scenario "my-thing"`.
3. Run `pnpm test:e2e:web:bdd` — a random free port + fresh
   `SHEP_HOME` temp dir are allocated per run, so nothing collides
   with your local `pnpm dev:web`.

## Running

```bash
pnpm test:e2e:web:bdd
```

See [`docs/development/e2e-testing.md`](../../../../docs/development/e2e-testing.md)
for the full architecture walkthrough.
