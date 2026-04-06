# P0 - Security (Merge ASAP)

## Item 1: ajv ReDoS + @anthropic-ai/sdk Sandbox Escape Overrides

**Source commit:** `e469d7c7`
**CVEs:** GHSA-2g4f-4pwh-qvx6 (ajv ReDoS), GHSA-5474-4w2j-mq4c (SDK sandbox escape)

### Current State
- `ajv@8.18.0` in `package.json` (line 184)
- `@anthropic-ai/claude-agent-sdk@0.2.81` (line 177)
- Only existing pnpm override: `minimatch@^7.x` (lines 171-173)

### Plan
1. Research patched versions for both CVEs
2. Add scoped pnpm overrides in `package.json`:
   ```json
   "pnpm": {
     "overrides": {
       "ajv": ">=8.19.0",
       "@anthropic-ai/sdk": ">=0.XX.X"
     }
   }
   ```
3. Run `pnpm install` to regenerate lockfile
4. Verify transitive resolution: `pnpm why ajv` / `pnpm why @anthropic-ai/sdk`
5. Run `pnpm test:unit && pnpm build` to confirm no regressions

### Files to Change
- `package.json` (add overrides)
- `pnpm-lock.yaml` (regenerated)

### Risk: LOW - dependency version bumps only, no code changes

---

## Item 2: CodeQL 26-Alert Sweep

**Source commit:** `e5467f11`

### 2A: Command Injection in open-shell.ts

**File:** `src/presentation/web/app/actions/open-shell.ts:73`

**Vulnerability:** `resolved.split(/\s+/)` on user-controlled path via `config.openDirectory.replace('{dir}', targetPath)`. Repository paths with shell metacharacters or spaces can be injected into spawn arguments.

**Current protection:** `isAbsolute(repositoryPath)` (line 45) + `existsSync(targetPath)` (line 47) - insufficient.

**Fix:**
1. Quote/escape `targetPath` before interpolation into `config.openDirectory`
2. Use shell-aware argument parsing or pass args as proper array
3. Add allowlist validation for `config.openDirectory` patterns

### 2B: jq Injection in github-repository.service.ts

**File:** `packages/core/src/infrastructure/services/external/github-repository.service.ts:92-93`

**Vulnerability:** jq filter constructed via string interpolation. Only `"` is escaped; jq metacharacters like `;` can inject operations.

```typescript
// CURRENT (vulnerable)
const escaped = options.search.replace(/"/g, '\\"');
args.push('-q', `[.[] | select(.name | test("${escaped}"; "i"))]`);
```

**Fix:** Use jq's `--arg` for safe variable passing:
```typescript
args.push('--jq', '--arg', 'search', options.search,
  '[.[] | select(.name | test($search; "i"))]');
```

### 2C: Path Traversal in directory-list route

**File:** `src/presentation/web/app/api/directory/list/route.ts:22-47`

**Vulnerability:** TOCTOU - path verified as directory (line 25), but symlinks/changes between stat and readdir can bypass containment. No realpath-based containment check on entries.

**Fix:**
1. Add `realpathSync` containment check after resolving entries
2. Verify `realpath(entryPath).startsWith(realpath(resolvedPath) + sep)`

### 2D: Incomplete Path Containment in attachments/preview

**File:** `src/presentation/web/app/api/attachments/preview/route.ts:73-76`

**Vulnerability:** String `startsWith()` check is bypassable (e.g., `/attachments-evil/` passes `/attachments` prefix).

**Fix:** Use `realpath` + trailing separator in comparison:
```typescript
const normalizedPath = realpathSync(resolve(path));
const normalizedRoot = realpathSync(resolve(attachmentsRoot)) + sep;
if (!normalizedPath.startsWith(normalizedRoot) && normalizedPath !== normalizedRoot.slice(0, -1)) {
  return NextResponse.json({ error: 'Access denied' }, { status: 403 });
}
```

### 2E: Missing Path Containment in upload-from-path

**File:** `src/presentation/web/app/api/attachments/upload-from-path/route.ts:104`

**Vulnerability:** HIGH - NO path containment check before `readFile(resolvePath(path))`. Any file readable by Node.js process can be exfiltrated.

**Fix:** Add containment check against project root or allowed directories.

### 2F: Stack Trace Exposure in agent-events route

**File:** `src/presentation/web/app/api/agent-events/route.ts:461`

**Vulnerability:** `String(error)` sent to client, may include stack traces.

