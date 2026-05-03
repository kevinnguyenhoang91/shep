# Migration 097 — supervisor_policies cascading scope

## Why this exists

Migration 089 (`089-create-supervisor-policies.ts`) was rewritten in place
on this branch when the cascading scope model (`scope_type` + `scope_id`)
replaced the original single-`app_id` schema. The rewrite is correct for
fresh installs, but its `if (tables.length === 0)` guard silently skips
DBs that already applied the original 089 — leaving them with the legacy
`app_id` column while the new code expects `scope_type`.

This was reproduced on a real local DB (`~/.shep/data`) with the existing
`supervisor_policies` table:

```
0|id          |TEXT|0||1
1|app_id      |TEXT|1||0
2|feature_id  |TEXT|0||0
...
```

Loading any supervisor page (e.g. `/supervisor/repo/<id>`) produced:

```
SqliteError: no such column: scope_type
  at SQLiteSupervisorPolicyRepository.findByScope (sqlite-supervisor-policy.repository.ts:75)
```

## What 097 does

Idempotent backfill on existing `supervisor_policies` tables:

1. `ALTER TABLE … ADD COLUMN scope_type TEXT NOT NULL DEFAULT 'app'` — only if missing.
2. `ALTER TABLE … ADD COLUMN scope_id TEXT` — only if missing.
3. `UPDATE supervisor_policies SET scope_id = app_id` — only if `app_id` exists.
4. `DROP INDEX IF EXISTS idx_supervisor_policies_app_id` — legacy lookup index.
5. Drop `idx_supervisor_policies_unique_scope` only when its `sql` text still
   references `app_id`, then recreate over `(scope_type, COALESCE(scope_id,''),
   COALESCE(feature_id,''))`.
6. `ALTER TABLE … DROP COLUMN app_id` — required because the column carries
   `NOT NULL` and the new code never writes to it. Needs SQLite ≥ 3.35;
   better-sqlite3 ships 3.51.x.

If the table doesn't exist yet, 097 is a no-op — 089 will create the
correct schema on its own.

## Verification

After applying 097 to a legacy DB, all four scope kinds (`global`, `app`,
`repo`, `repo` + `feature` override) succeed via both the CLI and the web
routes. See `cli-supervisor-cascading-scopes.md` for the actual rows
written and `cli-supervisor-all-scopes-output.txt` for the CLI session.
