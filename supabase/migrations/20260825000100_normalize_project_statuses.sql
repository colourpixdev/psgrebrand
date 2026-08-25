update public.projects
set status = 'on_schedule'
where status not in ('completed', 'delayed', 'on_schedule');

alter table public.projects
  drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check
  check (status in ('on_schedule', 'completed', 'delayed'));