-- Cleanup script to remove Platform Owner · Workspace Administrator designations
-- Updates all profiles to have clean names without compound designations

BEGIN;

-- Update profiles table to set profile_title to NULL for all users
update public.profiles set profile_title = null where profile_title is not null;

-- Ensure Francois is properly named as just "Francois"
update public.profiles set name = 'Francois' 
where lower(email) = concat('francois', '@', 'colourpix.co.za') 
and name != 'Francois';

-- Ensure Beverley is properly named as just "Beverley"
update public.profiles set name = 'Beverley' 
where email = 'beverley@colourpix.co.za' 
and name != 'Beverley';

-- Log the changes
select name, email, profile_title, role from public.profiles where role = 'colourpix_admin';

COMMIT;
