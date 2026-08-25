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
    from public.profiles p
    join public.rebrand_workspaces w on w.id = workspace_uuid
    join public.branches b on b.id = w.branch_id
    where p.user_id = (select auth.uid())
      and (
        p.workspace_ids @> array[w.id::text]
        or '*' = any(p.workspace_ids)
        or lower(btrim(coalesce(p.branch, ''))) in (lower(btrim(b.id)), lower(btrim(b.name)))
        or exists (
          select 1
          from public.project_tasks assigned_task
          where assigned_task.workspace_id = w.id
            and assigned_task.responsible_person_id = p.id
            and assigned_task.deleted_at is null
        )
      )
  );
$$;

revoke all on function public.user_can_access_rebrand_workspace(uuid) from public;
grant execute on function public.user_can_access_rebrand_workspace(uuid) to authenticated;

drop policy if exists rebrand_workspaces_psg_read on public.rebrand_workspaces;
create policy rebrand_workspaces_psg_read
on public.rebrand_workspaces for select to authenticated
using (public.user_can_access_rebrand_workspace(rebrand_workspaces.id));

drop policy if exists rebrand_project_tasks_psg_read on public.project_tasks;
create policy rebrand_project_tasks_psg_read
on public.project_tasks for select to authenticated
using (public.user_can_access_rebrand_workspace(project_tasks.workspace_id));

commit;