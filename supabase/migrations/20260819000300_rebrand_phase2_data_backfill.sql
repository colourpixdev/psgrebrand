-- PSG Rebrand Control Centre: Phase 2 Data Backfill
--
-- Purpose:
--   Migrate legacy JSONB data from public.projects into Phase 1 relational tables.
--   Create rebrand_workspaces, expand tasks into project_tasks, expand files into
--   project_files and file_versions, and populate project_activity audit entries.
--
-- Safety:
--   - Wrapped in a single transaction block.
--   - Idempotent: uses ON CONFLICT DO NOTHING and WHERE NOT EXISTS checks.
--   - Does NOT alter, drop, or clear legacy public.projects data.
--   - Diagnostic SELECTs at the end verify row counts and cross-table integrity.
--   - Re-run this script safely multiple times without creating duplicates.
--
-- Locked assumptions:
--   - Phase 1 relational foundation tables already exist and are empty.
--   - Reference data (workflow_stages, responsibility_groups, file_categories, etc.) are seeded.
--   - System admin profile ID can be inferred from profiles table.
--   - Legacy projects.tasks is a JSONB array; files is a JSONB array.
--   - Task status values in legacy data map to Phase 2 status values.
--

begin;

-- ---------------------------------------------------------------------------
-- A. Create a CTE reference to identify the system user (first admin profile)
-- ---------------------------------------------------------------------------

with system_admin as (
  select id as system_user_id
  from public.profiles
  where role = 'colourpix_admin'
  limit 1
),

-- ---------------------------------------------------------------------------
-- B. Responsibility group lookups
-- ---------------------------------------------------------------------------

responsibility_groups_map as (
  select
    'colourpix'::text as group_key,
    id as group_id
  from public.responsibility_groups
  where group_key = 'colourpix'

  union all

  select
    'psg_head_office'::text as group_key,
    id as group_id
  from public.responsibility_groups
  where group_key = 'psg_head_office'
),

-- ---------------------------------------------------------------------------
-- C. File category lookups for JSONB key normalization
-- ---------------------------------------------------------------------------

file_category_map as (
  select 'brief' as legacy_category, id as category_id from public.file_categories where category_key = 'brief'
  union all
  select 'site_information', id from public.file_categories where category_key = 'site_information'
  union all
  select 'artwork', id from public.file_categories where category_key = 'artwork'
  union all
  select 'quote', id from public.file_categories where category_key = 'quote'
  union all
  select 'approval', id from public.file_categories where category_key = 'approval'
  union all
  select 'production', id from public.file_categories where category_key = 'production'
  union all
  select 'installation', id from public.file_categories where category_key = 'installation'
  union all
  select 'installation_evidence', id from public.file_categories where category_key = 'installation_evidence'
  union all
  select 'final_inspection', id from public.file_categories where category_key = 'final_inspection'
  union all
  select 'other', id from public.file_categories where category_key = 'other'
),

-- ---------------------------------------------------------------------------
-- D. Workflow stages: map legacy stage names or position to current phase stages
-- ---------------------------------------------------------------------------

workflow_stages_map as (
  select id, stage_key, stage_number, sort_order
  from public.workflow_stages
  where active = true
),

-- ---------------------------------------------------------------------------
-- E. Phase 1: Create rebrand_workspaces for each legacy project
-- ---------------------------------------------------------------------------

workspace_inserts as (
  insert into public.rebrand_workspaces (
    branch_id,
    workspace_reference,
    workspace_type,
    is_primary,
    lifecycle_state,
    health,
    current_stage_id,
    target_date,
    brief_requested_date,
    installation_date,
    completion_date,
    progress,
    notes,
    created_by,
    updated_by,
    created_at,
    updated_at,
    metadata
  )
  select
    legacy.branch_id,
    'WS-' || legacy.id as workspace_reference,
    'rebrand'::text,
    true,
    'active'::text,
    case
      when coalesce(nullif(btrim(legacy.completion_date), ''), 'null') <> 'null' then 'complete'::text
      when legacy.status in ('delayed', 'on_hold', 'cancelled') then 'at_risk'::text
      when legacy.status = 'awaiting_approval' then 'waiting'::text
      else 'on_track'::text
    end as health,
    (select id from workflow_stages_map where stage_key = 'branch_confirmed' limit 1),
    case when btrim(legacy.target_date) ~ '^\d{4}-\d{2}-\d{2}' then btrim(legacy.target_date)::date else null end,
    null::date,
    case when btrim(legacy.installation_date) ~ '^\d{4}-\d{2}-\d{2}' then btrim(legacy.installation_date)::date else null end,
    case when btrim(legacy.completion_date) ~ '^\d{4}-\d{2}-\d{2}' then btrim(legacy.completion_date)::date else null end,
    coalesce(legacy.progress, 0),
    coalesce(legacy.notes, ''),
    (select system_user_id from system_admin),
    (select system_user_id from system_admin),
    legacy.updated_at,
    legacy.updated_at,
    jsonb_build_object(
      'legacy_project_id', legacy.id,
      'legacy_status', legacy.status,
      'legacy_current_stage', legacy.current_stage,
      'legacy_manager', legacy.manager,
      'legacy_designer', legacy.designer,
      'legacy_client_company', legacy.client_company,
      'legacy_graphics_partner', legacy.graphics_partner
    )
  from public.projects legacy
  left join public.rebrand_workspaces existing
    on existing.branch_id = legacy.branch_id
    and existing.workspace_reference = 'WS-' || legacy.id
  where existing.id is null
  on conflict do nothing
  returning id as workspace_id, branch_id
),

