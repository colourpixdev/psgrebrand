begin;

alter table public.profiles
  add column if not exists company text;
alter table public.profiles
  add column if not exists profile_title text;
alter table public.profiles
  add column if not exists avatar_url text;
alter table public.profiles
  add column if not exists logo_url text;

grant select, update on table public.profiles to authenticated;

drop policy if exists "Authenticated update profiles" on public.profiles;
create policy "Authenticated update profiles"
on public.profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

commit;