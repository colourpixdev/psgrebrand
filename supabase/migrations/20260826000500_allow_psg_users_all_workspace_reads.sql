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
        profile.role = 'psg_user'
        or profile.workspace_ids @> array[workspace.id::text]
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

grant execute on function public.user_can_access_rebrand_workspace(uuid) to authenticated;

drop policy if exists rebrand_project_updates_psg_read on public.project_updates;
create policy rebrand_project_updates_psg_read
on public.project_updates for select to authenticated
using (public.user_can_access_rebrand_workspace(project_updates.workspace_id));

drop policy if exists rebrand_project_requests_psg_read on public.project_requests;
create policy rebrand_project_requests_psg_read
on public.project_requests for select to authenticated
using (public.user_can_access_rebrand_workspace(project_requests.workspace_id));

drop policy if exists rebrand_request_responses_psg_read on public.request_responses;
create policy rebrand_request_responses_psg_read
on public.request_responses for select to authenticated
using (exists (
  select 1
  from public.project_requests request_record
  where request_record.id = request_responses.request_id
    and public.user_can_access_rebrand_workspace(request_record.workspace_id)
));

commit;