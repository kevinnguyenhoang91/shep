# supervisor_policies — one row per scope kind

## Schema (post-migration 097)

```sql
CREATE TABLE supervisor_policies (
        id                              TEXT PRIMARY KEY,
        feature_id                      TEXT,
        enabled                         INTEGER NOT NULL DEFAULT 0,
        autonomy_level                  TEXT NOT NULL DEFAULT 'advisory',
        gate_authority_json             TEXT,
        model_id                        TEXT,
        prompt_version                  TEXT,
        policy_rules_json               TEXT,
        notification_overrides_json     TEXT,
        created_at                      INTEGER NOT NULL,
        updated_at                      INTEGER NOT NULL
      , scope_type TEXT NOT NULL DEFAULT 'app', scope_id TEXT);
CREATE UNIQUE INDEX idx_supervisor_policies_unique_scope ON supervisor_policies(scope_type, COALESCE(scope_id, ''), COALESCE(feature_id, ''));
CREATE INDEX idx_supervisor_policies_scope ON supervisor_policies(scope_type, scope_id);
```

## Persisted rows (after CLI round-trip on 2026-05-03)

```
scope_type  scope_id                              feature_id                            enabled  autonomy    model            prompt  gates               
----------  ------------------------------------  ------------------------------------  -------  ----------  ---------------  ------  --------------------
app         b2c08027-02e2-4ab3-949e-f68a24194e39  -                                     1        cosign      -                -       -                   
global      -                                     -                                     1        advisory    -                -       -                   
repo        af6ad533-1c5c-41b5-b396-0ec40c07be5a  -                                     1        advisory    claude-sonnet-4  v1      -                   
repo        af6ad533-1c5c-41b5-b396-0ec40c07be5a  5bd8358f-eaf5-4c8b-bff5-edbbbd720f00  1        autonomous  -                -       {"merge":"advisory"}
```

## Applied migrations (collab/supervisor)

```
name|created_at
089-create-supervisor-policies|2026-04-28T18:54:59.062Z
090-create-supervisor-decisions|2026-04-28T18:54:59.064Z
091-add-feature-flag-collaboration|2026-04-28T18:54:59.064Z
097-supervisor-policies-cascading-scope|2026-05-03 16:35:14
```
