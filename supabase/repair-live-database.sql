-- Repair live Supabase setup for the PSG Signage Rollout Portal.
-- Run in Supabase Dashboard -> SQL Editor for project nfwbpyxmbjagzgsullyn.
-- Run the whole file. This version avoids do $$ blocks so partial selections are less brittle.

create extension if not exists pgcrypto;
create sequence if not exists public.branch_code_sequence start with 1;

create table if not exists public.branches (
  id text primary key default (gen_random_uuid()::text),
  code text not null default ('PSG' || lpad(nextval('public.branch_code_sequence')::text, 3, '0')),
  name text not null,
  division text not null,
  province text not null,
  city text,
  town text not null,
  physical_address text not null,
  latitude double precision,
  longitude double precision,
  contact_name text,
  contact_email text,
  contact_phone text,
  contacts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.branches alter column id type text using id::text;
alter table public.branches alter column id set default (gen_random_uuid()::text);
alter table public.branches add column if not exists province text;
alter table public.branches add column if not exists town text;
alter table public.branches add column if not exists physical_address text;
alter table public.branches add column if not exists latitude double precision;
alter table public.branches add column if not exists longitude double precision;
alter table public.branches add column if not exists contact_name text;
alter table public.branches add column if not exists contact_email text;
alter table public.branches add column if not exists contact_phone text;
alter table public.branches add column if not exists code text;
alter table public.branches add column if not exists city text;
alter table public.branches add column if not exists contacts jsonb not null default '[]'::jsonb;
alter table public.branches alter column code set default ('PSG' || lpad(nextval('public.branch_code_sequence')::text, 3, '0'));
alter table public.branches add column if not exists created_at timestamptz not null default now();
alter table public.branches add column if not exists updated_at timestamptz not null default now();

alter table public.branches drop constraint if exists branches_latitude_range;
alter table public.branches add constraint branches_latitude_range
  check (latitude is null or latitude between -90 and 90);

alter table public.branches drop constraint if exists branches_longitude_range;
alter table public.branches add constraint branches_longitude_range
  check (longitude is null or longitude between -180 and 180);

create table if not exists public.projects (
  id text primary key,
  branch_id text,
  branch text,
  province text,
  town text,
  physical_address text,
  latitude double precision,
  longitude double precision,
  manager text not null default 'Not captured',
  manager_email text not null default '',
  installer text not null default 'Not captured',
  designer text not null default 'Not captured',
  current_stage text not null default 'New Project',
  status text not null default 'in_progress',
  target_date text not null default '',
  installation_date text not null default '',
  completion_date text not null default '',
  updated_at timestamptz not null default now(),
  progress integer not null default 0,
  branch_manager_view_only boolean not null default false,
  notes text not null default '',
  files jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  activity jsonb not null default '[]'::jsonb,
  workspace_id text,
  workspace_name text,
  client_company text,
  graphics_partner text,
  project_type text,
  project_type_name text,
  site_label text,
  delivery_partner_label text
);

alter table public.projects add column if not exists branch_id text;
alter table public.projects add column if not exists branch_code text;
alter table public.projects add column if not exists branch text;
alter table public.projects add column if not exists province text;
alter table public.projects add column if not exists town text;
alter table public.projects add column if not exists physical_address text;
alter table public.projects add column if not exists latitude double precision;
alter table public.projects add column if not exists longitude double precision;
alter table public.projects add column if not exists workspace_id text;
alter table public.projects add column if not exists workspace_name text;
alter table public.projects add column if not exists client_company text;
alter table public.projects add column if not exists graphics_partner text;
alter table public.projects add column if not exists project_type text;
alter table public.projects add column if not exists project_type_name text;
alter table public.projects add column if not exists site_label text;
alter table public.projects add column if not exists delivery_partner_label text;

update public.projects
set branch = coalesce(branch, branch_id)
where branch is null and branch_id is not null;

with ordered_branches as (
  select id, row_number() over (order by created_at asc nulls last, lower(name), id) as position
  from public.branches
  where code is null or btrim(code) = ''
)
update public.branches branch
set code = 'PSG' || lpad(ordered_branches.position::text, 3, '0')
from ordered_branches
where branch.id = ordered_branches.id;

update public.branches
set contacts = case
  when nullif(btrim(contact_name), '') is null then '[]'::jsonb
  else jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'name', contact_name,
    'email', nullif(btrim(contact_email), ''),
    'phone', nullif(btrim(contact_phone), ''),
    'designation', 'Branch Contact'
  )))
