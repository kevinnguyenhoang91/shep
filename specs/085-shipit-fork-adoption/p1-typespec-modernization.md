# P1 - TypeSpec Modernization

## Item 16: Emitter Patch - utcDateTime -> Date

**Source commit:** `d58cf5f1`

### Current State
- **Emitter:** `@typespec-tools/emitter-typescript@0.3.0`
- **TypeSpec compiler:** `@typespec/compiler@0.60.0`
- **Config:** `tspconfig.yaml` (lines 36-37)

**Problem:** 28 date fields in generated output typed as `any` instead of `Date`:

| Field | Occurrences | Models |
|-------|-------------|--------|
| `createdAt: any` | 7 | BaseEntity, all entities |
| `timestamp: any` | 5 | AgentRunEvent, AgentSessionMessage |
| `startedAt?: any` | 2 | AgentRun, InteractiveSession |
| `completedAt?: any` | 1 | AgentRun |
| `lastHeartbeat?: any` | 1 | AgentRun |
| `stoppedAt?: any` | 1 | InteractiveSession |
| `lastActivityAt: any` | 1 | InteractiveSession |
| `start: any` / `end: any` | 2 | PhaseTiming |
| `startDate: any` / `endDate: any` | 2 | Sprint |
| `updatedAt: any` | 1 | AuditableEntity |
| `deletedAt?: any` | 1 | SoftDeletableEntity |
| `waitingApprovalAt?: any` | 1 | Feature |

**Root cause:** `@typespec-tools/emitter-typescript@0.3.0` maps `utcDateTime` -> `any` instead of `Date`.

**70 total `utcDateTime` usages** across `.tsp` files in `tsp/` directory.

### Plan
1. **Option A (preferred):** Patch emitter via pnpm patch:
   ```bash
   pnpm patch @typespec-tools/emitter-typescript@0.3.0
   # Edit the emitter to map utcDateTime -> Date
   pnpm patch-commit @typespec-tools/emitter-typescript@0.3.0
   ```
2. **Option B:** Configure custom scalar mapping in `tspconfig.yaml` if emitter supports it
3. **Option C:** Upgrade emitter to newer version that fixes this (may require TypeSpec 1.x - tied to Item 17)
4. Regenerate output: `pnpm tsp:codegen`
5. Fix type errors across codebase (28+ fields change from `any` to `Date`)
   - Repository mappers: ensure `new Date(row.createdAt)` instead of raw pass-through
   - Serialization: ensure `toISOString()` for JSON output
   - Comparisons: ensure `Date` comparison operators

### Files to Change
- `package.json` (add pnpm patch if Option A)
- `tspconfig.yaml` (if Option B)
- `packages/core/src/domain/generated/output.ts` (regenerated - 28 fields)
- All repository mappers that read date columns (~10 files)
- Any code comparing date fields with string operations (~20 files)

### Dependencies: May combine with Item 17 (TypeSpec upgrade)
### Risk: MEDIUM - 28 type changes ripple through codebase
### Impact: HIGH - eliminates `any` type holes in domain model, enables proper date comparisons

---

## Item 17: TypeSpec 0.60 -> 1.10 Upgrade

**Source commit:** `b66091a0`

### Current State
All TypeSpec packages at `0.60.0`:
- `@typespec/compiler@0.60.0`
- `@typespec/json-schema@0.60.0`
- `@typespec/openapi3@0.60.0`
- `@typespec/prettier-plugin-typespec@0.60.0`
- `@typespec/protobuf@0.60.0`
- `@typespec-tools/emitter-typescript@0.3.0`

### Syntax Compatibility Assessment

**Already 1.x compatible (no changes needed):**
- `@visibility("read")` decorator usage - OK
- `@service({ title: "..." })` decorator usage - OK
- `@discriminator("kind")` on unions - OK

**Potential changes needed (verify against 1.x changelog):**
- `@visibility("read")` may need to become `@visibility(Lifecycle.Read)` in 1.x
- `@service({ title })` may need `@service(#{ title })` tuple syntax
- `@discriminator` on unions may have changed behavior

### Plan
1. Read TypeSpec 0.60 -> 1.0 -> 1.10 release notes for breaking changes
2. Update all packages in `package.json`:
   ```json
   "@typespec/compiler": "^1.10.0",
   "@typespec/json-schema": "^1.10.0",
   "@typespec/openapi3": "^1.10.0",
   "@typespec/prettier-plugin-typespec": "^1.10.0",
   "@typespec/protobuf": "^1.10.0"
   ```
3. Find compatible emitter version: check `@typespec-tools/emitter-typescript` releases for 1.x compat
4. Run `pnpm install`
5. Run `pnpm tsp:compile` - fix any syntax errors
6. Update `.tsp` files for 1.x syntax if needed:
   - Search for `@visibility("read")` -> may need `@visibility(Lifecycle.Read)`
   - Search for `@service({` -> may need `@service(#{`
7. Regenerate output: `pnpm tsp:codegen`
8. Run full validation: `pnpm validate`

### Files to Change
- `package.json` (6 devDependency version bumps)
- `pnpm-lock.yaml` (regenerated)
- `tsp/**/*.tsp` (syntax updates if needed - 20+ files)
- `packages/core/src/domain/generated/output.ts` (regenerated)

### Dependencies: Combine with Item 16 (date emitter patch) - do both in one pass
### Risk: MEDIUM - major version upgrade, but syntax appears largely compatible
### Impact: MEDIUM - keeps us on maintained releases, may fix ajv ReDoS transitively

---

## Item 18: Validate Script Uses tsp:codegen

**Source commit:** `bf44c27e`

### Current State
**File:** `package.json` scripts:
```json
"lint:tsp": "tsp compile tsp/ --no-emit",
"tsp:compile": "tsp compile tsp/",
"tsp:codegen": "tsp compile tsp/ --emit @typespec-tools/emitter-typescript && prettier --write packages/core/src/domain/generated/",
"validate": "pnpm run lint:fix && pnpm run format && pnpm run typecheck && pnpm run tsp:compile"
```

**Problem:** `validate` uses `tsp:compile` which generates files but doesn't format them. This causes:
1. Generated files may have inconsistent formatting
2. `format:check` passes but generated output isn't prettified
3. Git shows spurious diffs if someone runs `tsp:codegen` after `validate`

### Plan
1. Change `validate` script to use `tsp:codegen`:
   ```json
   "validate": "pnpm run lint:fix && pnpm run format && pnpm run typecheck && pnpm run tsp:codegen"
   ```
2. Alternatively, add prettier check for generated files:
   ```json
   "validate": "pnpm run lint:fix && pnpm run format && pnpm run typecheck && pnpm run tsp:compile && prettier --check packages/core/src/domain/generated/"
   ```
3. Verify CI pipeline uses `validate` consistently

### Files to Change
- `package.json` (1 line change in `validate` script)

### Dependencies: None
### Risk: LOW - script change only
### Impact: LOW-MEDIUM - eliminates git drift from formatting inconsistency

---

## Execution Order

```
Item 18 (validate script)     ──> Quick win, do first (5 minutes)
Item 17 (TypeSpec upgrade)    ──> Foundation for Item 16
Item 16 (date emitter patch)  ──> After Item 17, or combine into single pass
```

## Estimated Effort
- Item 16: 4-6 hours (patch emitter + fix 28 type changes + tests)
- Item 17: 3-4 hours (version bump + syntax fixes + verification)
- Item 18: 15 minutes
- **Total: ~1-2 days** (Items 16+17 should be done together)
