-- Normalize legacy project identifiers to stable, meaningful PSG codes.
-- Branch UUIDs remain internal relationship keys; branch.code is the user-facing ID.
begin;

do $$
declare
  max_code_number bigint;
begin
  select coalesce(max(substring(code from '^PSG([0-9]+)$')::bigint), 0)
  into max_code_number
  from public.branches;

  perform setval('public.branch_code_sequence', max_code_number, max_code_number > 0);
end $$;

-- Fill any missing branch codes from the existing sequence without renumbering codes.
update public.branches
set code = 'PSG' || lpad(nextval('public.branch_code_sequence')::text, 3, '0')
where code is null or btrim(code) = '';

with project_numbers as (
  select
    project.id as old_id,
    coalesce(nullif(btrim(branch.code), ''), 'PSG000') as branch_code,
    row_number() over (
      partition by coalesce(nullif(btrim(branch.code), ''), 'PSG000')
      order by project.updated_at asc nulls last, project.id
    ) as project_number
  from public.projects project
  left join public.branches branch on branch.id = project.branch_id
), staged_ids as (
  select
    old_id,
    branch_code || 'P' || project_number::text as new_id,
    'project-id-migration-' || row_number() over (order by old_id)::text as temporary_id
  from project_numbers
)
update public.projects project
set id = staged_ids.temporary_id
from staged_ids
where project.id = staged_ids.old_id;

with project_numbers as (
  select
    project.id as temporary_id,
    coalesce(nullif(btrim(branch.code), ''), 'PSG000') as branch_code,
    row_number() over (
      partition by coalesce(nullif(btrim(branch.code), ''), 'PSG000')
      order by project.updated_at asc nulls last, project.id
    ) as project_number
  from public.projects project
  left join public.branches branch on branch.id = project.branch_id
)
update public.projects project
set id = project_numbers.branch_code || 'P' || project_numbers.project_number::text
from project_numbers
where project.id = project_numbers.temporary_id;

commit;
