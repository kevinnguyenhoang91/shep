# P2 - CI/CD Polish

## Item 30: OIDC Trusted Publishers for npm

**Source commit:** `66eeffeb`

### Current State
- Publish workflow: `.github/workflows/ci.yml` (lines 249-365)
- Main release: Uses `NPM_TOKEN` secret (line 291) with `npx semantic-release`
- Dev release: Uses `NPM_TOKEN` secret (line 343) with `npm version` + `npm publish`
- Job has `id-token: write` permission (line 268) but doesn't use it for OIDC

### Plan
1. Configure npm OIDC trusted publisher on npmjs.com for `@shepai/cli` package
2. Update release job to use OIDC instead of NPM_TOKEN:
   - Remove `NPM_TOKEN` from `env` in release steps
   - Add npm provenance flag: `npm publish --provenance`
   - Configure `registry-url` with OIDC provider
3. Update dev release job similarly
4. Test with dry-run publish: `npm publish --dry-run --provenance`
5. Keep NPM_TOKEN as fallback initially, remove after verification

### Files to Change
- `.github/workflows/ci.yml` (release + dev-release jobs)
- npm registry configuration on npmjs.com (external)

### Risk: MEDIUM - affects publishing pipeline; test with dry-run
### Impact: MEDIUM - eliminates secret rotation requirement, adds supply chain security

---

## Item 31: Dependabot Config + CODEOWNERS

**Source commit:** `f96fc738`

### Current State
- **No `.github/dependabot.yml`** exists
- **No `.github/CODEOWNERS`** exists

### Plan
1. Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
    groups:
      typespec:
        patterns: ["@typespec/*", "@typespec-tools/*"]
      storybook:
        patterns: ["@storybook/*", "storybook"]
      testing:
        patterns: ["vitest", "@vitest/*", "playwright", "@playwright/*"]
    ignore:
      - dependency-name: "*"
        update-types: ["version-update:semver-major"]
  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: weekly
```
2. Create `.github/CODEOWNERS`:
```
# Default owner
* @shep-ai/core

# Architecture layers
packages/core/src/domain/       @shep-ai/core
packages/core/src/application/  @shep-ai/core
packages/core/src/infrastructure/ @shep-ai/core
src/presentation/web/           @shep-ai/core
src/presentation/cli/           @shep-ai/core

# CI/CD
.github/                        @shep-ai/core
```

### Files to Change
- **New:** `.github/dependabot.yml`
- **New:** `.github/CODEOWNERS`

### Risk: LOW - additive configuration
### Impact: MEDIUM - automated dependency updates, PR review routing

---

## Item 32: Deprecated semgrep-action Migration

**Source commit:** `f96fc738`

### Current State
- Action: `returntocorp/semgrep-action@v1` (`.github/workflows/ci.yml` line 201)
- Config: inline rule sets (p/typescript, p/javascript, p/security-audit)
- `returntocorp` is the old org name; `semgrep` is the current org

### Plan
1. Replace action reference:
   ```yaml
   # Before
   - uses: returntocorp/semgrep-action@v1
   # After
   - uses: semgrep/semgrep-action@v1
   ```
2. Update gitleaks if outdated (check current version)
3. Pin to specific version for reproducibility
4. Test by running CI on a branch

### Files to Change
- `.github/workflows/ci.yml` (1 line change + optional gitleaks bump)

### Risk: LOW - action rename only
### Impact: LOW - ensures continued maintenance and updates

---

## Item 33: Cancel Stale Workflow Runs + Optional Slack Webhook

**Source commit:** `b055cb69`

### Current State
- **ci.yml has concurrency configured** (lines 35-37):
  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
  ```
- Other workflow files may lack concurrency:
  - `claude.yml` - check needed
  - `pr-check.yml` - check needed
  - `shep-e2e.yml` - check needed
- Slack webhook status: unknown (check if hardcoded or optional)

### Plan
1. Audit all workflow files for concurrency configuration
2. Add concurrency groups to any missing workflows:
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
   ```
3. Make Slack webhook optional (guard with `if: secrets.SLACK_WEBHOOK_URL`):
   ```yaml
   - name: Notify Slack
     if: ${{ secrets.SLACK_WEBHOOK_URL != '' }}
     uses: ...
   ```

### Files to Change
- `.github/workflows/claude.yml` (add concurrency if missing)
- `.github/workflows/pr-check.yml` (add concurrency if missing)
- `.github/workflows/shep-e2e.yml` (add concurrency if missing)
- Any workflow with Slack notification (make conditional)

### Risk: LOW - workflow configuration
### Impact: LOW - saves CI minutes, prevents notification spam

---

## Execution Order

```
Item 32 (semgrep migration)    --> 5 minutes, do first
Item 31 (dependabot + CODEOWNERS) --> 30 minutes
Item 33 (concurrency groups)   --> 30 minutes
Item 30 (OIDC publishers)      --> 2-3 hours (needs npm config)
```

## Estimated Effort
- Item 30: 2-3 hours
- Item 31: 30 minutes
- Item 32: 15 minutes
- Item 33: 30 minutes
- **Total: ~4 hours**
