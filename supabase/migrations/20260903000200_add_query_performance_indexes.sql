create index if not exists projects_updated_at_idx
  on public.projects (updated_at desc);

create index if not exists projects_status_idx
  on public.projects (status);

create index if not exists projects_report_stage_task_idx
  on public.projects (report_stage_task_id);

create index if not exists project_tasks_workspace_active_sort_idx
  on public.project_tasks (workspace_id, sort_order)
  where deleted_at is null;

create index if not exists project_tasks_workspace_status_idx
  on public.project_tasks (workspace_id, status)
  where deleted_at is null;

create index if not exists project_files_workspace_active_idx
  on public.project_files (workspace_id)
  where deleted_at is null;
