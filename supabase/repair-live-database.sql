-- Repair live Supabase setup for the PSG Signage Rollout Portal.
-- Run in Supabase Dashboard -> SQL Editor for project plqrjfylolaukazldnuz.
-- This fixes:
--   1. missing public.profiles table
--   2. authenticated project writes blocked by RLS

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  branch text,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.profiles enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;

do $$
begin
  create policy "Authenticated read access to projects"
    on public.projects
    for select
    to authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated insert projects"
    on public.projects
    for insert
    to authenticated
    with check (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated update projects"
    on public.projects
    for update
    to authenticated
    using (true)
    with check (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated delete projects"
    on public.projects
    for delete
    to authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated read access to profiles"
    on public.profiles
    for select
    to authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated insert profiles"
    on public.profiles
    for insert
    to authenticated
    with check (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated update profiles"
    on public.profiles
    for update
    to authenticated
    using (true)
    with check (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated delete profiles"
    on public.profiles
    for delete
    to authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

insert into public.profiles (name, role, branch, email)
values
  ('Beverley', 'colourpix_admin', null, 'beverley@colourpix.co.za'),
  ('Francois', 'colourpix_admin', null, 'francois@colourpix.co.za'),
  ('PSG Head Office', 'psg_head_office', null, 'head.office@psg.co.za'),
  ('John Smith', 'psg_branch_manager', 'PSG Hermanus', 'john.smith@psg.co.za'),
  ('ABC Signage', 'sign_company', null, 'ops@abcsignage.co.za')
on conflict (email) do update
set
  name = excluded.name,
  role = excluded.role,
  branch = excluded.branch;
