begin;

create or replace function public.get_rebrand_task_assignees(workspace_uuid uuid)
returns table (
  task_id uuid,
  name text,
  email text,
  profile_title text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    task.id,
    profile.name,
    profile.email,
    profile.profile_title
  from public.project_tasks task
  join public.profiles profile on profile.id = task.responsible_person_id
  where task.workspace_id = workspace_uuid
    and task.deleted_at is null
    and exists (
      select 1
      from public.profiles viewer
      join public.rebrand_workspaces workspace on workspace.id = task.workspace_id
      join public.branches branch on branch.id = workspace.branch_id
      where viewer.user_id = (select auth.uid())
        and (
          viewer.workspace_ids @> array[workspace.id::text]
          or '*' = any(viewer.workspace_ids)
          or lower(btrim(coalesce(viewer.branch, ''))) in (lower(btrim(branch.id)), lower(btrim(branch.name)))
          or viewer.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
        )
    );
$$;

revoke all on function public.get_rebrand_task_assignees(uuid) from public;
grant execute on function public.get_rebrand_task_assignees(uuid) to authenticated;

commit;
