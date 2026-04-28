# AGENTS.md

Guidance for AI coding agents (Cursor, Windsurf, Copilot, etc.) working in this repository.

## Project

`@shepai/cli` — Autonomous AI Native SDLC Platform. Users run `shep` in a repo to gather requirements via AI, generate plans, and execute implementation autonomously.

## Spec Workflow

**All feature work MUST begin with a spec.** See [spec-driven-workflow](./docs/development/spec-driven-workflow.md).

Specs live in `specs/NNN-feature-name/`. **Edit YAML only — Markdown is auto-generated.**

## Commands

| Command          | Purpose                         |
| ---------------- | ------------------------------- |
| `pnpm build`     | Build CLI + web                 |
| `pnpm test`      | Run all tests                   |
| `pnpm test:unit` | Unit tests only                 |
| `pnpm test:int`  | Integration tests only          |
| `pnpm test:e2e`  | Playwright e2e tests            |
| `pnpm lint:fix`  | Fix lint issues                 |
| `pnpm validate`  | Lint + format + typecheck + tsp |
| `pnpm dev:cli`   | Run CLI locally (ts-node)       |
| `pnpm dev:web`   | Start Next.js dev server        |

## Architecture

Clean Architecture — four layers in `packages/core/src/` (dependencies point inward):

- `domain/` — Core business logic, no external deps
- `application/` — Use cases, output port interfaces
- `infrastructure/` — External concerns: DB, agents, services
- `presentation/` — CLI, TUI, Web UI (`src/presentation/`)

See [clean-architecture](./docs/architecture/clean-architecture.md).

## Mandatory Rules

- **MANDATORY — TDD**: Write failing tests FIRST (RED → GREEN → REFACTOR). Every plan phase must define explicit TDD cycles. See [tdd-guide](./docs/development/tdd-guide.md).
- **MANDATORY — TypeSpec-first**: Domain models defined in `tsp/`. Run `pnpm tsp:compile` to generate `packages/core/src/domain/generated/output.ts`. Never edit generated files. See [typespec-guide](./docs/development/typespec-guide.md).
- **MANDATORY — Agent resolution**: No component may hardcode an agent type. All resolution flows through `IAgentExecutorProvider`. See [agent-system](./docs/architecture/agent-system.md). The supervisor agent (spec 093) follows the same rule — its evaluator LLM is resolved through `IAgentExecutorProvider`, never a hardcoded provider SDK.
- **MANDATORY — Storybook stories**: Every web UI component MUST have a colocated `.stories.tsx` file. Commits without stories will be rejected.
- **MANDATORY — Spec-driven**: All features start with a spec. No implementation without a spec.
- **MANDATORY — Actor namespaces**: When an agent acts on a user's behalf (e.g., the supervisor closing an approval gate), it MUST use the `supervisor:<id>` actor namespace. The user namespace `user:<id>` always wins on conflict — `ApproveAgentRunUseCase` / `RejectAgentRunUseCase` enforce this invariant. See [supervision](./docs/architecture/supervision.md#user-always-wins-invariant).

## Commit Format

[Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <subject>`

| Types | feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert |
| Scopes | specs, cli, tui, web, api, domain, agents, deployment, tsp, deps, config, dx, release, ci |

## Key Docs

| Topic                          | Doc                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| Architecture overview          | [docs/architecture/overview.md](./docs/architecture/overview.md)                       |
| Domain models + field listings | [docs/api/domain-models.md](./docs/api/domain-models.md)                               |
| Repository pattern + DI        | [docs/architecture/repository-pattern.md](./docs/architecture/repository-pattern.md)   |
| Agent system                   | [docs/architecture/agent-system.md](./docs/architecture/agent-system.md)               |
| Agent collaboration & supervision | [docs/architecture/supervision.md](./docs/architecture/supervision.md)              |
| Settings service               | [docs/architecture/settings-service.md](./docs/architecture/settings-service.md)       |
| TypeSpec guide                 | [docs/development/typespec-guide.md](./docs/development/typespec-guide.md)             |
| Testing guide                  | [docs/development/tdd-guide.md](./docs/development/tdd-guide.md)                       |
| Implementation patterns        | [docs/development/implementation-guide.md](./docs/development/implementation-guide.md) |
| CI/CD + Docker                 | [docs/development/cicd.md](./docs/development/cicd.md)                                 |
| Adding agents                  | [docs/development/adding-agents.md](./docs/development/adding-agents.md)               |
| CLI architecture               | [docs/cli/architecture.md](./docs/cli/architecture.md)                                 |
| TUI architecture               | [docs/tui/architecture.md](./docs/tui/architecture.md)                                 |
| Web UI architecture            | [docs/ui/architecture.md](./docs/ui/architecture.md)                                   |
| pnpm workspaces + setup        | [docs/development/setup.md](./docs/development/setup.md)                               |


## Supervisor Agent (spec 093)

A delegated **supervisor agent** can monitor approval gates and agent questions on
behalf of the user. The whole surface is gated behind the `collaboration` feature flag.

| Concept | Where |
|---|---|
| `SupervisorPolicy` (config) | `tsp/agents/supervisor-policy.tsp` → `supervisor_policies` table |
| `SupervisorDecision` (audit) | `tsp/agents/supervisor-decision.tsp` → `supervisor_decisions` + `activity_log` |
| `ISupervisorAgent` port | `packages/core/src/application/ports/output/agents/supervisor-agent.interface.ts` |
| Evaluator workflow | `packages/core/src/infrastructure/services/agents/supervisor-agent/supervisor-graph.ts` |
| Per-scope worker | `packages/core/src/infrastructure/services/agents/supervisor-agent/supervisor-agent-worker.ts` |

Policy resolution is **feature-first then app-fallback**, matching every other
scoped concept in Shep.

### Autonomy ladder

| Level | Supervisor authority | User role |
|---|---|---|
| `advisory` *(default)* | recommend (`advise` / `escalate`) | always acts on every gate |
| `cosign` | approve / reject pre-vote | also approves before gate passes |
| `autonomous` | closes gates via the existing approve/reject use cases with `actor = supervisor:<id>` | optional override at any time |

### `supervisor:<id>` actor namespace

When the supervisor closes a gate, it invokes the existing
`ApproveAgentRunUseCase` / `RejectAgentRunUseCase` with `actor.namespace =
"supervisor:<id>"`. Both use cases enforce the **"user always wins"** invariant:
if a prior `user:<id>` decision exists for the same gate, the supervisor's call
is refused and the rejection is recorded.

This keeps the existing `waiting_approval` state machine as the single source of
truth — no new pause primitive was invented.

### Unified question pipeline

`AgentQuestion` (`tsp/agents/agent-question.tsp`, table `agent_questions`) is
the single inbox that bridges:

- The Claude Code SDK V2 `canUseTool` interception of `AskUserQuestion` in
  `claude-code-interactive-executor.service.ts` (interactive mode), and
- The parallel `AgentQuestion` of `kind = blocking` emitted by
  `feature-agent-worker.ts` whenever a run hits `waiting_approval`
  (background mode).

Both modes converge on `AnswerAgentQuestionUseCase`. See
[docs/architecture/supervision.md](./docs/architecture/supervision.md) for the
full design and sequence diagrams.

## General
### 1. Self-Improvement Loop
- After ANY correction from the user: update `LESSONS.md` (project root) with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project
- Keep lessons short and concise

### 2. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes – don't over-engineer
- Challenge your own work before presenting it