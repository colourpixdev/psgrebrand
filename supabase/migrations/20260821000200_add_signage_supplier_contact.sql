alter table public.branches
  add column if not exists signage_contact_name text,
  add column if not exists signage_contact_phone text,
  add column if not exists signage_contact_email text;