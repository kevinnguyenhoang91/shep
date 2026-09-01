<!--
SYNC IMPACT REPORT
==================
Version change: (unratified template scaffold) → 1.0.0

Principles added:
  - I. Code Quality First (new)
  - II. Test-First Development (NON-NEGOTIABLE) (new)
  - III. Layered Test Coverage (new)
  - IV. User Experience Consistency (new)
  - V. Performance Requirements (new)

Sections added:
  - Performance Standards (Section 2)
  - Development Workflow & Quality Gates (Section 3)
  - Governance

Sections removed: none (previous file was an unfilled scaffold)

Modified principles: none (initial ratification)

Follow-up TODOs: none — all placeholders resolved.

User input mapping:
  - "code quality"              → Principle I
  - "testing standards"         → Principles II and III
  - "user experience consistency" → Principle IV
  - "performance requirements"  → Principle V + Performance Standards section
-->

# Shep Constitution

## Core Principles

### I. Code Quality First

All code MUST follow Clean Architecture: dependencies point inward only
(`domain` ← `application` ← `infrastructure`/`presentation`), and the domain
layer MUST have zero external dependencies.

- Strict TypeScript is non-negotiable: `as any`, `@ts-ignore`, and
  `@ts-expect-error` are prohibited in all source files.
- `pnpm validate` (lint + format + typecheck + TypeSpec) MUST pass with zero
  errors before any merge.
- Domain models MUST be defined in TypeSpec (`tsp/`). Generated files under
  `packages/core/src/domain/generated/` MUST never be edited by hand.
- No component MAY hardcode an agent type; all agent resolution MUST flow
  through `IAgentExecutorProvider`.
- Complexity MUST be justified in review; prefer the simplest implementation
  that satisfies the spec. No speculative fallbacks or one-off helpers.
- All commits follow Conventional Commits (`<type>(<scope>): <subject>`).

Rationale: Shep orchestrates autonomous agents writing code at speed; only
mechanically enforced quality (types, lint, architecture boundaries) keeps the
codebase reviewable and safe to change.

### II. Test-First Development (NON-NEGOTIABLE)

TDD is mandatory for every behavior change. The Red-Green-Refactor cycle is
strictly enforced.

- RED: a failing test MUST be written first and observed failing.
- GREEN: only then is the minimal implementation written to pass it.
- REFACTOR: cleanup happens under green tests, with the suite re-run after.
- Every plan phase MUST define explicit TDD cycles (see
  `docs/development/tdd-guide.md`).
- Production code without a corresponding test that existed first is a
  compliance violation, regardless of test coverage measured later.

Rationale: agents and humans both write faster than they verify; tests written
first are the only reliable specification of behavior.

### III. Layered Test Coverage

Testing standards are layered to match the architecture; each layer has a
defined scope.

- Unit (`pnpm test:unit`): every use case, domain rule, and pure function.
- Integration (`pnpm test:int`): SQLite repositories, DI container wiring,
  adapter↔port contracts, and migrations.
- E2E (`pnpm test:e2e`): critical user journeys for both CLI and Web UI.
- Every web UI component MUST have a colocated `.stories.tsx` covering at
  minimum Default, Loading, and Error states. Commits without stories are
  rejected.
- Every bug fix MUST first add a regression test that reproduces the bug.
- Deleting a failing test to make a suite pass is prohibited; fix the code or
  document the behavior change in review.

Rationale: layered coverage catches regressions at the cheapest possible
level and keeps contract changes explicit.

### IV. User Experience Consistency

Shep exposes one product through three surfaces (CLI, TUI, Web). They MUST
behave as one coherent experience.

- Parity: any capability exposed in the Web dashboard MUST also be available
  via the CLI, and vice versa, unless the spec explicitly records an
  exception.
- One vocabulary: command names, state names, and terminology MUST be
  identical across CLI, TUI, and Web (e.g., a feature state is never
  "Blocked" in the CLI and "Failed" in the Web).
- Agent-agnostic surfaces: UX, CLI output, and docs MUST NOT reference a
  specific agent brand in shared flows; behavior MUST be identical regardless
  of the configured agent.
- Shared primitives: Web UI MUST use the established component library
  (shadcn/ui patterns) and the CLI MUST use the shared UI module for colors
  and output formatting — no bespoke styling per command.
- Incomplete features MUST ship behind feature flags; users MUST never
  encounter half-finished flows.

Rationale: users switch between dashboard and terminal within a single
workflow; divergent naming, styling, or capability gaps destroy trust in an
orchestration product.

### V. Performance Requirements

Performance budgets are acceptance criteria, not aspirations. Concrete budgets
are defined in the Performance Standards section.

- A change that regresses a budget MUST NOT merge without an explicit,
  documented exception in review.
- The local-first contract MUST hold: all state lives in local SQLite
  (`~/.shep/`); core CLI commands MUST function without network access.
- Streaming surfaces (agent logs, feature progress) MUST render
  incrementally; load-everything-then-render patterns are prohibited.
- Database access MUST use indexed queries; new tables and columns MUST ship
  with a migration and appropriate indexes; N+1 query patterns are
  prohibited in hot paths.

Rationale: Shep is a background companion to the user's terminal and IDE; slow
commands and janky dashboards are treated as defects because they block the
workflow the product exists to accelerate.

## Performance Standards

Initial targets ratified with v1.0.0 (p95, measured on a typical laptop-class
machine). Amending a budget follows the governance process.

| Surface | Budget (p95) | Measured by |
| --- | --- | --- |
| Core CLI commands (`shep status`, `shep feat ls`) | ≤ 500 ms | integration test timer |
| Daemon start (`shep start`) → healthy dashboard | ≤ 5 s | e2e test |
| Dashboard first paint (`localhost:4050`) | ≤ 2 s | Playwright e2e |
| Dashboard interaction (click → visible update) | ≤ 200 ms | Playwright e2e |
| Feature log streaming (first byte rendered) | ≤ 1 s | integration test |

- Budgets are validated by the test types listed; a budget without a
  measuring test is treated as unmet.
- These are initial proposals, not measured baselines; recalibrate within the
  first governance review if actuals differ materially.

## Development Workflow & Quality Gates

1. Spec first: all features start with a spec in `specs/NNN-feature-name/`
   (edit YAML only — Markdown is generated). No implementation without a
   spec.
2. Plan phases define explicit TDD cycles before any code is written.
3. Gate order for every change: RED test → implementation → GREEN →
   `pnpm validate` → full `pnpm test` → CI green → PR review.
4. Every PR review MUST verify constitution compliance: architecture
   boundaries, type safety, test-first evidence, UX parity, and budget
   impact. A reviewer who cannot verify a principle requests evidence rather
   than assuming it.
5. CI failures trigger agent auto-fix within configured retries; unexplained
   failures after retries escalate to a human, never force-merged.

## Governance

- This constitution supersedes all other practices and documentation. On
  conflict, the constitution wins.
- Amendments require: a written proposal with rationale, a migration plan for
  any affected in-flight work, review, and a semantic version bump:
  - MAJOR: principle removal or redefinition (backward-incompatible
    governance change)
  - MINOR: new principle or section, or materially expanded guidance
  - PATCH: clarifications, wording, and non-semantic refinements
- Compliance review: every PR review checks the principles above; violations
  block merge until resolved or explicitly amended.
- Runtime development guidance lives in `AGENTS.md` and `docs/`; use them for
  detail, but this constitution is authoritative on conflict.

**Version**: 1.0.0 | **Ratified**: 2026-09-01 | **Last Amended**: 2026-09-01
