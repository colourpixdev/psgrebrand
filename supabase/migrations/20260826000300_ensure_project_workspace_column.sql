begin;

alter table public.projects
  add column if not exists rebrand_workspace_id uuid;

create index if not exists projects_rebrand_workspace_idx
  on public.projects (rebrand_workspace_id);

commit;