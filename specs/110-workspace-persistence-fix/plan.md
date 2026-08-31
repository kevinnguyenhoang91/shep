## Status

- **Phase:** Planning
- **Updated:** 2026-08-31

## Architecture Overview

```
Before (buggy):
  mount ─┬─▶ effect A (hydrate): setState(loadState())  ──▶ schedules re-render
         └─▶ effect B (persist): saveState(state)        ──▶ runs with STALE
                                                               pre-hydration
                                                               `state` closure
         loadState() branches 1/2/4 `return INITIAL_STATE` (shared reference)
         ──▶ setState() bails out on referential equality ──▶ effect A's
             re-render never happens ──▶ effect B never re-fires with the
             real hydrated data ──▶ localStorage stays clobbered.

After (fixed):
  mount ─▶ effect A (hydrate): const loaded = loadState()  [always a FRESH
            object]; setState(loaded); isHydratedRef.current = true
         ─▶ effect B (persist): if (!isHydratedRef.current) return;
            saveState(state)
         ──▶ effect B is a guaranteed no-op on the mount pass, and fires
             correctly on every subsequent state change once hydration has
             set the ref.
```

## Implementation Strategy

**MANDATORY TDD**: Both code-change phases follow RED-GREEN-REFACTOR.

Phase 1 fixes `useWorkspaces` and locks the fix in with unit tests written
first (RED), covering the exact failure modes: the persist effect firing
before hydration, and `loadState()` returning a referentially-stable
`INITIAL_STATE` that suppresses the hydration re-render. Task 2 extends
coverage to the end-to-end scenario the user actually reported — creating
multiple workspaces, then simulating a browser close/reopen via a hook
remount, and asserting all workspaces and the active selection survive.
Phase 2 is a single non-code task: append the confirmed root cause and fix
to `LESSONS.md`, per this repo's mandatory self-improvement loop, so a
future hydrate/persist effect pairing doesn't reintroduce the same race.

**Clean Architecture scope note:** no domain, application, or
infrastructure layer changes are involved. `useWorkspaces` is a
presentation-layer React hook that is explicitly documented as a
client-only prototype with no backend, domain model, or infrastructure
adapter — this fix stays entirely within that existing boundary.

## Files to Create/Modify

### New Files

| File | Purpose |
| ---- | ------- |
| `tests/unit/presentation/web/hooks/use-workspaces.test.ts` | Unit tests for hydration ordering, `loadState()` referential freshness, and multi-workspace persistence across a simulated remount. |

### Modified Files

| File | Changes |
| ---- | ------- |
| `src/presentation/web/hooks/use-workspaces.ts` | Add `isHydratedRef` guard around the persist effect; make every `loadState()` branch return a freshly constructed object instead of the shared `INITIAL_STATE` reference. |
| `LESSONS.md` | Add an entry documenting the hydrate/persist race + referential-identity pattern for future hooks that mix `useEffect`-based localStorage hydration and persistence. |

## Testing Strategy (TDD: Tests FIRST)

**CRITICAL:** Tests are written FIRST in each TDD cycle.

### Unit Tests (RED -> GREEN -> REFACTOR)

- `loadState()` returns a new object reference on every branch (undefined `window`, missing key, malformed JSON, non-array `workspaces`, valid data) — asserted with `not.toBe(INITIAL_STATE)`.
- The persist effect does not call `localStorage.setItem` until after the hydration effect has run and `isHydratedRef.current` is `true`.
- Creating a workspace immediately after mount does not get overwritten by a stale pre-hydration persist write.

### Integration Tests

- Renders `useWorkspaces()`, creates two workspaces, unmounts and re-renders the hook (simulating a browser close/reopen), and asserts both workspaces plus the active workspace id are still present.
- Existing Control Center integration tests (`tests/unit/presentation/web/components/features/control-center/control-center-integration.test.tsx` and friends) still pass unmodified, confirming no regression to workspace selector/dialog behavior.

## Risk Mitigation

| Risk | Mitigation |
| ---- | ---------- |
| Fix changes effect ordering/timing in a way that breaks another consumer of `useWorkspaces()` | Full existing Control Center test suite (`use-control-center-state`, `control-center`, `control-center-empty-state`, `control-center-integration`) is run unmodified as a regression gate. |
| `isHydratedRef` guard accidentally suppresses a legitimate persist write | Test explicitly asserts persistence resumes normally for every state change *after* the hydration effect has run. |
| localStorage unavailable (private browsing) | Existing try/catch in `saveState`/`loadState` is preserved as-is; not in scope for this fix. |

---

_Updated by `/shep-kit:new-feature-fast` — see tasks.yaml for detailed task breakdown_
