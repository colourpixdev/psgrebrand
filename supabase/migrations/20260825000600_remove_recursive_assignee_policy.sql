begin;

-- The assignee profile policy called user_can_access_rebrand_workspace(),
-- which itself reads profiles and caused infinite RLS recursion.
drop policy if exists rebrand_profiles_assignee_read on public.profiles;

commit;
