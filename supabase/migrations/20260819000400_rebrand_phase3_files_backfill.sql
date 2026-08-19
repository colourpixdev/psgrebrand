begin;

alter table public.project_files
  add column if not exists deleted_at timestamptz;

with system_admin as (
  select id as system_user_id
  from public.profiles
  where role in ('colourpix_admin', 'colourpix_staff')
  limit 1
),
file_category_map as (
  select category_key as legacy_category, id as category_id
  from public.file_categories
),
legacy_files as (
  select
    ws.id as workspace_id,
    legacy.branch_id,
    file_elem,
    coalesce(
      nullif(btrim(coalesce(
        file_elem->>'filename',
        file_elem->>'name',
        file_elem->>'displayName',
        file_elem->>'fileName'
      )), ''),
      '<Untitled File>'
    ) as display_name,
    lower(coalesce(
      file_elem->>'category',
      file_elem->>'category_key',
      file_elem->>'type',
      'other'
    )) as legacy_category,
    coalesce((file_elem->>'uploaded_at')::timestamptz, now()) as uploaded_at,
    coalesce(file_elem->>'path', file_elem->>'storage_path') as legacy_path,
    file_elem->>'type' as mime_type
  from public.projects legacy
  join public.rebrand_workspaces ws on ws.branch_id = legacy.branch_id
    and ws.is_primary = true
    and ws.lifecycle_state = 'active'
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(legacy.files) = 'array' then legacy.files else '[]'::jsonb end
  ) as file_elem
),
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
    lf.workspace_id,
    null::uuid,
    coalesce(fcm.category_id, other_category.category_id),
    lf.display_name,
    (select system_user_id from system_admin),
    lf.uploaded_at,
    lf.uploaded_at
  from legacy_files lf
  left join file_category_map fcm
    on fcm.legacy_category = lf.legacy_category
  cross join lateral (
    select id as category_id
    from public.file_categories
    where category_key = 'other'
    limit 1
  ) other_category
  where not exists (
    select 1
    from public.project_files existing
    where existing.workspace_id = lf.workspace_id
      and existing.display_name = lf.display_name
  )
  returning id
),
version_inserts as (
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
    1,
    'project-files',
    'legacy/' || coalesce(nullif(lf.legacy_path, ''), pf.id::text),
    lf.mime_type,
    null::bigint,
    (select system_user_id from system_admin),
    lf.uploaded_at,
    jsonb_build_object(
      'legacy_file_id', lf.file_elem->>'id',
      'legacy_path', lf.legacy_path,
      'migrated_from_jsonb', true
    )
  from legacy_files lf
  join public.project_files pf
    on pf.workspace_id = lf.workspace_id
   and pf.display_name = lf.display_name
  where not exists (
    select 1
    from public.file_versions existing
    where existing.file_id = pf.id
      and existing.version_number = 1
  )
  on conflict (file_id, version_number) do nothing
  returning id as version_id, file_id
)
update public.project_files pf
set current_version_id = vi.version_id,
    updated_at = now()
from version_inserts vi
where pf.id = vi.file_id
  and pf.current_version_id is null;

insert into public.project_activity (
  workspace_id,
  branch_id,
  actor_id,
  event_type,
  entity_type,
  entity_id,
  source,
  metadata
)
select distinct
  pf.workspace_id,
  ws.branch_id,
  (
    select id
    from public.profiles
    where role in ('colourpix_admin', 'colourpix_staff')
    limit 1
  ),
  'file_migrated',
  'project_file',
  pf.id,
  'migration',
  jsonb_build_object('migrated_from', 'projects.files')
from public.project_files pf
join public.rebrand_workspaces ws on ws.id = pf.workspace_id
join public.file_versions fv on fv.file_id = pf.id
where (fv.metadata->>'migrated_from_jsonb')::boolean is true
  and not exists (
    select 1
    from public.project_activity pa
    where pa.entity_type = 'project_file'
      and pa.entity_id = pf.id
      and pa.event_type = 'file_migrated'
  );

commit;

-- Diagnostic query: branch_id is the stable workspace join key.
select
  legacy.branch_id,
  jsonb_array_length(
    case when jsonb_typeof(legacy.files) = 'array' then legacy.files else '[]'::jsonb end
  ) as legacy_file_count,
  count(pf.id) filter (where pf.deleted_at is null) as relational_file_count,
  case
    when count(pf.id) filter (where pf.deleted_at is null) = jsonb_array_length(
      case when jsonb_typeof(legacy.files) = 'array' then legacy.files else '[]'::jsonb end
    ) then 'OK'
    else 'CHECK_FILES'
  end as status
from public.projects legacy
left join public.rebrand_workspaces ws
  on ws.branch_id = legacy.branch_id
  and ws.is_primary = true
  and ws.lifecycle_state = 'active'
left join public.project_files pf on pf.workspace_id = ws.id
 group by legacy.branch_id, legacy.id, legacy.files
order by legacy.branch_id;
