# P2 - Testing & DX

## Item 22: Shared Test Factories

**Source commit:** `b03f16cc`

### Current State
- Existing helper: `tests/helpers/mock-repository.helper.ts` (85 lines) - only MockSettingsRepository
- Fixtures: `tests/fixtures/` contains mock session data (JSON files)
- **299 unit test files** each define their own inline mock factories
- Pattern: each test file creates `vi.mock()` + custom factory functions for repositories

**Duplication examples:**
- `createMockRunRepository()` pattern repeated across agent use-case tests
- `createMockFeatureRepository()` pattern repeated across feature use-case tests
- `createMockSettings()` pattern repeated across settings-dependent tests

### Plan
1. Create factory builders in `tests/helpers/factories/`:
   ```
   tests/helpers/factories/
     feature.factory.ts        -> buildFeature(overrides?)
     agent-run.factory.ts      -> buildAgentRun(overrides?)
     agent-session.factory.ts  -> buildAgentSession(overrides?)
     settings.factory.ts       -> buildSettings(overrides?)
     repository.factory.ts     -> buildRepository(overrides?)
   ```
2. Each factory uses builder pattern:
   ```typescript
   export function buildFeature(overrides?: Partial<Feature>): Feature {
     return {
       id: crypto.randomUUID(),
       name: 'test-feature',
       status: FeatureStatus.Draft,
       createdAt: new Date(),
       ...overrides,
     };
   }
   ```
3. Create mock repository factories:
   ```typescript
   export function buildMockFeatureRepository(overrides?: Partial<IFeatureRepository>): IFeatureRepository {
     return {
       findById: vi.fn(),
       save: vi.fn(),
       delete: vi.fn(),
       ...overrides,
     };
   }
   ```
4. Migrate existing tests to use shared factories (gradual)
5. Add barrel export: `tests/helpers/factories/index.ts`

### Files to Change
- **New:** 5-6 factory files in `tests/helpers/factories/`
- **New:** `tests/helpers/factories/index.ts` (barrel)
- Gradual migration of existing test files (299 files, do opportunistically)

### Dependencies: None
### Risk: LOW - additive, no behavior change
### Impact: MEDIUM - reduces test boilerplate, standardizes fixtures

---

## Item 23: 344 New Unit Tests

**Source commit:** `e37f8d4e`

### Current State
- **299 existing test files** in `tests/unit/`
- Coverage by area:
  - `tests/unit/application/use-cases/` - agents (13), features (20+)
  - `tests/unit/domain/` - domain model tests
  - `tests/unit/infrastructure/` - infrastructure tests
  - `tests/unit/presentation/` - minimal coverage

### Coverage Gaps Identified

**1. Agent Node Files (~20 nodes, 0 unit tests):**
```
packages/core/src/infrastructure/services/agents/feature-agent/nodes/
  analyze.node.ts          -> UNTESTED
  implement.node.ts        -> UNTESTED
  fast-implement.node.ts   -> UNTESTED
  merge.node.ts            -> UNTESTED
  plan.node.ts             -> UNTESTED
  evidence.node.ts         -> UNTESTED
  research.node.ts         -> UNTESTED
  ... (~13 more)
```
These are complex LLM orchestration nodes. Test the orchestration logic (not LLM calls) by mocking agent executors.

**2. Untested Use Cases (~15-20):**
- Tools use cases (5 files)
- Some feature lifecycle use cases
- Subscription/license use cases
- Repository initialization use cases

**3. Web Presentation Components (~0% unit test coverage):**
- 22K+ lines of component code
- Only E2E tests exist (18 Playwright spec files)
- No `.test.tsx` files for any component

### Plan
1. **Phase 1 (high value):** Agent node tests (~100 tests)
   - Mock `IAgentExecutor` and test orchestration logic
   - Verify correct prompt construction, error handling, retry logic
2. **Phase 2:** Missing use case tests (~50 tests)
   - Focus on edge cases and error paths
3. **Phase 3:** Web component unit tests (~100 tests)
   - Focus on complex interactive components (drawers, pickers, chat)
   - Use React Testing Library
4. **Phase 4:** Edge case and integration tests (~50+ tests)

