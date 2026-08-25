alter table public.branches
  add column if not exists archived_at timestamptz;

create index if not exists branches_active_name_idx
  on public.branches (name)
  where archived_at is null;
