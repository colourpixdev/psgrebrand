-- Repair live Supabase setup for the PSG Signage Rollout Portal.
-- Run in Supabase Dashboard -> SQL Editor for project plqrjfylolaukazldnuz.
-- Run the whole file. This version avoids do $$ blocks so partial selections are less brittle.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  branch text,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists user_id uuid unique references auth.users(id) on delete set null;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

update public.profiles profile
set user_id = auth_user.id
from auth.users auth_user
where profile.user_id is null
  and lower(profile.email) = lower(auth_user.email);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

drop function if exists public.is_colourpix_admin();

create or replace function private.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where user_id = (select auth.uid())
    or lower(email) = lower((select auth.jwt() ->> 'email'))
  order by (user_id = (select auth.uid())) desc nulls last
  limit 1;
$$;

create or replace function private.current_profile_branch()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select branch
  from public.profiles
  where user_id = (select auth.uid())
    or lower(email) = lower((select auth.jwt() ->> 'email'))
  order by (user_id = (select auth.uid())) desc nulls last
  limit 1;
$$;

create or replace function private.current_profile_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select name
  from public.profiles
  where user_id = (select auth.uid())
    or lower(email) = lower((select auth.jwt() ->> 'email'))
  order by (user_id = (select auth.uid())) desc nulls last
  limit 1;
$$;

create or replace function private.is_colourpix_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select private.current_profile_role()) = 'colourpix_admin', false);
$$;

create or replace function private.can_view_project(project_branch text, project_installer text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when (select private.current_profile_role()) in ('colourpix_admin', 'psg_head_office') then true
    when (select private.current_profile_role()) = 'psg_branch_manager' then
      (select private.current_profile_branch()) is null
      or lower(project_branch) = lower((select private.current_profile_branch()))
    when (select private.current_profile_role()) = 'sign_company' then
      lower(project_installer) = lower(coalesce((select private.current_profile_name()), ''))
      or lower(project_installer) = lower(coalesce((select private.current_profile_branch()), ''))
    else false
  end;
$$;

create or replace function private.can_update_project(project_branch text, project_installer text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select private.current_profile_role()) in ('colourpix_admin', 'psg_head_office', 'psg_branch_manager', 'sign_company')
    and (select private.can_view_project(project_branch, project_installer));
$$;

revoke all on function private.current_profile_role() from public;
revoke all on function private.current_profile_branch() from public;
revoke all on function private.current_profile_name() from public;
revoke all on function private.is_colourpix_admin() from public;
revoke all on function private.can_view_project(text, text) from public;
revoke all on function private.can_update_project(text, text) from public;
grant execute on function private.current_profile_role() to authenticated;
grant execute on function private.current_profile_branch() to authenticated;
grant execute on function private.current_profile_name() to authenticated;
grant execute on function private.is_colourpix_admin() to authenticated;
grant execute on function private.can_view_project(text, text) to authenticated;
grant execute on function private.can_update_project(text, text) to authenticated;

alter table public.projects enable row level security;
alter table public.profiles enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-files',
  'project-files',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-updates',
  'voice-updates',
  false,
  52428800,
  array[
    'audio/aac',
    'audio/m4a',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/webm',
    'video/mp4'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated read access to projects" on public.projects;
drop policy if exists "Public read access to projects" on public.projects;
drop policy if exists "Authenticated insert projects" on public.projects;
drop policy if exists "Authenticated update projects" on public.projects;
drop policy if exists "Authenticated delete projects" on public.projects;
drop policy if exists "Authenticated read access to profiles" on public.profiles;
drop policy if exists "Authenticated insert profiles" on public.profiles;
drop policy if exists "Authenticated update profiles" on public.profiles;
drop policy if exists "Authenticated delete profiles" on public.profiles;
drop policy if exists "Authenticated read project files" on storage.objects;
drop policy if exists "Authenticated insert project files" on storage.objects;
drop policy if exists "Authenticated update project files" on storage.objects;
drop policy if exists "Authenticated delete project files" on storage.objects;
drop policy if exists "Authenticated read voice updates" on storage.objects;
drop policy if exists "Authenticated insert voice updates" on storage.objects;
drop policy if exists "Authenticated delete voice updates" on storage.objects;

create policy "Authenticated read access to projects"
  on public.projects for select to authenticated
  using ((select private.can_view_project(branch, installer)));

create policy "Authenticated insert projects"
  on public.projects for insert to authenticated
  with check ((select private.current_profile_role()) = 'colourpix_admin');

create policy "Authenticated update projects"
  on public.projects for update to authenticated
  using ((select private.can_update_project(branch, installer)))
  with check ((select private.can_update_project(branch, installer)));

create policy "Authenticated delete projects"
  on public.projects for delete to authenticated
  using ((select private.current_profile_role()) = 'colourpix_admin');

create policy "Authenticated read access to profiles"
  on public.profiles for select to authenticated
  using (
    (select private.current_profile_role()) in ('colourpix_admin', 'psg_head_office')
    or user_id = (select auth.uid())
    or lower(email) = lower((select auth.jwt() ->> 'email'))
  );

create policy "Authenticated insert profiles"
  on public.profiles for insert to authenticated
  with check ((select private.is_colourpix_admin()));

create policy "Authenticated update profiles"
  on public.profiles for update to authenticated
  using ((select private.is_colourpix_admin()))
  with check ((select private.is_colourpix_admin()));

create policy "Authenticated delete profiles"
  on public.profiles for delete to authenticated
  using ((select private.is_colourpix_admin()));

create policy "Authenticated read project files"
  on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and exists (
    select 1 from public.projects where id = split_part(storage.objects.name, '/', 1)
  ));

create policy "Authenticated insert project files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and exists (
    select 1 from public.projects where id = split_part(storage.objects.name, '/', 1)
  ));

create policy "Authenticated update project files"
  on storage.objects for update to authenticated
  using (bucket_id = 'project-files' and exists (
    select 1 from public.projects where id = split_part(storage.objects.name, '/', 1)
  ))
  with check (bucket_id = 'project-files' and exists (
    select 1 from public.projects where id = split_part(storage.objects.name, '/', 1)
  ));

create policy "Authenticated delete project files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and exists (
    select 1 from public.projects where id = split_part(storage.objects.name, '/', 1)
  ));

create policy "Authenticated read voice updates"
  on storage.objects for select to authenticated
  using (bucket_id = 'voice-updates' and (select private.current_profile_role()) in ('colourpix_admin', 'psg_head_office'));

create policy "Authenticated insert voice updates"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'voice-updates' and (select private.current_profile_role()) in ('colourpix_admin', 'psg_head_office'));

create policy "Authenticated delete voice updates"
  on storage.objects for delete to authenticated
  using (bucket_id = 'voice-updates' and (select private.current_profile_role()) in ('colourpix_admin', 'psg_head_office'));

insert into public.profiles (name, role, branch, email)
values
  ('Beverley', 'colourpix_admin', null, 'beverley@colourpix.co.za'),
  ('Platform Owner', 'colourpix_admin', null, concat('francois', '@', 'colourpix.co.za')),
  ('PSG Head Office', 'psg_head_office', null, 'head.office@psg.co.za'),
  ('John Smith', 'psg_branch_manager', 'PSG Hermanus', 'john.smith@psg.co.za'),
  ('ABC Signage', 'sign_company', null, 'ops@abcsignage.co.za')
on conflict (email) do update
set
  name = excluded.name,
  role = excluded.role,
  branch = excluded.branch;
