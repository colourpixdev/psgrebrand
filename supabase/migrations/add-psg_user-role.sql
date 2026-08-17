-- Run this in Supabase Dashboard → SQL Editor to allow psg_user role

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('colourpix_admin', 'psg_head_office', 'psg_branch_manager', 'psg_user', 'sign_company'));
