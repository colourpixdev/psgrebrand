# Phase 2 Data Backfill: JSONB-to-Relational Migration Guide

## Overview

The Phase 2 backfill script migrates all legacy JSONB data from `public.projects` into the Phase 1 relational schema without altering or deleting any legacy data. The migration is **idempotent** and safe to run multiple times.

---

## Mapping Strategy

### 1. **Workspace Creation** (`public.projects` → `public.rebrand_workspaces`)

| Legacy Field | Phase 2 Field | Transformation |
|---|---|---|
| `projects.id` | `workspace_reference` | `'WS-' || projects.id` (e.g., `WS-PSG012P1`) |
| `projects.branch_id` | `branch_id` | Direct mapping |
| `projects.status` | `health` | Status-to-health mapping (see below) |
| `projects.current_stage` | `current_stage_id` | Mapped to first stage ('branch_confirmed') during backfill; app can update later |
| `projects.target_date` | `target_date` | Cast to `date` |
| `projects.brief_requested_date` | `brief_requested_date` | Cast to `date` |
| `projects.installation_date` | `installation_date` | Cast to `date` |
| `projects.completion_date` | `completion_date` | Cast to `date` |
| `projects.progress` | `progress` | Direct mapping (default 0 if null) |
| `projects.notes` | `notes` | Direct mapping (default '' if null) |
| `projects.metadata` | `metadata` (JSONB) | Stores legacy fields: `legacy_project_id`, `legacy_status`, `legacy_manager`, `legacy_designer`, etc. |
| — | `is_primary` | `true` (one active primary workspace per branch) |
| — | `lifecycle_state` | `'active'` |
| — | `created_by` / `updated_by` | System admin profile ID |

#### Status → Health Mapping

```sql
CASE
  WHEN completion_date IS NOT NULL THEN 'complete'
  WHEN status IN ('delayed', 'on_hold', 'cancelled') THEN 'at_risk'
  WHEN status = 'awaiting_approval' THEN 'waiting'
  ELSE 'on_track'
END
```

---

### 2. **Task Migration** (`projects.tasks[]` JSONB → `public.project_tasks`)

Each element in the legacy `projects.tasks` JSONB array becomes one row in `project_tasks`.

| Legacy Task Field | Phase 2 Field | Transformation |
|---|---|---|
| `task_elem->>'id'` | (no direct mapping) | Preserved in legacy audit logs only; new `project_tasks.id` is UUID |
| `task_elem->>'text'` | `title` | Trimmed; defaults to `'<Untitled Task>'` if empty |
| `task_elem->>'notes'` | `description` | Direct mapping (default '' if null) |
| `task_elem->>'status'` | `status` | Status value mapping (see below) |
| `task_elem->>'priority'` | `priority` | Priority value mapping (see below) |
| `task_elem->>'assigned_person_name'` | `responsible_group_id` | Name-based heuristic mapping: if contains 'psg', → 'psg_head_office'; else → 'colourpix' |
| — | `responsible_person_id` | `NULL` (backfill does not create user mappings; app can assign later) |
| `task_elem->>'notes'` (when status = 'waiting') | `waiting_reason` | Populated with default reason if status is 'waiting' |
| `task_elem->>'notes'` (when status = 'blocked') | `blocker_reason` | Populated with default reason if status is 'blocked' |
| — | `stage_id` | Defaults to stage 1 ('branch_confirmed'); app logic should update per task's intended stage |
| `task_elem->>'createdAt'` | `created_at` | Cast to `timestamptz` (default `now()` if null) |
| `task_elem->>'completedAt'` | `updated_at` | Cast to `timestamptz` (default `now()` if null) |
| — | `sort_order` | Row number within workspace, in array order |
| — | `is_current` | `false` (app sets to true when task is active) |
| — | `created_by` / `updated_by` | System admin profile ID |

#### Task Status Mapping

```sql
CASE
  WHEN task_elem->>'status' = 'done' THEN 'complete'
  WHEN task_elem->>'status' = 'busy' THEN 'in_progress'
  WHEN task_elem->>'status' = 'pending' THEN 'not_started'
  WHEN task_elem->>'status' = 'open' THEN 'not_started'
  ELSE 'not_started'
END
```

#### Task Priority Mapping

