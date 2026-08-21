begin;

-- Let PSG users read only the relational workspace data assigned to their
-- profile branch or workspace list. Internal roles retain their existing policy.

drop policy if exists rebrand_workspaces_psg_read on public.rebrand_workspaces;
create policy rebrand_workspaces_psg_read
on public.rebrand_workspaces for select to authenticated
using (exists (
  select 1
  from public.profiles p
  join public.branches b on b.id = rebrand_workspaces.branch_id
  where p.user_id = (select auth.uid())
    and (
      p.workspace_ids @> array[rebrand_workspaces.id::text]
      or '*' = any(p.workspace_ids)
      or lower(btrim(coalesce(p.branch, ''))) in (lower(btrim(b.id)), lower(btrim(b.name)))
    )
));

drop policy if exists rebrand_project_tasks_psg_read on public.project_tasks;
create policy rebrand_project_tasks_psg_read
on public.project_tasks for select to authenticated
using (exists (
  select 1
  from public.rebrand_workspaces w
  join public.branches b on b.id = w.branch_id
  join public.profiles p on p.user_id = (select auth.uid())
  where w.id = project_tasks.workspace_id
    and (
      p.workspace_ids @> array[w.id::text]
      or '*' = any(p.workspace_ids)
      or lower(btrim(coalesce(p.branch, ''))) in (lower(btrim(b.id)), lower(btrim(b.name)))
    )
));

drop policy if exists rebrand_project_files_psg_read on public.project_files;
create policy rebrand_project_files_psg_read
on public.project_files for select to authenticated
using (exists (
  select 1
  from public.rebrand_workspaces w
  join public.branches b on b.id = w.branch_id
  join public.profiles p on p.user_id = (select auth.uid())
  where w.id = project_files.workspace_id
    and (
      p.workspace_ids @> array[w.id::text]
      or '*' = any(p.workspace_ids)
      or lower(btrim(coalesce(p.branch, ''))) in (lower(btrim(b.id)), lower(btrim(b.name)))
    )
));

drop policy if exists rebrand_file_versions_psg_read on public.file_versions;
create policy rebrand_file_versions_psg_read
on public.file_versions for select to authenticated
using (exists (
  select 1
  from public.project_files f
  join public.rebrand_workspaces w on w.id = f.workspace_id
  join public.branches b on b.id = w.branch_id
  join public.profiles p on p.user_id = (select auth.uid())
  where f.id = file_versions.file_id
    and (
      p.workspace_ids @> array[w.id::text]
      or '*' = any(p.workspace_ids)
      or lower(btrim(coalesce(p.branch, ''))) in (lower(btrim(b.id)), lower(btrim(b.name)))
    )
));

commit;
