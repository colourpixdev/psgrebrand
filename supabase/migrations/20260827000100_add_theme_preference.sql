begin;

alter table public.profiles
  add column if not exists theme_preference text;

alter table public.profiles
  add constraint profiles_theme_preference_check
  check (theme_preference is null or theme_preference in ('dark', 'light'));

commit;