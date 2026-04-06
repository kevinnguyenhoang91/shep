# P1 - Correctness & Performance

## Item 5: Batch SSE Queries

**Source commit:** `6848b7c5`

### Current State
**File:** `src/presentation/web/app/api/agent-events/route.ts` (467 lines)

- Poll interval: 2,000ms (line 36)
- **Per-poll queries (initial seed):** `2N + 1` where N = active features
  - 1x `listFeatures.execute()` - fetches ALL features
  - Nx `agentRunRepo.findById()` - one per feature with agent run
  - Nx `phaseTimingRepo.findByRunId()` - one per feature with timing
- **Existing optimizations:** Per-connection delta cache, selective re-querying, interactive session batching via `sessionRepo.findAllActive()`

### Plan
1. Add `findByIds(ids: string[])` method to `IAgentRunRepository`:
   - Single query: `SELECT * FROM agent_runs WHERE id IN (?)`
   - Replaces N individual `findById()` calls
2. Add `findByRunIds(runIds: string[])` method to `IPhaseTimingRepository`:
   - Single query: `SELECT * FROM phase_timings WHERE run_id IN (?)`
   - Replaces N individual `findByRunId()` calls
3. Add `listActive()` method to notification watcher (if not present)
4. Refactor poll function to use batch queries:
   ```typescript
   // Before: 2N+1 queries
   const features = await listFeatures.execute();
   const runIds = features.map(f => f.agentRunId).filter(Boolean);
   const [runs, timings] = await Promise.all([
     agentRunRepo.findByIds(runIds),
     phaseTimingRepo.findByRunIds(runIds),
   ]);
   // After: 3 queries total
   ```
5. Cap executor stderr buffer to 100KB (memory exhaustion prevention)
6. Add `apiError()` helper for sanitized 500 responses (shared with P0 Item 4)

### Files to Change
- `packages/core/src/application/ports/output/repositories/agent-run-repository.interface.ts` (add `findByIds`)
- `packages/core/src/infrastructure/repositories/sqlite-agent-run.repository.ts` (implement)
- `packages/core/src/application/ports/output/repositories/phase-timing-repository.interface.ts` (add `findByRunIds`)
- `packages/core/src/infrastructure/repositories/sqlite-phase-timing.repository.ts` (implement)
- `src/presentation/web/app/api/agent-events/route.ts` (refactor poll)
- Tests for new repository methods

### Risk: LOW - additive repository methods + route refactor
### Impact: HIGH - 40 queries/poll -> 3 queries/poll for typical workloads

---

## Item 6: Four Latent Executor Bugs (CRITICAL)

**Source commit:** `c2a098aa`

### Bug 6.1: Cursor Missing `--force` (DATA LOSS)

**File:** `packages/core/src/infrastructure/services/agents/common/executors/cursor-executor.service.ts:324`

**Current (buggy):**
```typescript
const args = ['--yolo', '-p', prompt, '--output-format', 'json'];
```

**Problem:** `--yolo` is a non-standard/legacy flag. Cursor CLI uses `--force` for autonomous execution. Without it, the agent may prompt for approval on destructive operations, causing hangs or incomplete execution.

**Fix:** Research current Cursor CLI flags and replace `--yolo` with correct flag. Verify against Cursor CLI `--help`.

### Bug 6.2: Codex Missing `--ask-for-approval never` (HANGS)

**File:** `packages/core/src/infrastructure/services/agents/common/executors/codex-cli-executor.service.ts:627-647`

**Current (buggy):** `baseFlags` array missing approval bypass:
```typescript
const baseFlags = [
  '--json',
  '--sandbox', 'danger-full-access',
  '--skip-git-repo-check',
  '--color', 'never',
];
```

**Problem:** Without `--ask-for-approval never`, Codex CLI waits for console input on sensitive operations. In headless/autonomous execution, this causes indefinite hangs.

**Fix:** Add `'--ask-for-approval', 'never'` to `baseFlags` array.