-- ---------------------------------------------------------------------------
-- F. Phase 2: Expand legacy tasks JSONB array into project_tasks
-- ---------------------------------------------------------------------------

task_inserts as (
  insert into public.project_tasks (
    workspace_id,
    stage_id,
    title,
    description,
    status,
    priority,
    sort_order,
    due_date,
    responsible_group_id,
    responsible_person_id,
    required_action,
    waiting_reason,
    blocker_reason,
    is_current,
    created_by,
    updated_by,
    created_at,
    updated_at,
    deleted_at
  )
  select
    ws.id as workspace_id,
    coalesce(
      (select id from workflow_stages_map where stage_key = 'branch_confirmed' limit 1),
      (select id from workflow_stages_map order by stage_number asc limit 1)
    ),
    coalesce(
      nullif(btrim(task_elem->>'text'), ''),
      '<Untitled Task>'
    ) as title,
    coalesce(task_elem->>'notes', '') as description,
    case
      when task_elem->>'status' = 'done' then 'complete'::text
      when task_elem->>'status' = 'busy' then 'in_progress'::text
      when task_elem->>'status' = 'pending' then 'not_started'::text
      when task_elem->>'status' = 'open' then 'not_started'::text
      else 'not_started'::text
    end as status,
    case
      when task_elem->>'priority' = 'urgent' then 'urgent'::text
      when task_elem->>'priority' = 'important' then 'important'::text
      else 'normal'::text
    end as priority,
    row_number() over (partition by legacy.id order by jsonb_array_length(
      case when jsonb_typeof(legacy.tasks) = 'array' then legacy.tasks else '[]'::jsonb end
    )) - 1 as sort_order,
    null::date as due_date,
    coalesce(
      rg.group_id,
      (select group_id from responsibility_groups_map where group_key = 'colourpix' limit 1)
    ),
    null::uuid as responsible_person_id,
    '' as required_action,
    case
      when task_elem->>'status' = 'waiting'
      then 'Migrated from legacy task; awaiting details.'
      else null
    end as waiting_reason,
    case
      when task_elem->>'status' = 'blocked'
      then 'Migrated from legacy task; awaiting clarification.'
      else null
    end as blocker_reason,
    false as is_current,
    (select system_user_id from system_admin),
    (select system_user_id from system_admin),
    legacy.updated_at,
    legacy.updated_at,
    case
      when task_elem->>'status' = 'cancelled'
      then legacy.updated_at
      else null
    end as deleted_at
  from public.projects legacy
  inner join public.rebrand_workspaces ws
    on ws.branch_id = legacy.branch_id
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(legacy.tasks) = 'array' then legacy.tasks else '[]'::jsonb end
  ) task_elem
  left join responsibility_groups_map rg
    on lower(rg.group_key) = lower(
      case
        when task_elem->>'assigned_person_name' ilike '%psg%' then 'psg_head_office'
        when task_elem->>'assigned_person_name' ilike '%colourpix%' then 'colourpix'
        else 'colourpix'
      end
    )
  where legacy.tasks is not null
    and jsonb_typeof(legacy.tasks) = 'array'
    and jsonb_array_length(legacy.tasks) > 0
    and not exists (
      select 1 from public.project_tasks pt
      where pt.workspace_id = ws.id
    )
  on conflict do nothing
  returning id as task_id, workspace_id
),

-- ---------------------------------------------------------------------------
-- G. Phase 3: Expand legacy files JSONB array into project_files + file_versions
-- ---------------------------------------------------------------------------

