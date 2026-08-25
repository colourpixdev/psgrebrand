alter table if exists public.branches
  drop column if exists latitude,
  drop column if exists longitude;