```sql
CASE
  WHEN task_elem->>'priority' = 'urgent' THEN 'urgent'
  WHEN task_elem->>'priority' = 'important' THEN 'important'
  ELSE 'normal'
END
```

#### Cancelled Task Handling

If `task_elem->>'status' = 'cancelled'`, the task is inserted with `deleted_at = now()` (soft delete).

---

### 3. **File Migration** (`projects.files[]` JSONB → `public.project_files` + `public.file_versions`)

Each element in the legacy `projects.files` JSONB array becomes one row in `project_files`, plus one row in `file_versions` (version 1).

#### project_files Columns

| Legacy File Field | Phase 2 Field | Transformation |
|---|---|---|
| `file_elem->>'filename'` or `->>'name'` etc. | `display_name` | Normalized from multiple possible keys; defaults to `'<Untitled File>'` if empty |
| `file_elem->>'category'` or `->>'category_key'` | `category_id` | Mapped via `file_categories` lookup; defaults to 'other' if unmapped |
| — | `workspace_id` | Linked to the migrated workspace |
| — | `task_id` | `NULL` (backfill assigns files to workspace, not to tasks; app can move them later) |
| — | `uploaded_by` | System admin profile ID |
| — | `current_version_id` | Linked to the first version created below |
| — | `created_at` / `updated_at` | Cast from `file_elem->>'uploaded_at'` or `now()` |

#### file_versions Columns

| Legacy File Field | Phase 2 Field | Transformation |
|---|---|---|
| — | `file_id` | Linked to the `project_files.id` just created |
| — | `version_number` | `1` (first version) |
| `file_elem->>'path'` or `->>'storage_path'` | `storage_path` | Prefixed as `'legacy/' || original_path` for organization |
| `file_elem->>'type'` | `mime_type` | Direct mapping if available |
| — | `size_bytes` | `NULL` (legacy data does not include size; app can calculate on re-upload) |
| `file_elem->>'uploaded_at'` | `uploaded_at` | Cast to `timestamptz` (default `now()` if null) |
| — | `uploaded_by` | System admin profile ID |
| — | `metadata` (JSONB) | Stores `legacy_file_id`, `legacy_path`, `legacy_uploaded_by`, `migrated_from_jsonb: true` |

#### File Category Mapping

The script normalizes multiple possible category key names:

```
'brief' → file_categories.category_key = 'brief'
'site_information' → file_categories.category_key = 'site_information'
'artwork' → file_categories.category_key = 'artwork'
'quote' → file_categories.category_key = 'quote'
'approval' → file_categories.category_key = 'approval'
'production' → file_categories.category_key = 'production'
'installation' → file_categories.category_key = 'installation'
'installation_evidence' → file_categories.category_key = 'installation_evidence'
'final_inspection' → file_categories.category_key = 'final_inspection'
(default) → file_categories.category_key = 'other'
```

---

### 4. **Audit Trail** (`public.project_activity`)

A single migration event record is inserted for each workspace:

| Field | Value |
|---|---|
| `workspace_id` | The newly created workspace ID |
| `branch_id` | The branch ID |
| `actor_id` | System admin profile ID |
| `event_type` | `'migrated'` |
| `entity_type` | `'rebrand_workspace'` |
| `entity_id` | The workspace ID |
| `source` | `'migration'` |
| `occurred_at` | `now()` |
| `metadata` | Includes `migration_batch: 'phase2_backfill'` |

---

## Safety & Idempotency

### Transaction Wrapping

The entire migration runs within a single `BEGIN; ... COMMIT;` block. If any step fails, the entire transaction rolls back—no partial state is left behind.

### Duplicate Prevention

- **Workspaces**: `ON CONFLICT (workspace_reference) DO NOTHING` — skips if `WS-{project_id}` already exists
- **Tasks**: `ON CONFLICT DO NOTHING` — skips if duplicate task record is detected
- **Files**: `ON CONFLICT DO NOTHING` — skips if duplicate file record is detected
- **File versions**: `ON CONFLICT (storage_path) DO NOTHING` — skips if file version with same path already exists

### No Legacy Data Alteration

The script uses only `SELECT` and `INSERT` operations on legacy data. The `public.projects` table remains completely unchanged.

### Re-run Safety

The script is safe to run multiple times:
1. On first run, all data is inserted.
2. On subsequent runs, conflicts are skipped; no duplicates are created.
3. The diagnostic queries run after the transaction to verify integrity.

