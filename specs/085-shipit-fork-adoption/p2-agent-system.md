# P2 - Agent System

## Item 19: GitHub Copilot CLI + Rovo Dev CLI Integration

**Source commit:** `8a5d7b04`

### Current State

**Copilot CLI: ALREADY IMPLEMENTED**
- Executor: `packages/core/src/infrastructure/services/agents/common/executors/copilot-cli-executor.service.ts` (18KB)
- TypeSpec enum: `CopilotCli: "copilot-cli"` in `tsp/common/enums/agent-config.tsp`
- Factory case: registered in `agent-executor-factory.service.ts`
- Models: `COPILOT_CLI_MODELS` array defined (claude, gpt, o-series)
- CLI info: `{ agentType: 'copilot-cli', cmd: 'copilot', versionArgs: ['--version'] }`
- UI label: `'copilot-cli': 'Copilot CLI'` in `agent-settings-section.tsx:23`
- Auth detection: 2-tier (env vars + `gh auth status`)

**Rovo Dev: NOT IMPLEMENTED**
- No executor service
- No TypeSpec enum value
- No factory registration
- No UI components

### Agent Registration Pattern (existing)
Each agent requires changes in ~8 locations:
1. TypeSpec enum (`tsp/common/enums/agent-config.tsp`)
2. TypeSpec tool type (`tsp/common/enums/tool.tsp`)
3. Executor service (`packages/core/src/.../executors/`)
4. Factory switch + model list + CLI info (`agent-executor-factory.service.ts`)
5. Auth detection (`src/presentation/web/app/actions/check-agent-auth.ts`)
6. Agent icons (`src/presentation/web/components/common/feature-node/agent-type-icons.tsx`)
7. Agent labels in settings UI (`agent-settings-section.tsx`)
8. Agent model labels (`get-all-agent-models.ts`)

### Plan for Rovo Dev Integration
1. **Research** Rovo Dev CLI:
   - Binary name, version flag, auth method
   - Execution flags (prompt, JSON output, autonomous mode)
   - Model support and tool restriction flags
2. **TypeSpec updates:**
   - Add `RovoDev: "rovo-dev"` to `AgentType` enum
   - Add tool type if needed
   - Run `pnpm tsp:codegen`
3. **Create executor:**
   - `packages/core/src/infrastructure/services/agents/common/executors/rovo-dev-executor.service.ts`
   - Implement `IAgentExecutor` interface
   - Follow copilot-cli-executor as template
4. **Register in factory:**
   - Add switch case for `'rovo-dev'`
   - Add `ROVO_DEV_MODELS` constant
   - Add CLI info entry
5. **Auth detection:**
   - Add Rovo Dev to `check-agent-auth.ts` (Atlassian OAuth or token)
6. **UI components:**
   - Add icon to `agent-type-icons.tsx`
   - Add label to `agent-settings-section.tsx`
   - Add to `AgentModelPicker` options

### Files to Change
- `tsp/common/enums/agent-config.tsp` (add enum value)
- `tsp/common/enums/tool.tsp` (add enum value)
- **New:** `packages/core/src/.../executors/rovo-dev-executor.service.ts`
- `packages/core/src/.../agent-executor-factory.service.ts` (factory, models, CLI info)
- `src/presentation/web/app/actions/check-agent-auth.ts`
- `src/presentation/web/app/actions/get-all-agent-models.ts`
- `src/presentation/web/components/common/feature-node/agent-type-icons.tsx`
- `src/presentation/web/components/features/settings/agent-settings-section.tsx`
- `src/presentation/web/components/features/settings/AgentModelPicker/index.tsx`
- `packages/core/src/infrastructure/di/container.ts` (or DI module)
- Generated output + tests

### Dependencies: Item 12 (ExecutorBase) - can extend base class
### Risk: MEDIUM - new agent integration, but well-established pattern
### Impact: HIGH - adds competitive agent support

---

## Item 20: Per-Agent Permission Modes

**Source commits:** `c2a098aa`, `d3a7c2c4`, `72f64fbd`

### Current State
- **Universal permission mode** - all agents use same hardcoded flags
- No `PermissionMode` concept in TypeSpec models
- `AgentConfig` model contains only: `type`, `authMethod`, `token`
- Each executor hardcodes its own permission flags:
  - Copilot: `--allow-all` (line 47-54)
  - Claude Code: no explicit permission flag
  - Codex: `--sandbox danger-full-access` (missing `--ask-for-approval never` - Bug 6.2)
  - Cursor: `--yolo` (wrong flag - Bug 6.1)

