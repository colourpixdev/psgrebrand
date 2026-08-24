alter table public.projects
  add column if not exists project_start_date date;

comment on column public.projects.project_start_date is
  'The date on which the project rollout started.';