---

## Diagnostic Queries

After the transaction completes, the script runs seven diagnostic queries to verify success:

1. **Row counts**: Overall table counts across legacy and relational tables.
2. **Workspace-to-branch uniqueness**: Ensures one active primary workspace per branch.
3. **Orphaned files**: Checks for files without current versions.
4. **Task count matching**: Compares legacy JSONB task counts to relational task rows.
5. **File count matching**: Compares legacy JSONB file counts to relational file rows.
6. **Activity audit trail**: Shows counts of migration events recorded.
7. **Sample workspaces**: Displays a top-10 sample of newly created workspaces with linked task/file counts.

These diagnostics help you spot any anomalies (e.g., missing tasks or file count mismatches).

---

## Running the Migration

### Prerequisites

- Phase 1 relational foundation tables are already deployed (`rebrand_workspaces`, `project_tasks`, `project_files`, etc.).
- Reference data is seeded: `workflow_stages`, `responsibility_groups`, `file_categories`, `roles`, `permissions`.
- At least one `colourpix_admin` profile exists in `public.profiles` (used as system user for created_by/updated_by).

### Steps

1. **Review** the script in [20260819000300_rebrand_phase2_data_backfill.sql](../migrations/20260819000300_rebrand_phase2_data_backfill.sql).
2. **Stage environment**: Run first in a staging/test Supabase project to verify counts and integrity.
3. **Production**: Once diagnostics pass in staging, run in production Supabase project.
4. **Validate**: Use the diagnostic queries to confirm all data was migrated correctly.

### Command (Supabase CLI)

```bash
supabase migration up --linked
```

Or, if connecting directly to your production database:

```bash
psql postgresql://user:password@host:port/dbname -f 20260819000300_rebrand_phase2_data_backfill.sql
```

---

## Post-Migration App Logic

The backfill script prepares the relational data but does NOT handle all business logic transitions. The app should:

1. **Assign current task**: Set `project_tasks.is_current = true` for the task that should be active.
2. **Link files to tasks**: Move files from workspace-level to specific tasks as needed (`project_files.task_id`).
3. **Refine task stages**: Update `project_tasks.stage_id` based on project's custom stage plan.
4. **Assign responsible persons**: Populate `project_tasks.responsible_person_id` for tasks that need individual ownership.
5. **Review health/status**: Verify that workspace health classifications match your expectations.

---

## Schema Reference

### New Relational Tables

- **rebrand_workspaces**: One per active rebrand per branch; tracks overall project status, dates, and progress.
- **project_tasks**: Expanded from tasks JSONB; fine-grained task tracking by workspace and stage.
- **project_files**: File references, one per legacy file; links to versions and categories.
- **file_versions**: Immutable file metadata; version history (version 1 for all backfilled files).
- **project_activity**: Append-only audit log; migration events are recorded here.

### Reference Tables (Seeded)

- **workflow_stages**: 14 fixed stages (Branch Confirmed → Complete).
- **responsibility_groups**: 'colourpix' and 'psg_head_office'.
- **file_categories**: 10 categories (Brief → Other).
- **roles**: colourpix_admin, colourpix_staff, psg_head_office.
- **permissions**: 14 permission types (view_branches → manage_permissions).

---

## Troubleshooting

| Issue | Diagnosis | Resolution |
|---|---|---|
| Migration hangs | Check for long-running queries or locking conflicts | Run in off-peak hours; check `pg_stat_activity` |
| Workspace reference conflicts | A workspace with the same `WS-{id}` already exists | The migration will skip it (idempotent); inspect existing workspace |
| Task or file count mismatch | Legacy array had malformed JSON or phase 2 insert failed | Check diagnostic query 4 and 5; review app logs |
| Missing system user ID | No colourpix_admin profile exists | Create an admin profile first |
| Foreign key constraint errors | Reference data (stages, groups, categories) not seeded | Re-run Phase 1 migration; verify RLS policies |

---

## Next Steps

1. **Run the migration** in staging to validate.
2. **Review diagnostics** for anomalies.
3. **Deploy to production** once confident.
4. **Frontend updates** (no code changes required for backfill; app displays new relational data transparently).
5. **Decommission legacy JSONB columns** (future phase; leave `public.projects` table intact for now).

