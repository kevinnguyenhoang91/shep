# P1 - Architecture Refactors

## Item 9: DI Container Modularization

**Source commit:** `050940eb`

### Current State
**File:** `packages/core/src/infrastructure/di/container.ts` (644 lines)

Single monolithic `initializeContainer()` function registering everything:
- Lines 1-163: Imports (all bundled)
- Lines 175-187: Database setup
- Lines 189-209: Repository registrations
- Lines 222-270: Service registrations (10+ services)
- Lines 271-348: Agent infrastructure (factory, provider, caller, registry, runner)
- Lines 367-425: Use cases (40+)
- Lines 426-445: Session repositories per AgentType
- Lines 449-565: String-token aliases for web routes (Turbopack DI)
- Lines 567-605: Interactive session infrastructure
- Lines 600-623: Interactive session use cases

### Plan
1. Create module registration files in `packages/core/src/infrastructure/di/modules/`:
   ```
   modules/
     database.module.ts          (DB setup + 3 repositories)
     services.module.ts          (10+ services: Version, Worktree, Git, IDE, etc.)
     agent-infrastructure.module.ts  (factory, provider, runner, registries)
     notifications.module.ts     (notification service, bus, desktop notifier)
     use-cases.module.ts         (40+ use cases)
     interactive.module.ts       (session repos, service, interactive use cases)
     web-tokens.module.ts        (string-token aliases for Turbopack)
   ```
2. Each module exports a `register(container: Container): void` function
3. Reduce `initializeContainer()` to ~80-line orchestrator calling modules in order
4. Write integration test verifying all DI bindings resolve correctly

### Files to Change
- **New:** 7 module files in `packages/core/src/infrastructure/di/modules/`
- **Refactor:** `packages/core/src/infrastructure/di/container.ts` (644 -> ~80 lines)
- **New:** Integration test for DI resolution

### Dependencies: None - can start immediately
### Risk: MEDIUM - touching DI wiring affects everything; thorough testing required
### Impact: HIGH - enables easier refactoring of all subsequent items

---

## Item 10: Decompose GitPrService

**Source commit:** `4c152484`

### Current State
**File:** `packages/core/src/infrastructure/services/git/git-pr.service.ts` (1,078 lines, 35 methods)

**Responsibilities identified:**
- Branch/remote operations: `hasRemote`, `getRemoteUrl`, `getDefaultBranch`, `revParse`, etc.
- Diff analysis: `getPrDiffSummary`, `getFileDiffs`
- PR/branch discovery: `listPrStatuses`, `getMergeableStatus`, `getBranchSyncStatus`
- CI status monitoring: `getCiStatus`, `watchCi`, `verifyMerge`, `getFailureLogs`
- PR creation/merge: `createPr`, `mergePr`, `localMergeSquash`, `createGitHubRepo`
- Conflict resolution: `getConflictedFiles`, `stageFiles`, `rebaseContinue/Abort`
- Commit/stash: `hasUncommittedChanges`, `commitAll`, `push`, `stash*`

### Plan
1. Create 6 focused services in `packages/core/src/infrastructure/services/git/`:
   ```
   git/
     diff-analyzer.service.ts      (~120 lines: getPrDiffSummary, getFileDiffs)
     branch-discovery.service.ts   (~140 lines: hasRemote, getRemoteUrl, getDefaultBranch, getBranchSyncStatus)
     ci-status.service.ts          (~100 lines: getCiStatus, watchCi, getFailureLogs)
     pr-creation.service.ts        (~100 lines: createPr, createGitHubRepo)
     merge-strategy.service.ts     (~180 lines: mergePr, localMergeSquash, mergeBranch, syncMain, rebaseOnMain)
     git-error-utils.ts            (~80 lines: conflict resolution, stash, commit helpers)
   ```
2. Create facade `GitPrService` that delegates to sub-services (for backward compat)
3. Update DI registrations to wire sub-services
4. Update all callers to use sub-services directly (gradual migration)
5. Once all callers migrated, remove facade