### Bug 6.3: Copilot Inverted allowedTools Heuristic

**File:** `packages/core/src/infrastructure/services/agents/common/executors/copilot-cli-executor.service.ts:448-450`

**Current (buggy):**
```typescript
if (options?.allowedTools?.length) {
  this.log('allowedTools option is not supported by Copilot CLI - ignoring');
}
```

**Problem:** Silently ignores tool restrictions. Other executors (Claude Code, Gemini) pass `allowedTools` to CLI. Copilot should either pass them or properly document why it can't.

**Fix:** Research Copilot CLI flags for tool restriction. Either implement or add proper error handling instead of silent ignore.

### Bug 6.4: RovoDev Inverted allowedTools Heuristic

**Status:** RovoDev executor does NOT exist in current codebase. No action needed until Item 19 (agent integration).

### Plan
1. **Immediate (30 min):** Fix Bug 6.2 (Codex approval hang) - add missing flag
2. **Research (1 hr):** Verify Cursor CLI current flags for Bug 6.1
3. **Research (1 hr):** Verify Copilot CLI tool restriction flags for Bug 6.3
4. Apply fixes with tests for each executor's `buildArgs()` method
5. Test each executor can start and complete a simple prompt autonomously

### Files to Change
- `packages/core/src/infrastructure/services/agents/common/executors/cursor-executor.service.ts`
- `packages/core/src/infrastructure/services/agents/common/executors/codex-cli-executor.service.ts`
- `packages/core/src/infrastructure/services/agents/common/executors/copilot-cli-executor.service.ts`
- Corresponding test files

### Risk: LOW - flag additions only
### Impact: CRITICAL - fixes data loss, hangs, and permission bypass bugs

---

## Item 7: Next.js middleware.ts -> proxy.ts Rename

**Source commit:** `055630cc`

### Current State
- **No `middleware.ts` exists** in `src/presentation/web/`
- No `proxy.ts` exists either
- Web structure uses: `app/` dir, `components/`, `hooks/`, `dev-server.ts`, `next.config.ts`

### Assessment
This item may not apply to our codebase. The fork may have had a middleware file that we don't have, or this was part of their API path containment work (Item 4).

### Plan
1. Skip as standalone item
2. Address as part of P0 Item 4 (API auth middleware) if we create `middleware.ts`
3. If Next.js deprecates `middleware.ts` naming in a future version, rename then

### Risk: N/A
### Impact: N/A - file doesn't exist in our tree

---

## Item 8: Drawer + Portaled-Popover PointerDown Tracking

**Source commit:** `bc611fd3`

### Current State
**File:** `src/presentation/web/components/common/base-drawer/base-drawer.tsx:72-94`

Our implementation already uses `click` events (not `pointerdown`) with explicit comment explaining the design choice. Radix overlay detection includes `[data-radix-popper-content-wrapper]` selector and `data-no-drawer-close` guard attribute.

### Assessment
**No bug detected.** Our drawer architecture is sound:
- Uses `click` (not `pointerdown`) - explicitly to prevent canvas drag false triggers
- Ignores clicks on Radix overlays via selector: `[role="alertdialog"], [role="dialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]`
- Handles unmounted elements (line 82-83): checks `document.body.contains(target)`

### Plan
1. Skip - our implementation already handles this correctly
2. Monitor for regressions if we add new Select/Popover components inside drawers

### Risk: N/A
### Impact: N/A - already handled

---

## Execution Order

```
Item 6 (executor bugs)  ──> CRITICAL, do first (especially 6.2 Codex hang)
Item 5 (batch SSE)       ──> standalone perf improvement
Item 7 (middleware)       ──> SKIP (doesn't apply)
Item 8 (drawer)           ──> SKIP (already handled)
```

## Estimated Effort
- Item 5: 3-4 hours (new repo methods + route refactor + tests)
- Item 6: 2-3 hours (research CLI flags + apply fixes + tests)
- Item 7: 0 (skip)
- Item 8: 0 (skip)
- **Total: ~1 day**
