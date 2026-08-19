-- Phase 2 dry-run diagnostics for PSG Rebrand migration
-- Read-only queries. Run in staging to produce a migration report.
-- Do NOT run in production without review.

-- 1. Per-project summary: legacy counts vs relational counts and flags
select
  legacy.id as legacy_project_id,
  legacy.branch_id,
  legacy.branch as legacy_branch_name,
  legacy.updated_at as legacy_updated_at,
  jsonb_array_length(case when jsonb_typeof(legacy.tasks) = 'array' then legacy.tasks else '[]'::jsonb end) as legacy_task_count,
  jsonb_array_length(case when jsonb_typeof(legacy.files) = 'array' then legacy.files else '[]'::jsonb end) as legacy_file_count,
  coalesce(relational_task_counts.task_count, 0) as relational_task_count,
  coalesce(relational_file_counts.file_count, 0) as relational_file_count,
  (case when workspace.id is null then true else false end) as missing_relational_workspace,
  (case when duplicate_titles.duplicate_count > 0 then true else false end) as duplicate_task_titles_present,
  -- suggested workspace_reference for manual review (not created)
  ('rebrand-' || legacy.branch_id) as suggested_workspace_reference,
  -- simple migration complexity score (higher => review required)
  (
    (case when workspace.id is null then 2 else 0 end) +
    (case when duplicate_titles.duplicate_count > 0 then 2 else 0 end) +
    (case when jsonb_array_length(case when jsonb_typeof(legacy.files) = 'array' then legacy.files else '[]'::jsonb end) > 200 then 2 else 0 end) +
    (case when jsonb_array_length(case when jsonb_typeof(legacy.tasks) = 'array' then legacy.tasks else '[]'::jsonb end) > 50 then 2 else 0 end)
  ) as complexity_score
from public.projects legacy
left join public.rebrand_workspaces workspace
  on workspace.branch_id = legacy.branch_id
left join lateral (
  select count(*)::integer as task_count
  from public.project_tasks t
  where t.workspace_id = workspace.id
    and t.deleted_at is null
) relational_task_counts on true
left join lateral (
  select count(*)::integer as file_count
  from public.project_files f
  where f.workspace_id = workspace.id
    and f.deleted_at is null
) relational_file_counts on true
left join lateral (
  select count(*)::integer as duplicate_count
  from (
    select lower(coalesce(trim((task->>'text')::text), '')) as title_lower,
           count(*) as cnt
    from public.projects p2
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(p2.tasks) = 'array' then p2.tasks else '[]'::jsonb end
    ) task
    where p2.id = legacy.id
    group by lower(coalesce(trim((task->>'text')::text), ''))
    having count(*) > 1
  ) dups
) duplicate_titles on true
order by complexity_score desc, legacy.updated_at desc;

-- 2. Legacy task detail rows for manual inspection
select
  legacy.id as legacy_project_id,
  legacy.branch_id,
  (task_elem->>'id') as legacy_task_id,
  coalesce(nullif(trim(task_elem->>'text'), ''), '<MISSING>') as legacy_task_title,
  task_elem->>'status' as legacy_task_status,
  task_elem->>'priority' as legacy_task_priority,
  task_elem->>'assigned_to' as legacy_assigned_to_user_id,
  task_elem->>'assigned_person_name' as legacy_assigned_person_name,
  task_elem->>'notes' as legacy_task_notes
from public.projects legacy
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(legacy.tasks) = 'array' then legacy.tasks else '[]'::jsonb end
) task_elem
order by legacy.branch_id, legacy.id;

-- 3. Legacy files detail: try a few common json keys and normalise into columns
select
  legacy.id as legacy_project_id,
  legacy.branch_id,
  coalesce(file_elem->>'id', file_elem->>'fileId') as legacy_file_id,
  coalesce(file_elem->>'filename', file_elem->>'name', file_elem->>'displayName', file_elem->>'fileName') as legacy_file_name,
  coalesce(file_elem->>'path', file_elem->>'storage_path', file_elem->>'url') as legacy_file_path,
  coalesce(file_elem->>'category', file_elem->>'category_key', file_elem->>'type') as legacy_file_category,
  file_elem->>'uploaded_by' as legacy_uploaded_by_profile_id,
  file_elem->>'uploaded_at' as legacy_uploaded_at
from public.projects legacy
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(legacy.files) = 'array' then legacy.files else '[]'::jsonb end
) file_elem
order by legacy.branch_id, legacy.id;