### Files to Change
- **New:** 6 service files in `packages/core/src/infrastructure/services/git/`
- **Refactor:** `git-pr.service.ts` (becomes thin facade, then deleted)
- `packages/core/src/infrastructure/di/container.ts` (register new services)
- All callers of `GitPrService` methods

### Dependencies: Item 9 (DI modularization) makes wiring easier
### Risk: MEDIUM - many callers to update
### Impact: HIGH - eliminates 1,078-line god class

---

## Item 11: Decompose InteractiveSessionService

**Source commit:** `85c656b1`

### Current State
**File:** `packages/core/src/infrastructure/services/interactive/interactive-session.service.ts` (1,284 lines, 18 methods)

**Responsibilities identified:**
- Session lifecycle: `startSession`, `stopSession`, `stopByFeature`
- Turn execution: `sendMessage`, `sendUserMessage`, `executeTurn`, `processStreamChunk`
- Chat state reconstruction: `getChatState` (complex DB -> UI state mapping)
- Session persistence: `getMessages`, `clearMessages`, `getSession`, `getTurnStatuses`
- User interaction: `respondToInteraction` (resolver pattern with promises)
- Real-time subscriptions: subscriber management, feature/session-level

### Plan
1. Create 5 focused classes in `packages/core/src/infrastructure/services/interactive/`:
   ```
   interactive/
     session-boot-sequence.ts      (~160 lines: startSession, boot orchestration)
     turn-executor.ts              (~270 lines: sendMessage, executeTurn, stream processing)
     chat-state-builder.ts         (~110 lines: getChatState, UI state mapping)
     session-state-manager.ts      (~120 lines: getSession, getMessages, stop, cleanup)
     subscriber-notifier.ts        (~80 lines: subscribe, unsubscribe, notify)
   ```
2. `InteractiveSessionService` becomes orchestrator delegating to sub-classes
3. Update DI container to wire sub-classes
4. Move `respondToInteraction` into `TurnExecutor` (tightly coupled to turn state)

### Files to Change
- **New:** 5 class files in `packages/core/src/infrastructure/services/interactive/`
- **Refactor:** `interactive-session.service.ts` (1,284 -> ~100 line orchestrator)
- `packages/core/src/infrastructure/di/container.ts`
- Callers of `InteractiveSessionService` methods

### Dependencies: Item 9 (DI modularization)
### Risk: HIGH - complex stateful service with real-time subscriptions
### Impact: HIGH - eliminates 1,284-line god class with intertwined concerns

---

## Item 12: Extract ExecutorBase + SessionRepositoryBase

**Source commit:** `6a764766`

### Current State
**8 executor implementations** in `packages/core/src/infrastructure/services/agents/common/executors/`:
- `claude-code-executor.service.ts` (487 lines)
- `cursor-executor.service.ts` (457 lines)
- `codex-cli-executor.service.ts` (745 lines)
- `copilot-cli-executor.service.ts`
- `gemini-cli-executor.service.ts`
- `claude-code-interactive-executor.service.ts`
- `dev-executor.service.ts`

**Duplicated patterns across ALL executors (~30-40% code):**
1. Debug logging: `log(message)` with timestamp + phase prefix (identical in all)
2. Constructor + silent flag pattern
3. Promise-based execution wrapper with timeout
4. Stream line buffering and JSON parsing
5. ENOENT error handling with helpful install messages
6. `buildSpawnOptions()` boilerplate

**3 session repositories** with shared file I/O patterns:
- `claude-code-session.repository.ts`
- `codex-cli-session.repository.ts`
- `stub-session.repository.ts`

### Plan
1. Create `AbstractAgentExecutor` base class:
   ```typescript
   // packages/core/src/infrastructure/services/agents/common/executors/abstract-agent-executor.ts
   export abstract class AbstractAgentExecutor implements IAgentExecutor {
     protected silent = false;
     constructor(protected readonly spawn: SpawnFunction) {}
     
     protected log(message: string): void { /* shared */ }
     protected buildSpawnOptions(cwd?: string): SpawnOptions { /* shared */ }
     protected executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> { /* shared */ }
     protected handleEnoent(binary: string, error: Error): never { /* shared */ }
     
     abstract execute(prompt: string, options?: AgentExecutionOptions): Promise<AgentExecutionResult>;
   }
   ```