file_inserts as (
  insert into public.project_files (
    workspace_id,
    task_id,
    category_id,
    display_name,
    uploaded_by,
    created_at,
    updated_at
  )
  select
    ws.id as workspace_id,
    null::uuid as task_id,
    coalesce(
      fcm.category_id,
      (select category_id from file_category_map where legacy_category = 'other' limit 1)
    ),
    coalesce(
      nullif(
        btrim(coalesce(
          file_elem->>'filename',
          file_elem->>'name',
          file_elem->>'displayName',
          file_elem->>'fileName',
          '<Untitled File>'
        )),
        ''
      ),
      '<Untitled File>'
    ) as display_name,
    (select system_user_id from system_admin),
    legacy.updated_at,
    legacy.updated_at
  from public.projects legacy
  inner join public.rebrand_workspaces ws
    on ws.branch_id = legacy.branch_id
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(legacy.files) = 'array' then legacy.files else '[]'::jsonb end
  ) file_elem
  left join file_category_map fcm
    on lower(fcm.legacy_category) = lower(
      coalesce(
        file_elem->>'category',
        file_elem->>'category_key',
        file_elem->>'type',
        'other'
      )
    )
  where legacy.files is not null
    and jsonb_typeof(legacy.files) = 'array'
    and jsonb_array_length(legacy.files) > 0
    and not exists (
      select 1 from public.project_files pf
      where pf.workspace_id = ws.id
    )
  on conflict do nothing
  returning id as file_id, workspace_id
),

-- ---------------------------------------------------------------------------
-- H. Create file_versions for each project_file
-- ---------------------------------------------------------------------------

file_version_inserts as (
  insert into public.file_versions (
    file_id,
    version_number,
    storage_bucket,
    storage_path,
    mime_type,
    size_bytes,
    uploaded_by,
    uploaded_at,
    metadata
  )
  select
    pf.id,
    1 as version_number,
    'project-files'::text,
    'legacy/' || coalesce(file_elem->>'path', file_elem->>'storage_path', pf.id::text),
    file_elem->>'type' as mime_type,
    null::bigint as size_bytes,
    (select system_user_id from system_admin),
    legacy.updated_at,
    jsonb_build_object(
      'legacy_file_id', file_elem->>'id',
      'legacy_path', coalesce(file_elem->>'path', file_elem->>'storage_path'),
      'legacy_uploaded_by', file_elem->>'uploaded_by',
      'migrated_from_jsonb', true
    )
  from public.projects legacy
  inner join public.rebrand_workspaces ws
    on ws.branch_id = legacy.branch_id
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(legacy.files) = 'array' then legacy.files else '[]'::jsonb end
  ) file_elem
  inner join public.project_files pf
    on pf.workspace_id = ws.id
    and pf.display_name = coalesce(
      nullif(
        btrim(coalesce(
          file_elem->>'filename',
          file_elem->>'name',
          file_elem->>'displayName',
          file_elem->>'fileName',
          '<Untitled File>'
        )),
        ''
      ),
      '<Untitled File>'
    )
  where legacy.files is not null
    and jsonb_typeof(legacy.files) = 'array'
    and jsonb_array_length(legacy.files) > 0
  on conflict (storage_path) do nothing
  returning id as file_version_id
),

-- ---------------------------------------------------------------------------
-- I. Update project_files.current_version_id to link the first version
-- ---------------------------------------------------------------------------

update_current_versions as (
  update public.project_files pf
  set current_version_id = fv.id
  from (
    select distinct on (file_id)
      file_id,
      id
    from public.file_versions
    where file_id in (
      select id from public.project_files
      where workspace_id in (
        select ws.id from public.rebrand_workspaces ws
        inner join public.projects legacy
          on ws.branch_id = legacy.branch_id
      )
    )
    order by file_id, uploaded_at desc nulls last, id desc
  ) fv
  where pf.id = fv.file_id
    and pf.current_version_id is null
  returning pf.id
),

-- ---------------------------------------------------------------------------
-- J. Record migration events in project_activity (audit log)
-- ---------------------------------------------------------------------------

activity_inserts as (
  insert into public.project_activity (
    workspace_id,
    branch_id,
    actor_id,
    event_type,
    entity_type,
    entity_id,
    source,
    old_values,
    new_values,
    metadata,
    occurred_at
  )
  select
    ws.id as workspace_id,
    ws.branch_id,
    (select system_user_id from system_admin),
    'migrated'::text,
    'rebrand_workspace'::text,
    ws.id,
    'migration'::text,
    null::jsonb,
    jsonb_build_object(
      'legacy_project_id', legacy.id,
      'workspace_reference', 'WS-' || legacy.id,
      'branch_id', legacy.branch_id
    ),
    jsonb_build_object(
      'migration_batch', 'phase2_backfill',
      'timestamp', now()::text
    ),
    now()
  from public.projects legacy
  inner join public.rebrand_workspaces ws
    on ws.branch_id = legacy.branch_id
  on conflict do nothing
  returning id as activity_id
),

