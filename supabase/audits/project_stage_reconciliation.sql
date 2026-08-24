-- Read-only audit for legacy and relational project stages.
-- Run this in Supabase SQL Editor before any backfill.

with project_stage_counts as (
  select
    p.id as project_id,
    p.branch_id,
    coalesce(nullif(btrim(p.branch_code), ''), b.code) as branch_code,
    coalesce(jsonb_array_length(case when jsonb_typeof(p.tasks) = 'array' then p.tasks else '[]'::jsonb end), 0) as legacy_stage_count,
    w.id as workspace_id,
    coalesce(relational.stage_count, 0) as relational_stage_count
  from public.projects p
  left join public.branches b on b.id = p.branch_id
  left join public.rebrand_workspaces w
    on w.branch_id = p.branch_id
    and w.is_primary = true
    and w.lifecycle_state = 'active'
  left join (
    select workspace_id, count(*)::integer as stage_count
    from public.project_tasks
    where deleted_at is null
    group by workspace_id
  ) relational on relational.workspace_id = w.id
)
select
  project_id,
  branch_code,
  workspace_id,
  legacy_stage_count,
  relational_stage_count,
  case
    when workspace_id is null then 'missing_workspace'
    when legacy_stage_count > 0 and relational_stage_count = 0 then 'missing_relational_stages'
    when legacy_stage_count <> relational_stage_count then 'stage_count_mismatch'
    else 'aligned'
  end as reconciliation_status
from project_stage_counts
where workspace_id is null
   or legacy_stage_count <> relational_stage_count
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