2. Create `SessionRepositoryBase` for shared file I/O:
   ```typescript
   // packages/core/src/infrastructure/services/agents/sessions/session-repository-base.ts
   export abstract class SessionRepositoryBase {
     protected readSessionFile(path: string): string | null { /* shared */ }
     protected writeSessionFile(path: string, data: string): void { /* shared */ }
   }
   ```
3. Migrate each executor to extend `AbstractAgentExecutor`
4. Migrate each session repo to extend `SessionRepositoryBase`
5. Delete duplicated code from each implementation (~590 lines total)

### Files to Change
- **New:** `abstract-agent-executor.ts`, `session-repository-base.ts`
- **Refactor:** All 7 executor files (remove duplicated methods)
- **Refactor:** 3 session repository files
- Tests for base class behavior

### Dependencies: None - can start immediately
### Risk: MEDIUM - refactoring inheritance in critical path
### Impact: HIGH - eliminates ~590 lines of duplication, standardizes behavior

---

## Item 13: Extract PollAgentEventsUseCase from SSE Route

**Source commit:** `f8f41996`

### Current State
**File:** `src/presentation/web/app/api/agent-events/route.ts` (467 lines)

**Business logic in route (lines 122-449):** ~250 lines of:
- Feature/run state delta detection
- 6 different NotificationEventType emissions
- Status-to-event mapping
- Phase completion tracking
- Interactive session polling
- Cache state management

**Should stay in route:** ~200 lines of SSE formatting, heartbeat, cleanup.

### Plan
1. Create `PollAgentEventsUseCase`:
   ```typescript
   // packages/core/src/application/use-cases/notifications/poll-agent-events.use-case.ts
   export class PollAgentEventsUseCase {
     execute(filter?: { runId?: string }): Promise<NotificationEvent[]> {
       // All business logic from poll() function
     }
   }
   ```
2. Move cache state into use case (per-connection via constructor or method param)
3. Route becomes thin SSE adapter:
   - Creates SSE stream
   - Calls `useCase.execute()` on interval
   - Formats events as SSE messages
   - Handles heartbeat + cleanup
4. Register in DI container with string token for Turbopack

### Files to Change
- **New:** `packages/core/src/application/use-cases/notifications/poll-agent-events.use-case.ts`
- **New:** Test file for use case
- **Refactor:** `src/presentation/web/app/api/agent-events/route.ts` (467 -> ~200 lines)
- `packages/core/src/infrastructure/di/container.ts` (register use case)

### Dependencies: Item 5 (batch SSE) can be done together
### Risk: LOW - clean extraction, no behavior change
### Impact: MEDIUM - enforces "use cases as only entry point" rule

---

## Item 14: Create Missing Port Interfaces

**Source commit:** `18ee4b59`

### Current State - Direct Infrastructure Usage Found

1. **IProcessMonitorService** - MISSING
   - Usage: `src/presentation/web/app/api/agent-events/route.ts:230` calls `isProcessAlive(run.pid)`
   - Impl: `packages/core/src/infrastructure/services/process/is-process-alive.ts`

2. **IAttachmentStorageService** - MISSING PORT
   - Impl: `packages/core/src/infrastructure/services/attachment-storage.service.ts` (120 lines, direct fs ops)
   - Used by: CreateFeatureUseCase, interactive routes

3. **IFileSystemService** - MISSING
   - Violations: `create-feature.use-case.ts:297-301` uses `readFileSync` directly
   - `tool-metadata.ts:11,99-125` uses `readdirSync`, `readFileSync`

4. **IToolMetadataLoader** - MISSING
   - Impl: `packages/core/src/infrastructure/services/tool-installer/tool-metadata.ts`
   - Dynamically loads `/tools/*.json` files

