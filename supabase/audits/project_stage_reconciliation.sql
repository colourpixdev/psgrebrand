-- Read-only audit for legacy and relational project stages.
-- Run this in Supabase SQL Editor before any backfill.

with projects_with_workspaces as (
  select
    p.id as project_id,
    p.branch_id,
    coalesce(nullif(btrim(p.branch_code), ''), b.code) as branch_code,
    p.tasks as legacy_tasks,
    w.id as workspace_id
  from public.projects p
  left join public.branches b on b.id = p.branch_id
  left join public.rebrand_workspaces w
    on w.branch_id = p.branch_id
    and w.is_primary = true
    and w.lifecycle_state = 'active'
), legacy_stages as (
  select
    p.project_id,
    trim(task->>'text') as stage_name
  from projects_with_workspaces p
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(p.legacy_tasks) = 'array'
      then p.legacy_tasks else '[]'::jsonb end
  ) task
  where nullif(trim(task->>'text'), '') is not null
), relational_stages as (
  select
    p.project_id,
    trim(pt.title) as stage_name
  from projects_with_workspaces p
  join public.project_tasks pt
    on pt.workspace_id = p.workspace_id
   and pt.deleted_at is null
), stage_comparison as (
  select
    p.project_id,
    p.branch_code,
    p.workspace_id,
    (select count(*) from legacy_stages l where l.project_id = p.project_id) as legacy_stage_count,
    (select count(*) from relational_stages r where r.project_id = p.project_id) as relational_stage_count,
    exists (
      select 1 from legacy_stages l
      where l.project_id = p.project_id
        and not exists (
          select 1 from relational_stages r
          where r.project_id = p.project_id
            and lower(r.stage_name) = lower(l.stage_name)
        )
    ) as has_legacy_missing,
    exists (
      select 1 from relational_stages r
      where r.project_id = p.project_id
        and not exists (
          select 1 from legacy_stages l
          where l.project_id = p.project_id
            and lower(l.stage_name) = lower(r.stage_name)
        )
    ) as has_relational_only
  from projects_with_workspaces p
)
select
  project_id,
  branch_code,
  workspace_id,
  legacy_stage_count,
  relational_stage_count,
  case
    when workspace_id is null then 'missing_workspace'
    when has_legacy_missing and has_relational_only then 'mixed_mismatch'
    when has_legacy_missing then 'legacy_missing_relational'
    when has_relational_only then 'relational_only'
    else 'aligned'
  end as reconciliation_status
from stage_comparison
order by reconciliation_status, branch_code, project_id;

-- Check whether a branch currently has more than one project sharing one workspace.
select
  w.id as workspace_id,
  w.branch_id,
  count(p.id) as project_count,
  array_agg(p.id order by p.id) as project_ids
from public.rebrand_workspaces w
join public.projects p on p.branch_id = w.branch_id
where w.is_primary = true
  and w.lifecycle_state = 'active'
group by w.id, w.branch_id
having count(p.id) > 1
order by project_count desc, w.branch_id;