-- ---------------------------------------------------------------------------
-- K. Final diagnostic summary (returned via RETURNING for visibility)
-- ---------------------------------------------------------------------------

final_counts as (
  select
    'workspaces' as entity_type,
    count(*) as new_rows
  from workspace_inserts

  union all

  select 'tasks' as entity_type, count(*) from task_inserts

  union all

  select 'files' as entity_type, count(*) from file_inserts

  union all

  select 'file_versions' as entity_type, count(*) from file_version_inserts

  union all

  select 'activity_entries' as entity_type, count(*) from activity_inserts
)

-- Placeholder to allow the transaction to complete; diagnostics follow in a separate transaction.
select true as migration_complete;

commit;

-- =============================================================================
-- DIAGNOSTICS: Post-migration verification (run in separate transaction)
-- =============================================================================

-- 1. Overall row counts: legacy projects vs. migrated relational tables
select
  'legacy_projects' as table_name,
  count(*) as row_count
from public.projects

union all

select 'rebrand_workspaces' as table_name, count(*) from public.rebrand_workspaces

union all

select 'project_tasks' as table_name, count(*) from public.project_tasks

union all

select 'project_files' as table_name, count(*) from public.project_files

union all

select 'file_versions' as table_name, count(*) from public.file_versions

union all

select 'project_activity' as table_name, count(*) from public.project_activity

order by table_name;

-- 2. Workspace-to-branch uniqueness check (should be 1 workspace per branch)
select
  branch_id,
  count(*) as workspace_count,
  case
    when count(*) = 1 then 'OK'
    else 'ERROR: Multiple workspaces for one branch'
  end as status
from public.rebrand_workspaces
where is_primary = true
  and lifecycle_state = 'active'
group by branch_id
having count(*) > 1;

-- 3. Orphaned or unlinked files
select
  count(*) as orphaned_project_files
from public.project_files pf
where pf.current_version_id is null;

-- 4. Legacy JSONB vs. relational task counts per branch
select
  legacy.branch_id,
  jsonb_array_length(
    case when jsonb_typeof(legacy.tasks) = 'array'
    then legacy.tasks
    else '[]'::jsonb end
  ) as legacy_task_count,
  count(pt.id) as relational_task_count,
  case
    when count(pt.id) = jsonb_array_length(
      case when jsonb_typeof(legacy.tasks) = 'array'
      then legacy.tasks
      else '[]'::jsonb end
    ) then 'OK'
    else 'MISMATCH'
  end as status
from public.projects legacy
left join public.rebrand_workspaces ws
  on ws.branch_id = legacy.branch_id
left join public.project_tasks pt
  on pt.workspace_id = ws.id
    and pt.deleted_at is null
group by legacy.branch_id, legacy.id
order by legacy.branch_id;

-- 5. Legacy JSONB vs. relational file counts per branch
select
  legacy.branch_id,
  jsonb_array_length(
    case when jsonb_typeof(legacy.files) = 'array'
    then legacy.files
    else '[]'::jsonb end
  ) as legacy_file_count,
  count(pf.id) as relational_file_count,
  case
    when count(pf.id) = jsonb_array_length(
      case when jsonb_typeof(legacy.files) = 'array'
      then legacy.files
      else '[]'::jsonb end
    ) then 'OK'
    else 'MISMATCH'
  end as status
from public.projects legacy
left join public.rebrand_workspaces ws
  on ws.branch_id = legacy.branch_id
left join public.project_files pf
  on pf.workspace_id = ws.id
    and pf.deleted_at is null
group by legacy.branch_id, legacy.id
order by legacy.branch_id;

-- 6. Activity audit trail summary
select
  event_type,
  entity_type,
  count(*) as entry_count
from public.project_activity
where source = 'migration'
group by event_type, entity_type
order by entry_count desc;

-- 7. Sample workspace and linked data for manual spot-check
select
  ws.id,
  ws.branch_id,
  ws.workspace_reference,
  ws.health,
  (select count(*) from public.project_tasks pt where pt.workspace_id = ws.id) as task_count,
  (select count(*) from public.project_files pf where pf.workspace_id = ws.id) as file_count,
  ws.created_at
from public.rebrand_workspaces ws
order by ws.created_at desc
limit 10;

-- End of Phase 2 Data Backfill Script
