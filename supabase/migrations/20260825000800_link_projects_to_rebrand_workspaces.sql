-- Phase 2: make the project-to-workspace relationship explicit.
-- Keep the legacy text workspace_id column for compatibility during migration.

alter table public.projects
  add column if not exists rebrand_workspace_id uuid;

drop index if exists public.rebrand_workspaces_one_active_primary_per_branch;

update public.projects project
set rebrand_workspace_id = workspace.id
from public.rebrand_workspaces workspace
where project.rebrand_workspace_id is null
  and (
    workspace.workspace_reference = 'WS-' || project.id
    or (
      workspace.workspace_reference = 'WS-branch-' || project.branch_id
      and (
        select count(*)
        from public.projects branch_project
        where branch_project.branch_id = project.branch_id
      ) = 1
    )
    or (workspace.metadata->>'legacy_project_id') = project.id
  )
  and not exists (
    select 1
    from public.projects other_project
    where other_project.rebrand_workspace_id = workspace.id
      and other_project.id <> project.id
  );

alter table public.projects
  drop constraint if exists projects_rebrand_workspace_fk;

alter table public.projects
  add constraint projects_rebrand_workspace_fk
  foreign key (rebrand_workspace_id)
  references public.rebrand_workspaces(id)
  on delete set null;

create index if not exists projects_rebrand_workspace_idx
  on public.projects (rebrand_workspace_id);

create unique index if not exists projects_rebrand_workspace_unique
  on public.projects (rebrand_workspace_id)
  where rebrand_workspace_id is not null;

comment on column public.projects.rebrand_workspace_id is
  'Explicit relational workspace for this project; legacy workspace_id remains for compatibility.';