**Fix:** Return generic error message; log full error server-side only.

### Files to Change
| File | Severity | Fix |
|------|----------|-----|
| `src/presentation/web/app/actions/open-shell.ts` | HIGH | Shell argument escaping |
| `packages/core/src/infrastructure/services/external/github-repository.service.ts` | HIGH | jq `--arg` |
| `src/presentation/web/app/api/directory/list/route.ts` | MEDIUM | realpath containment |
| `src/presentation/web/app/api/attachments/preview/route.ts` | MEDIUM | realpath + sep |
| `src/presentation/web/app/api/attachments/upload-from-path/route.ts` | HIGH | Add containment |
| `src/presentation/web/app/api/agent-events/route.ts` | MEDIUM | Sanitize errors |

### Risk: LOW-MEDIUM - targeted fixes, no architecture changes

---

## Item 3: Path Sanitizer Extraction + Directory-List TOCTOU

**Source commit:** `a6ac80be`

### Current State - 3+ Inline Copies Found
1. `src/presentation/web/lib/is-same-shep-instance.ts:13-14` - `realpathSync(resolve(...)).replace(/\\/g, '/')`
2. `packages/core/src/infrastructure/services/external/github-repository.service.ts:150-156` - `normalize()` + string comparison (insufficient)
3. `src/presentation/web/app/api/attachments/preview/route.ts:73-76` - `startsWith` (bypassable)
4. `src/presentation/web/app/api/directory/list/route.ts` - no containment at all

### Plan
1. Create shared path sanitizer utility:
   ```
   packages/core/src/infrastructure/services/filesystem/path-sanitizers.ts
   ```
   - `ensureContainedPath(target, container): string` - throws on traversal
   - `normalizePath(path): string` - cross-platform normalization
   - `isSamePath(a, b): boolean` - reliable path comparison
2. Write tests for path sanitizer (edge cases: symlinks, `..`, Windows UNC, trailing slashes)
3. Replace all 4 inline implementations with shared utility
4. Add containment check to directory-list route

### Files to Change
- **New:** `packages/core/src/infrastructure/services/filesystem/path-sanitizers.ts`
- **New:** `tests/unit/infrastructure/services/filesystem/path-sanitizers.test.ts`
- `src/presentation/web/lib/is-same-shep-instance.ts`
- `packages/core/src/infrastructure/services/external/github-repository.service.ts`
- `src/presentation/web/app/api/attachments/preview/route.ts`
- `src/presentation/web/app/api/directory/list/route.ts`

### Risk: LOW - extracting existing logic into shared utility

---

## Item 4: API Path Containment + Auth Middleware

**Source commit:** `26174e38`

### Current State
- **No centralized auth middleware** - API routes process requests without authentication
- **No middleware.ts** in `src/presentation/web/`
- Error responses sometimes leak stack traces (agent-events route)

### Plan
1. Create Next.js middleware at `src/presentation/web/middleware.ts`:
   - Verify requests are from localhost/127.0.0.1 (local-only access)
   - Add CSRF protection headers
   - Set security headers (X-Content-Type-Options, X-Frame-Options)
2. Create `apiError()` helper for sanitized 500 responses:
   ```typescript
   export function apiError(error: unknown, status = 500): Response {
     const message = error instanceof Error ? error.message : 'Internal server error';
     console.error('[API Error]', error);
     return NextResponse.json({ error: message }, { status });
   }
   ```
3. Apply `apiError()` to all API route catch blocks
4. Add path containment middleware for file-serving routes

### Files to Change
- **New:** `src/presentation/web/middleware.ts`
- **New:** `src/presentation/web/lib/api-error.ts`
- All `src/presentation/web/app/api/**/route.ts` files (apply apiError)

### Risk: MEDIUM - middleware affects all routes; test thoroughly

---

## Execution Order

```
Item 1 (CVE overrides)     ──> standalone, do first
Item 3 (path sanitizers)   ──> creates shared utility
Item 2 (CodeQL sweep)      ──> uses path sanitizers from Item 3
Item 4 (auth middleware)    ──> uses apiError helper, depends on Item 2 patterns
```

## Estimated Effort
- Item 1: 30 minutes
- Item 2: 2-3 hours (6 files, careful testing)
- Item 3: 1-2 hours (extract + test utility)
- Item 4: 2-3 hours (middleware + apiError + apply to all routes)
- **Total: ~1 day**