### Files to Create
- `tests/unit/infrastructure/services/agents/nodes/*.test.ts` (~20 files)
- `tests/unit/application/use-cases/**/*.test.ts` (~15 files)
- `tests/unit/presentation/web/components/**/*.test.tsx` (~20 files)

### Dependencies: Item 22 (shared factories) - build factories first
### Risk: LOW - additive tests
### Impact: HIGH - significant coverage improvement

---

## Item 24: i18n Parity Hook

**Source commit:** `aa9dc43d`

### Current State
- i18n implementation: `src/presentation/web/lib/i18n.ts` (73 lines)
- 8 supported languages: en, ru, pt, es, ar, he, fr, de
- Translation files: `translations/{lang}/common.json`, `translations/{lang}/web.json`
- CLI/TUI i18n: `src/presentation/cli/i18n.js`, `tui/i18n.js`
- **No parity validation hook** - translations can drift silently

### Plan
1. Create hook script:
   ```bash
   # .claude/hooks/i18n-parity.sh
   # Triggered on PostToolUse for Write/Edit on translations/**/*.json
   # Compares key sets between en/*.json and all other languages
   # Warns on missing keys
   ```
2. Register in `.claude/settings.json`:
   ```json
   {
     "matcher": "Write|Edit",
     "hooks": [{
       "type": "command",
       "command": ".claude/hooks/i18n-parity.sh \"$FILEPATH\"",
       "timeout": 10
     }]
   }
   ```
3. Script logic:
   - Extract keys from `translations/en/web.json` as reference
   - For each other language, compare key sets
   - Report missing/extra keys

### Files to Change
- **New:** `.claude/hooks/i18n-parity.sh`
- `.claude/settings.json` (add hook matcher)

### Dependencies: None
### Risk: LOW - hook only, no code changes
### Impact: MEDIUM - prevents i18n drift

---

## Item 25: PostToolUse Architecture Layer Violation Hook

**Source commit:** `980a1b05`

### Current State
- Current hooks in `.claude/settings.json`:
  - PostToolUse: `format-tsp.sh` on Edit/Write (formats .tsp files)
- **No architecture validation hook**
- Clean architecture layers defined:
  - Application: `packages/core/src/application/`
  - Domain: `packages/core/src/domain/`
  - Infrastructure: `packages/core/src/infrastructure/`
  - Presentation: `src/presentation/{cli,tui,web}/`

### Plan
1. Create architecture validator script:
   ```bash
   # .claude/hooks/architecture-validator.sh
   # Checks edited .ts/.tsx files for cross-layer import violations:
   # - Presentation must NOT import from infrastructure
   # - Application must NOT import from presentation
   # - Domain must NOT import from infrastructure or presentation
   ```
2. Register in `.claude/settings.json` PostToolUse hooks
3. Script detects violations by parsing import statements and checking paths

### Files to Change
- **New:** `.claude/hooks/architecture-validator.sh`
- `.claude/settings.json` (add hook)

### Dependencies: None
### Risk: LOW - hook only
### Impact: HIGH - enforces clean architecture rules automatically

---

## Item 26: grep -P -> POSIX Fix

**Source commit:** `fad3f465`

### Current State
- **No `grep -P` found in any hook scripts** in current codebase
- `.claude/hooks/format-tsp.sh` uses POSIX `if`/`command -v` (compliant)
- Only references to `grep -P` are in documentation (TODOS.md, research.yaml)

### Assessment
**No action needed.** Our hooks already use POSIX-compatible patterns. This was likely a fix for patterns they copied/created that we don't have.

### Plan
1. Add to hook development guidelines: "Use `grep -E` (extended regex), never `grep -P` (Perl regex, BSD-incompatible)"
2. Audit any new hooks for compliance before merge

### Risk: N/A
### Impact: N/A - already compliant

---

## Execution Order

```
Item 22 (test factories)       ──> Foundation for Item 23
Item 25 (architecture hook)    ──> Quick win, high value
Item 24 (i18n hook)            ──> Quick win
Item 23 (unit tests)           ──> After Item 22, ongoing effort
Item 26 (grep fix)             ──> SKIP (already compliant)
```

## Estimated Effort
- Item 22: 1 day (create factories)
- Item 23: 3-5 days (phased, ongoing)
- Item 24: 2 hours (hook script)
- Item 25: 2-3 hours (hook script)
- Item 26: 0 (skip)
- **Total: ~5-7 days**
