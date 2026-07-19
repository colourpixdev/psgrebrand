-- Create and seed the profiles table.
-- Run this in Supabase Dashboard → SQL Editor
-- (Project: plqrjfylolaukazldnuz)

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  role text not null check (role in ('colourpix_admin', 'psg_head_office', 'psg_branch_manager', 'sign_company')),
  branch text,
  company text,
  profile_title text,
  avatar_url text,
  logo_url text,
  workspace_ids text[] not null default array['psg-national-signage-rollout'],
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists user_id uuid unique references auth.users(id) on delete set null;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists company text;
alter table public.profiles add column if not exists profile_title text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists logo_url text;
alter table public.profiles add column if not exists workspace_ids text[] not null default array['psg-national-signage-rollout'];

do $$ begin
  alter table public.profiles add constraint profiles_role_check check (role in ('colourpix_admin', 'psg_head_office', 'psg_branch_manager', 'sign_company'));
exception when duplicate_object then null;
end $$;

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

create or replace function private.is_colourpix_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select private.current_profile_role()) = 'colourpix_admin', false);
$$;

revoke all on function private.current_profile_role() from public;
revoke all on function private.is_colourpix_admin() from public;
grant execute on function private.current_profile_role() to authenticated;
grant execute on function private.is_colourpix_admin() to authenticated;

alter table public.profiles enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;

drop policy if exists "Authenticated read access to profiles" on public.profiles;
drop policy if exists "Authenticated insert profiles" on public.profiles;
drop policy if exists "Authenticated update profiles" on public.profiles;
drop policy if exists "Authenticated delete profiles" on public.profiles;

do $$ begin
  create policy "Authenticated read access to profiles"
    on public.profiles for select to authenticated using (
      (select private.current_profile_role()) in ('colourpix_admin', 'psg_head_office')
      or user_id = (select auth.uid())
      or lower(email) = lower((select auth.jwt() ->> 'email'))
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated insert profiles"
    on public.profiles for insert to authenticated with check ((select private.is_colourpix_admin()));
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated update profiles"
    on public.profiles for update to authenticated using ((select private.is_colourpix_admin())) with check ((select private.is_colourpix_admin()));
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Authenticated delete profiles"
    on public.profiles for delete to authenticated using ((select private.is_colourpix_admin()));
exception when duplicate_object then null;
end $$;

insert into public.profiles (name, role, branch, email)
values
  ('Beverley',        'colourpix_admin',    null,          'beverley@colourpix.co.za'),
  ('Platform Owner',  'colourpix_admin',    null,          concat('francois', '@', 'colourpix.co.za')),
  ('PSG Head Office', 'psg_head_office',    null,          'head.office@psg.co.za'),
  ('John Smith',      'psg_branch_manager', 'PSG Hermanus','john.smith@psg.co.za'),
  ('ABC Signage',     'sign_company',       null,          'ops@abcsignage.co.za')
on conflict (email) do nothing;
