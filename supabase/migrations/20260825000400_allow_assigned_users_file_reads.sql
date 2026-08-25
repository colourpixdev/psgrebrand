begin;

create or replace function public.user_can_access_rebrand_workspace(workspace_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    join public.rebrand_workspaces workspace on workspace.id = workspace_uuid
    join public.branches branch on branch.id = workspace.branch_id
    where profile.user_id = (select auth.uid())
      and (
        profile.workspace_ids @> array[workspace.id::text]
        or '*' = any(profile.workspace_ids)
        or lower(btrim(coalesce(profile.branch, ''))) in (lower(btrim(branch.id)), lower(btrim(branch.name)))
        or exists (
          select 1
          from public.project_tasks assigned_task
          where assigned_task.workspace_id = workspace.id
            and assigned_task.responsible_person_id = profile.id
            and assigned_task.deleted_at is null
        )
      )
  );
$$;

revoke all on function public.user_can_access_rebrand_workspace(uuid) from public;
grant execute on function public.user_can_access_rebrand_workspace(uuid) to authenticated;

drop policy if exists rebrand_profiles_assignee_read on public.profiles;
create policy rebrand_profiles_assignee_read
on public.profiles for select to authenticated
using (exists (
  select 1
  from public.project_tasks task
  where task.responsible_person_id = profiles.id
    and task.deleted_at is null
    and public.user_can_access_rebrand_workspace(task.workspace_id)
));

-- PSG users who can access a workspace must also be able to read its files.
-- Mutations remain controlled by the existing internal-user policies and app permissions.
drop policy if exists rebrand_project_files_psg_read on public.project_files;
create policy rebrand_project_files_psg_read
on public.project_files for select to authenticated
using (public.user_can_access_rebrand_workspace(project_files.workspace_id));

drop policy if exists rebrand_file_versions_psg_read on public.file_versions;
create policy rebrand_file_versions_psg_read
on public.file_versions for select to authenticated
using (exists (
  select 1
  from public.project_files file
  where file.id = file_versions.file_id
    and public.user_can_access_rebrand_workspace(file.workspace_id)
));

commit;
