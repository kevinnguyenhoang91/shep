## Status

- **Phase:** Research
- **Updated:** 2026-08-31

## Technology Decisions

### Keep workspaces client-only (localStorage) rather than promoting to backend persistence

**Options considered:**

1. Promote `Workspace` to a full Clean Architecture entity (tsp model,
   domain, use cases, SQLite repository/migration).
2. Move persistence to `sessionStorage`.
3. Fix the existing `localStorage`-based hook in place.

**Decision:** Fix the existing `localStorage`-based hook in place.

**Rationale:** The hook is an explicitly documented prototype boundary with
zero backend touchpoints today (confirmed via grep across
`packages/core/src/domain`, `application/use-cases`,
`infrastructure/persistence/sqlite/migrations`, and `tsp/` — none reference
"workspace"). The bug reported by the user is data loss on browser
close/reopen, which is a race condition in the hook's effects, not a missing
persistence layer. Promoting to backend storage is a separate, larger
feature that should be scoped and planned on its own if/when workspaces
leave prototype status.

### Race-condition fix strategy in useWorkspaces

**Options considered:**

1. Merge hydrate and persist into a single combined `useEffect`.
2. Rewrite the hook around `useSyncExternalStore`.
3. Debounce/delay the persist effect.
4. `useRef`-based hydration guard + fresh-object `loadState()` returns.

**Decision:** `useRef`-based hydration guard + fresh-object `loadState()` returns.

**Rationale:** A `useRef` flag set synchronously inside the hydration effect
and read by the persist effect gives a deterministic guard with no timing
assumptions — the persist effect simply returns early until hydration has
run once. This mirrors a previously validated fix for this exact bug
(commit `ebff256d25fb`, spec 114, on an unmerged branch) that was correct
but never landed on `main` for unrelated scope-hygiene reasons (it bundled
unrelated skill files). Every `loadState()` branch is also changed to
construct a fresh object instead of returning the shared `INITIAL_STATE`
reference, since React's `setState` bails out on referential equality and
would otherwise silently skip the hydration re-render.

## Library Analysis

No new libraries. The fix uses `useRef`, already imported from `react`
elsewhere in this codebase, and the existing `window.localStorage` API
already used by this hook.

## Security Considerations

No security implications identified. `localStorage` access is unchanged;
no new data is written or read beyond what the hook already handles.

## Performance Implications

No performance implications identified. The fix adds one `useRef` check
(O(1)) and avoids a redundant/incorrect `localStorage.setItem` write on
mount — if anything, a marginal improvement.

## Open Questions

All questions resolved.

---

_Updated by `/shep-kit:new-feature-fast` — proceed with `/shep-kit:implement`_