### Plan
1. **TypeSpec model updates:**
   ```typespec
   // tsp/common/enums/agent-config.tsp
   enum PermissionMode {
     Strict: "strict",           // Prompt for everything
     Default: "default",         // Agent's default behavior
     Autonomous: "autonomous",   // No prompts, full access
   }
   ```
   ```typespec
   // tsp/domain/entities/settings.tsp - extend AgentConfig
   model AgentConfig {
     type: AgentType;
     authMethod: AgentAuthMethod;
     token?: string;
     permissionMode?: PermissionMode;  // Per-agent default
   }
   ```
2. **Executor interface update:**
   - Add `permissionMode?: PermissionMode` to `AgentExecutionOptions`
3. **Per-executor flag mapping:**
   - Claude Code: `strict` -> `--permission-mode plan`, `autonomous` -> no restriction
   - Copilot: `strict` -> remove `--allow-all`, `autonomous` -> `--allow-all`
   - Codex: `strict` -> `--ask-for-approval always`, `autonomous` -> `--ask-for-approval never`
   - Cursor: `strict` -> interactive, `autonomous` -> `--force`
   - Gemini: map to `--sandbox` levels
4. **Settings persistence:**
   - Update SQLite mapper for `permissionMode` field
   - Add migration if schema versioning is used
5. **UI components:**
   - Permission picker in agent settings section
   - Per-feature permission override in feature create drawer
6. **CLI command:**
   - `shep settings permissions` command
   - `shep feat new --permission-mode <mode>` flag

### Files to Change
- `tsp/common/enums/agent-config.tsp` (new enum)
- `tsp/domain/entities/settings.tsp` (extend AgentConfig)
- `packages/core/src/application/ports/output/agents/agent-executor.interface.ts`
- All 6 executor service files (flag mapping per mode)
- `packages/core/src/infrastructure/repositories/sqlite-settings.repository.ts`
- `src/presentation/web/components/features/settings/agent-settings-section.tsx`
- `src/presentation/cli/commands/settings/` (new permissions command)
- Generated output + tests

### Dependencies: Item 6 (executor bug fixes) - fix flags first, then make configurable
### Risk: HIGH - 76+ files in fork, touches every agent path
### Impact: HIGH - enables fine-grained control per agent

---

## Item 21: Agent Availability Badges + OAuth Auth Detection Fix

**Source commit:** `70232f99`

### Current State
**Auth detection:** 2-tier system already implemented in `check-agent-auth.ts`:
- Tier 1 (instant): env vars + credential file checks
- Tier 2 (~200ms): subprocess validation (`claude auth status`, `gh auth status`, etc.)

**Agent status badge:** `AgentStatusBadge.tsx` exists but shows **session status** (booting/ready/stopped/error), not **availability**.

**Agent picker:** `AgentModelPicker/index.tsx` shows agents without availability indicators.

### Plan
1. **Create availability badge component:**
   ```typescript
   // src/presentation/web/components/features/settings/AgentAvailabilityBadge.tsx
   type AvailabilityStatus = 'available' | 'installed-only' | 'not-installed' | 'checking';
   ```
   - Green badge: installed + authenticated
   - Yellow badge: installed but needs auth
   - Red/disabled: not installed
   - Spinner: checking
2. **Create availability hook:**
   ```typescript
   // src/presentation/web/hooks/use-agent-availability.ts
   export function useAgentAvailability(agentType: AgentType) {
     // Calls checkAgentAuth() + checkAgentTool()
     // Caches results with 30s TTL
     return { isInstalled, isAuthenticated, loading };
   }
   ```
3. **Update agent picker:**
   - Add `<AgentAvailabilityBadge>` next to each agent in picker list
   - Disable selection of unavailable agents with install guidance
4. **Update agent settings section:**
   - Show availability status next to selected agent
   - Show auth instructions if installed but not authenticated

### Files to Change
- **New:** `src/presentation/web/components/features/settings/AgentAvailabilityBadge.tsx`
- **New:** `src/presentation/web/hooks/use-agent-availability.ts`
- `src/presentation/web/components/features/settings/AgentModelPicker/index.tsx`
- `src/presentation/web/components/features/settings/agent-settings-section.tsx`
- Storybook stories for new components

### Dependencies: None - uses existing `checkAgentAuth` action
### Risk: LOW - additive UI components
### Impact: MEDIUM - better UX for agent selection

---

## Execution Order

```
Item 21 (availability badges)   ──> Independent, quick UI win
Item 19 (Rovo Dev integration)  ──> After Item 12 (ExecutorBase)
Item 20 (per-agent permissions)  ──> After Items 6 (bug fixes) + 19 (all agents)
```

## Estimated Effort
- Item 19: 2-3 days (research Rovo Dev CLI + full integration)
- Item 20: 3-4 days (TypeSpec + all executors + UI + CLI)
- Item 21: 1 day (UI components + hook)
- **Total: ~6-8 days**
