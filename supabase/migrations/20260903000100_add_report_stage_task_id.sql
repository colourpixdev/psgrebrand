alter table public.projects
  add column if not exists report_stage_task_id text;

comment on column public.projects.report_stage_task_id is
  'Optional task selected by an administrator as the stage displayed in reports.';