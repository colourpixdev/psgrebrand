begin;

alter table public.branches
  add column if not exists marketing_coordinator_name text;
alter table public.branches
  add column if not exists marketing_coordinator_email text;

update public.branches branch
set
  marketing_coordinator_name = project.manager,
  marketing_coordinator_email = project.manager_email
from (
  select distinct on (branch_id) branch_id, manager, manager_email
  from public.projects
  where nullif(btrim(manager_email), '') is not null
  order by branch_id, updated_at desc
) project
where project.branch_id = branch.id
  and nullif(btrim(coalesce(branch.marketing_coordinator_email, '')), '') is null;

commit;