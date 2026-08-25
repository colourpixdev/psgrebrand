begin;

-- PSG users must be able to see the assigned person's name and title on
-- stages they can access. This grants read access only through an accessible task.
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

commit;
