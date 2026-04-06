# P3 - Dependency Upgrades

These are larger upgrades that should each be their own PR. Take selectively based on need.

## Item 34: TypeSpec 1.10

**Source:** Tied to P1 Item 17

### Assessment
This is covered by [P1 TypeSpec Modernization](./p1-typespec-modernization.md) Item 17. Do not duplicate effort.

### Action
- See Item 17 plan for full details
- Current version: 0.60.0 -> Target: 1.10.0
- 6 packages to update

---

## Item 35: Storybook 8.6 -> 10.3.4

**Source commit:** `a02a9855`

### Current State
- Current Storybook version: check `package.json` for `@storybook/*` packages
- Two-step migration required: 8 -> 9 -> 10
- **140 story files** would need updates per fork

### Plan
1. **Phase 1: 8 -> 9 migration**
   - Run Storybook automigration CLI: `npx storybook@9 upgrade`
   - Follow interactive prompts for breaking changes
   - Fix any story file syntax changes
   - Verify: `pnpm build:storybook`
2. **Phase 2: 9 -> 10 migration**
   - Run: `npx storybook@10 upgrade`
   - Package consolidation (Storybook 10 consolidates packages)
   - Update story files for new API
   - Verify: `pnpm build:storybook`
3. Update all `.stories.tsx` files for new syntax
4. Verify all stories render correctly

### Dependencies
- Should be done AFTER Vite 8 upgrade (Item 37) if Storybook 10 requires it
- Or: Storybook 10 may bundle its own Vite, reducing coupling

### Risk: HIGH - 140 story files, two major version jumps, potential breaking changes
### Impact: MEDIUM - access to latest Storybook features, maintained version
### Estimated Effort: 2-3 days

---

## Item 36: TypeScript 6.0.2

**Source commit:** `c7080350`

### Current State
- Current TypeScript version: check `package.json`
- Migration tool available: `@andrewbranch/ts5to6`

### Plan
1. Run migration tool:
   ```bash
   npx @andrewbranch/ts5to6
   ```
2. Review tsconfig.json changes:
   - New module resolution options
   - Updated compiler options
   - Any deprecated option removal
3. Fix type errors from stricter checks
4. Run full validation: `pnpm validate`
5. Verify all builds: `pnpm build && pnpm build:release`

### Key Changes in TS 6.0
- Research TypeScript 6.0 release notes for breaking changes
- Likely: stricter type narrowing, new module resolution features
- May affect: generated TypeSpec output types

### Dependencies: None (independent upgrade)
### Risk: MEDIUM - compiler upgrade, potential new type errors
### Impact: MEDIUM - access to latest TS features, maintained version
### Estimated Effort: 1-2 days

---

## Item 37: Vite 8 / Tailwind 4.2 / jsdom 29

**Source commit:** `417daed8`

### Current State
- Vite: check current version (likely 7.x with Rolldown)
- Tailwind CSS: check current version (likely 4.1)
- jsdom: check current version (likely 28)
- vitest: check current version

### Plan

#### Vite 7 -> 8 (Rolldown)
1. Update `vite` package
2. Review Vite 8 migration guide
3. Update `vite.config.ts` for any breaking config changes
4. Verify dev server: `pnpm dev:web`
5. Verify build: `pnpm build:release`

#### Tailwind 4.1 -> 4.2
1. Update `tailwindcss` package
2. Review changelog for new utilities/breaking changes
3. Likely minimal changes needed (patch version)

#### jsdom 28 -> 29
1. Update `jsdom` package
2. Review breaking changes
3. Run tests: `pnpm test:unit` (jsdom is test environment)

#### vitest upgrade
1. Update `vitest` to latest compatible version
2. Run: `pnpm test:unit && pnpm test:int`

### Dependencies
- Blocked by Storybook 10 (Item 35) if Storybook has Vite version requirements
- Can do Tailwind and jsdom independently

### Risk: MEDIUM - build tool upgrade affects all builds and tests
### Impact: MEDIUM - performance improvements, maintained versions
### Estimated Effort: 1-2 days

---

## Execution Order

```
Item 36 (TypeScript 6.0)    --> Independent, can go first
Item 34 (TypeSpec 1.10)     --> See P1 plan, tied to Items 16-17
Item 37 (Vite/Tailwind)     --> After TypeScript upgrade
Item 35 (Storybook 10)      --> Last, depends on Vite 8
```

**Important:** Each upgrade should be its own branch and PR. Do not bundle major version upgrades together.

## Total Estimated Effort
- Item 34: See P1 plan (3-4 hours)
- Item 35: 2-3 days
- Item 36: 1-2 days
- Item 37: 1-2 days
- **Total: ~5-8 days** (spread across multiple PRs)
