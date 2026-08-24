alter table public.project_tasks
  add column if not exists started_date date;

comment on column public.project_tasks.started_date is
  'The date on which this stage was started.';