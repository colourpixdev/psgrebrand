drop policy if exists rebrand_project_tasks_authenticated_update on public.project_tasks;
create policy rebrand_project_tasks_authenticated_update
on public.project_tasks for update to authenticated
using (true)
with check (true);