end
where case when jsonb_typeof(contacts) = 'array' then jsonb_array_length(contacts) = 0 else true end;

update public.projects project
set branch_code = branch.code
from public.branches branch
where project.branch_id = branch.id
  and (project.branch_code is null or btrim(project.branch_code) = '');

do $$
declare
  max_code_number bigint;
begin
  select coalesce(max(substring(code from '^PSG([0-9]+)$')::bigint), 0)
  into max_code_number
  from public.branches;

  if max_code_number > 0 then
    perform setval('public.branch_code_sequence', max_code_number, true);
  end if;
end $$;

alter table public.branches alter column code set not null;
create unique index if not exists branches_code_key on public.branches (code);
create index if not exists projects_branch_code_idx on public.projects (branch_code);

alter table public.projects drop constraint if exists projects_branch_id_fkey;
alter table public.projects
  add constraint projects_branch_id_fkey
  foreign key (branch_id) references public.branches(id) on delete restrict;

alter table public.projects drop constraint if exists projects_latitude_range;
alter table public.projects add constraint projects_latitude_range
  check (latitude is null or latitude between -90 and 90);

alter table public.projects drop constraint if exists projects_longitude_range;
alter table public.projects add constraint projects_longitude_range
  check (longitude is null or longitude between -180 and 180);

alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check
  check (status in ('completed', 'busy', 'in_progress', 'awaiting_approval', 'delayed', 'on_hold', 'cancelled'));

alter table public.projects drop constraint if exists projects_progress_check;
alter table public.projects add constraint projects_progress_check
  check (progress between 0 and 100);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  branch text,
  permission_overrides jsonb not null default '{}'::jsonb,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists user_id uuid unique references auth.users(id) on delete set null;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists permission_overrides jsonb not null default '{}'::jsonb;

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

create or replace function private.can_view_project(project_branch_id text, project_installer text)
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
      or exists (
        select 1 from public.branches
        where id = project_branch_id
        and lower(name) = lower((select private.current_profile_branch()))
      )
    when (select private.current_profile_role()) = 'sign_company' then
      lower(project_installer) = lower(coalesce((select private.current_profile_name()), ''))
      or lower(project_installer) = lower(coalesce((select private.current_profile_branch()), ''))
    else false
  end;
$$;

create or replace function private.can_update_project(project_branch_id text, project_installer text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select private.current_profile_role()) in ('colourpix_admin', 'psg_head_office', 'psg_branch_manager', 'sign_company')
    and (select private.can_view_project(project_branch_id, project_installer));
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

alter table public.branches enable row level security;
alter table public.projects enable row level security;
alter table public.profiles enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.branches to authenticated;
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

drop policy if exists "Authenticated read access to branches" on public.branches;
drop policy if exists "Authenticated insert branches" on public.branches;
drop policy if exists "Authenticated update branches" on public.branches;
drop policy if exists "Authenticated delete branches" on public.branches;
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

create policy "Authenticated read access to branches"
  on public.branches for select to authenticated
  using ((select private.current_profile_role()) in ('colourpix_admin', 'psg_head_office', 'psg_branch_manager', 'sign_company'));

create policy "Authenticated insert branches"
  on public.branches for insert to authenticated
  with check ((select private.current_profile_role()) = 'colourpix_admin');

create policy "Authenticated update branches"
  on public.branches for update to authenticated
  using ((select private.current_profile_role()) = 'colourpix_admin')
  with check ((select private.current_profile_role()) = 'colourpix_admin');

create policy "Authenticated delete branches"
  on public.branches for delete to authenticated
  using ((select private.current_profile_role()) = 'colourpix_admin');

create policy "Authenticated read access to projects"
  on public.projects for select to authenticated
  using ((select private.can_view_project(branch_id, installer)));

create policy "Authenticated insert projects"
  on public.projects for insert to authenticated
  with check ((select private.current_profile_role()) = 'colourpix_admin');

create policy "Authenticated update projects"
  on public.projects for update to authenticated
  using ((select private.can_update_project(branch_id, installer)))
  with check ((select private.can_update_project(branch_id, installer)));

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
