-- RolloutHQ workspace metadata upgrade.
-- Run this in the Supabase SQL Editor when you are ready to persist multiple workspaces.

alter table public.projects
  add column if not exists workspace_id text not null default 'psg-national-signage-rollout',
  add column if not exists workspace_name text not null default 'PSG National Signage Rollout',
  add column if not exists client_company text not null default 'PSG',
  add column if not exists graphics_partner text not null default 'Colourpix (Pty) Ltd',
  add column if not exists project_type text not null default 'signage_rollout',
  add column if not exists project_type_name text not null default 'Signage rollout',
  add column if not exists site_label text not null default 'Site / branch',
  add column if not exists delivery_partner_label text not null default 'Installation partner';

create index if not exists projects_workspace_id_idx on public.projects (workspace_id);
create index if not exists projects_project_type_idx on public.projects (project_type);

alter table public.profiles
  add column if not exists company text,
  add column if not exists workspace_ids text[] not null default array['psg-national-signage-rollout'];

update public.profiles
set workspace_ids = array['psg-national-signage-rollout']
where workspace_ids is null or cardinality(workspace_ids) = 0;

update public.profiles
set workspace_ids = array['*']
where lower(email) in ('francois@colourpix.co.za', 'beverley@colourpix.co.za');