-- 4. Profiles referenced in legacy JSON but missing in public.profiles
with referenced_profiles as (
  select distinct (task_elem->>'assigned_to')::uuid as profile_id
  from public.projects p
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(p.tasks) = 'array' then p.tasks else '[]'::jsonb end
  ) task_elem
  where (task_elem->>'assigned_to') is not null
  union
  select distinct (file_elem->>'uploaded_by')::uuid as profile_id
  from public.projects p
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(p.files) = 'array' then p.files else '[]'::jsonb end
  ) file_elem
  where (file_elem->>'uploaded_by') is not null
)
select rp.profile_id
from referenced_profiles rp
left join public.profiles pr on pr.id = rp.profile_id
where pr.id is null;

-- 5. File version and project_files linkage anomalies
-- a) file_versions without any project_files referencing them
select fv.id as file_version_id, fv.storage_bucket, fv.storage_path, fv.uploaded_at
from public.file_versions fv
left join public.project_files pf on pf.current_version_id = fv.id or pf.id = fv.file_id
where pf.id is null
order by fv.uploaded_at desc
limit 200;

-- b) project_files referencing current_version_id that does not exist
select pf.id as project_file_id, pf.display_name, pf.current_version_id
from public.project_files pf
left join public.file_versions fv on fv.id = pf.current_version_id
where pf.current_version_id is not null and fv.id is null;

-- 6. Branch-level aggregation: projects per branch and missing workspaces
select
  legacy.branch_id,
  count(*) as legacy_project_count,
  count(rew.id) filter (where rew.id is not null) as relational_workspace_count,
  (case when count(rew.id) filter (where rew.id is not null) = 0 then true else false end) as branch_missing_workspace
from public.projects legacy
left join public.rebrand_workspaces rew on rew.branch_id = legacy.branch_id
group by legacy.branch_id
order by legacy.branch_id;

-- 7. Duplicate task title finder (within same project)
select
  legacy.id as legacy_project_id,
  lower(coalesce(trim(task->>'text'), '')) as title_lower,
  count(*) as cnt,
  array_agg(distinct task->>'id') as legacy_task_ids
from public.projects legacy
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(legacy.tasks) = 'array' then legacy.tasks else '[]'::jsonb end
) task
group by legacy.id, lower(coalesce(trim(task->>'text'), ''))
having count(*) > 1
order by legacy.id, cnt desc;

-- 8. Per-project migration complexity score (runnable summary)
select
  s.legacy_project_id,
  s.legacy_branch_id,
  s.legacy_task_count,
  s.legacy_file_count,
  s.missing_relational_workspace,
  s.duplicate_task_titles_present,
  s.complexity_score,
  case
    when s.complexity_score >= 6 then 'high'
    when s.complexity_score >= 3 then 'medium'
    else 'low'
  end as complexity_label
from (
  -- reuse the summary query above as a subselect
  select
    legacy.id as legacy_project_id,
    legacy.branch_id as legacy_branch_id,
    jsonb_array_length(case when jsonb_typeof(legacy.tasks) = 'array' then legacy.tasks else '[]'::jsonb end) as legacy_task_count,
    jsonb_array_length(case when jsonb_typeof(legacy.files) = 'array' then legacy.files else '[]'::jsonb end) as legacy_file_count,
    (case when workspace.id is null then true else false end) as missing_relational_workspace,
    (case when duplicate_titles.duplicate_count > 0 then true else false end) as duplicate_task_titles_present,
    (
      (case when workspace.id is null then 2 else 0 end) +
      (case when duplicate_titles.duplicate_count > 0 then 2 else 0 end) +
      (case when jsonb_array_length(case when jsonb_typeof(legacy.files) = 'array' then legacy.files else '[]'::jsonb end) > 200 then 2 else 0 end) +
      (case when jsonb_array_length(case when jsonb_typeof(legacy.tasks) = 'array' then legacy.tasks else '[]'::jsonb end) > 50 then 2 else 0 end)
    ) as complexity_score
  from public.projects legacy
  left join public.rebrand_workspaces workspace on workspace.branch_id = legacy.branch_id
  left join lateral (
    select count(*)::integer as duplicate_count
    from (
      select lower(coalesce(trim((task->>'text')::text), '')) as title_lower,
             count(*) as cnt
      from public.projects p2
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(p2.tasks) = 'array' then p2.tasks else '[]'::jsonb end
      ) task
      where p2.id = legacy.id
      group by lower(coalesce(trim((task->>'text')::text), ''))
      having count(*) > 1
    ) dups
  ) duplicate_titles on true
) s
order by s.complexity_score desc, s.legacy_project_id;

-- End of dry-run diagnostics
