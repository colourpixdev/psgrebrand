-- Cleanup script to remove Platform Owner · Workspace Administrator designations
-- Updates all profiles to have clean names without compound designations

BEGIN;

-- First, add profile_title column if it doesn't exist (for new databases)
alter table public.profiles 
add column if not exists profile_title text;

-- Update profiles table to set profile_title to NULL for all users
update public.profiles set profile_title = null where profile_title is not null;

-- Ensure Francois is properly named as just "Francois" (remove "Platform Owner" if present)
update public.profiles set name = 'Francois' 
where lower(email) = concat('francois', '@', 'colourpix.co.za') 
and name not in ('Francois', 'Francois ');

-- Ensure Beverley is properly named as just "Beverley"
update public.profiles set name = 'Beverley' 
where email = 'beverley@colourpix.co.za' 
and name != 'Beverley';

-- Log the changes
select name, email, coalesce(profile_title, 'NULL') as profile_title, role from public.profiles where role = 'colourpix_admin';

COMMIT;