### Plan
1. Create port interfaces in `packages/core/src/application/ports/output/services/`:
   ```
   services/
     process-monitor.interface.ts    -> IProcessMonitorService { isAlive(pid): boolean }
     attachment-storage.interface.ts -> IAttachmentStorageService { store, retrieve, list, delete }
     file-system.interface.ts        -> IFileSystemService { readFile, writeFile, readDir, exists }
     tool-metadata-loader.interface.ts -> IToolMetadataLoader { loadAll(): ToolMetadata[] }
   ```
2. Update existing implementations to implement new interfaces
3. Register via DI container
4. Update callers to inject interfaces instead of importing directly

### Files to Change
- **New:** 4 port interface files
- **Update:** 4 infrastructure implementations (add `implements`)
- **Update:** DI container registrations
- **Update:** All direct callers (~6 files)

### Dependencies: Item 9 (DI modularization) for cleaner registration
### Risk: LOW - additive interfaces, then gradual caller migration
### Impact: MEDIUM - enforces clean architecture boundaries

---

## Item 15: Replace getSettings() Singleton with DI

**Source commit:** `0725bb1d`, `e14a2bf4`

### Current State
**45 files** call `getSettings()` directly. Violations by layer:

**Application layer (CRITICAL - 2 files):**
- `packages/core/src/application/use-cases/features/create/create-feature.use-case.ts:36,201,312`
- `packages/core/src/infrastructure/services/interactive/interactive-session.service.ts:38`

**Presentation layer (15+ files):**
- Web actions: `check-agent-auth.ts`, `get-workflow-defaults.ts`, `update-model.ts`, `get-supported-models.ts`, `open-ide.ts`, `agent-setup-flag.ts`
- CLI commands: `index.ts:96`, `feat/new.command.ts`, `settings/*.command.ts`, `repo/add.command.ts`
- Web lib utilities: `feature-flags.ts`, `language.ts`, `fab-layout.ts`

**Infrastructure (8-10 files - acceptable but should prefer DI):**
- `settings.service.ts`, `auto-archive-watcher.service.ts`, `notification.service.ts`, etc.

### Plan
1. Create `ISettingsReader` port interface:
   ```typescript
   // packages/core/src/application/ports/output/services/settings-reader.interface.ts
   export interface ISettingsReader {
     getSettings(): Settings;
     hasSettings(): boolean;
   }
   ```
2. Implement adapter wrapping existing `getSettings()`:
   ```typescript
   // packages/core/src/infrastructure/services/settings-reader.adapter.ts
   export class SettingsReaderAdapter implements ISettingsReader {
     getSettings() { return getSettings(); }
     hasSettings() { return hasSettings(); }
   }
   ```
3. Register in DI container as singleton
4. **Phase 1:** Fix application layer violations (2 files) - inject `ISettingsReader`
5. **Phase 2:** Fix presentation layer violations (15+ files) - inject via DI
6. **Phase 3:** Fix infrastructure layer (8-10 files) - opportunistic

### Files to Change
- **New:** `settings-reader.interface.ts`, `settings-reader.adapter.ts`
- **Phase 1:** 2 application-layer files
- **Phase 2:** 15+ presentation-layer files
- **Phase 3:** 8-10 infrastructure files
- DI container registration

### Dependencies: Item 9 (DI modularization)
### Risk: MEDIUM - widespread changes, but mechanical (find/replace pattern)
### Impact: HIGH - fixes our own `code-quality.md` rule violation across 45 files

---

## Execution Order

```
Item 9  (DI modularization)     ──> Foundation - do first
Item 12 (ExecutorBase)          ──> Independent, can parallelize with 9
Item 14 (Port interfaces)      ──> After Item 9
Item 15 (getSettings DI)       ──> After Item 9 + 14
Item 10 (GitPrService)         ──> After Item 9
Item 11 (InteractiveSession)   ──> After Item 9
Item 13 (PollAgentEvents)      ──> After Item 9, combine with P1 Item 5
```

## Estimated Effort
- Item 9: 4-6 hours
- Item 10: 6-8 hours
- Item 11: 8-10 hours (most complex)
- Item 12: 4-6 hours
- Item 13: 2-3 hours
- Item 14: 2-3 hours
- Item 15: 4-6 hours (phased)
- **Total: ~4-5 days**
