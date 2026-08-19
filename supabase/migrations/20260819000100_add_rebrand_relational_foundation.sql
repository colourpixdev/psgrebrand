-- PSG Rebrand Control Centre: Phase 1 relational foundation
--
-- Purpose:
--   Add the new relational workspace model alongside the existing branches,
--   projects, profiles, and projects JSONB columns.
--
-- Safety:
--   - This migration creates new objects only.
--   - It does not drop or alter existing tables, columns, policies, or data.
--   - It does not migrate legacy JSONB data.
--   - It does not enforce stage completion based on required files.
--   - Run first in a staging Supabase project and review RLS tests before production.
--
-- Locked business rules for this phase:
--   - One active primary rebrand workspace per branch.
--   - Internal app users are Colourpix staff and PSG Head Office.
--   - Branch Managers and Installers are external contacts, not app roles.
--   - Tasks use a responsible group and optional responsible person.
--   - Tasks do not require a responsible person.
--   - Stages may be marked complete even when files are missing.
--   - Approvals and external sign-offs are recorded by internal users.
--   - At-risk health is calculated by the application/reporting layer when due dates pass.

begin;

-- ---------------------------------------------------------------------------
-- 1. Reference data: fixed stages and responsibility groups
-- ---------------------------------------------------------------------------

create table if not exists public.workflow_stages (
  id uuid primary key default gen_random_uuid(),
  stage_number integer not null,
  stage_key text not null,
  name text not null,
  description text not null default '',
  sort_order integer not null,
  is_system_stage boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_stages_stage_number_check check (stage_number between 1 and 14),
  constraint workflow_stages_stage_key_check check (stage_key ~ '^[a-z0-9_]+$'),
  constraint workflow_stages_stage_number_key unique (stage_number),
  constraint workflow_stages_stage_key_unique unique (stage_key),
  constraint workflow_stages_sort_order_unique unique (sort_order)
);

comment on table public.workflow_stages is
  'Protected reference rows for the fixed PSG rebrand lifecycle.';

insert into public.workflow_stages (stage_number, stage_key, name, description, sort_order)
values
  (1,  'branch_confirmed',          'Branch Confirmed',              'Confirm the branch and rebrand scope.', 1),
  (2,  'brief_requested',           'Brief Requested',               'Request the information needed to begin.', 2),
  (3,  'site_information',          'Site Information Collected',   'Collect site details, measurements, and photographs.', 3),
  (4,  'design_artwork',             'Design/Artwork',                'Prepare the rebrand artwork or design.', 4),
  (5,  'internal_review',            'Internal Review',               'Review work internally before client submission.', 5),
  (6,  'psg_approval',               'PSG Approval',                  'Record PSG/client approval or requested changes.', 6),
  (7,  'quote',                      'Quote',                         'Prepare and submit the commercial quote.', 7),
  (8,  'quote_approval',             'Quote Approval',                'Record commercial approval.', 8),
  (9,  'production',                 'Production',                    'Produce the approved signage or materials.', 9),
  (10, 'installation_planning',      'Installation Planning',         'Confirm date, access, and site readiness.', 10),
  (11, 'installation',               'Installation',                  'Perform the physical installation.', 11),
  (12, 'installation_evidence',      'Installation Evidence',         'Collect installation photographs and evidence.', 12),
  (13, 'final_inspection',           'Final Inspection',              'Inspect the result and resolve defects.', 13),
  (14, 'complete',                   'Complete',                      'Close the rebrand workspace.', 14)
on conflict (stage_key) do nothing;

create table if not exists public.responsibility_groups (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  name text not null,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint responsibility_groups_key_unique unique (group_key),
  constraint responsibility_groups_name_unique unique (name),
  constraint responsibility_groups_key_check check (group_key ~ '^[a-z0-9_]+$')
);

comment on table public.responsibility_groups is
  'Business groups responsible for acting on tasks; separate from authentication roles.';

insert into public.responsibility_groups (group_key, name, description)
values
  ('colourpix', 'Colourpix', 'Colourpix staff responsible for rollout delivery.'),
  ('psg_head_office', 'PSG Head Office', 'PSG Head Office responsible for review and sign-off.')
on conflict (group_key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Relational rebrand workspace
-- ---------------------------------------------------------------------------

create table if not exists public.rebrand_workspaces (
  id uuid primary key default gen_random_uuid(),
  branch_id text not null references public.branches(id) on delete restrict,
  workspace_reference text not null,
  workspace_type text not null default 'rebrand',
  is_primary boolean not null default true,
  lifecycle_state text not null default 'active',
  health text not null default 'on_track',
  current_stage_id uuid references public.workflow_stages(id) on delete restrict,
  current_task_id uuid,
  target_date date,
  brief_requested_date date,
  installation_date date,
  completion_date date,
  progress integer not null default 0,
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  constraint rebrand_workspaces_reference_unique unique (workspace_reference),
  constraint rebrand_workspaces_type_check check (workspace_type = 'rebrand'),
  constraint rebrand_workspaces_lifecycle_check check (lifecycle_state in ('active', 'archived')),
  constraint rebrand_workspaces_health_check check (health in ('on_track', 'at_risk', 'blocked', 'complete')),
  constraint rebrand_workspaces_progress_check check (progress between 0 and 100),
  constraint rebrand_workspaces_archive_check check (
    (lifecycle_state = 'active' and archived_at is null and archived_by is null)
    or (lifecycle_state = 'archived' and archived_at is not null)
  )
);

comment on table public.rebrand_workspaces is
  'Relational branch rebrand workspace. Legacy public.projects remains untouched during Phase 1.';

-- This is the database-level one-active-primary-workspace-per-branch rule.
create unique index if not exists rebrand_workspaces_one_active_primary_per_branch
  on public.rebrand_workspaces (branch_id)
  where is_primary = true and lifecycle_state = 'active';

create index if not exists rebrand_workspaces_branch_idx
  on public.rebrand_workspaces (branch_id);
create index if not exists rebrand_workspaces_stage_idx
  on public.rebrand_workspaces (current_stage_id);
create index if not exists rebrand_workspaces_health_idx
  on public.rebrand_workspaces (health);
create index if not exists rebrand_workspaces_installation_date_idx
  on public.rebrand_workspaces (installation_date);
create index if not exists rebrand_workspaces_target_date_idx
  on public.rebrand_workspaces (target_date);
create index if not exists rebrand_workspaces_updated_at_idx
  on public.rebrand_workspaces (updated_at desc);

-- ---------------------------------------------------------------------------
-- 3. Tasks and task file requirements
-- ---------------------------------------------------------------------------

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rebrand_workspaces(id) on delete restrict,
  stage_id uuid not null references public.workflow_stages(id) on delete restrict,
  title text not null,
  description text not null default '',
  status text not null default 'not_started',
  priority text not null default 'normal',
  sort_order integer not null default 0,
  due_date date,
  responsible_group_id uuid not null references public.responsibility_groups(id) on delete restrict,
  responsible_person_id uuid references public.profiles(id) on delete set null,
  required_action text not null default '',
  waiting_reason text,
  blocker_reason text,
  required_completion_checks jsonb not null default '[]'::jsonb,
  is_current boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  reopened_by uuid references public.profiles(id) on delete set null,
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint project_tasks_title_check check (length(btrim(title)) > 0),
  constraint project_tasks_status_check check (status in ('not_started', 'in_progress', 'waiting', 'blocked', 'complete', 'cancelled')),
  constraint project_tasks_priority_check check (priority in ('normal', 'important', 'urgent')),
  constraint project_tasks_waiting_reason_check check (status <> 'waiting' or length(btrim(coalesce(waiting_reason, ''))) > 0),
  constraint project_tasks_blocker_reason_check check (status <> 'blocked' or length(btrim(coalesce(blocker_reason, ''))) > 0),
  constraint project_tasks_completion_check check (
    status <> 'complete'
    or (completed_by is not null and completed_at is not null)
  ),
  constraint project_tasks_not_current_when_deleted_check check (deleted_at is null or is_current = false),
  constraint project_tasks_workspace_task_unique unique (workspace_id, id)
);

comment on table public.project_tasks is
  'Shared operational work items. A responsible person is optional; no assignee is required.';

-- A workspace can have at most one explicit current task.
create unique index if not exists project_tasks_one_current_per_workspace
  on public.project_tasks (workspace_id)
  where is_current = true and deleted_at is null;

create index if not exists project_tasks_workspace_stage_idx
  on public.project_tasks (workspace_id, stage_id, sort_order);
create index if not exists project_tasks_workspace_status_idx
  on public.project_tasks (workspace_id, status);
create index if not exists project_tasks_due_date_idx
  on public.project_tasks (due_date)
  where deleted_at is null;
create index if not exists project_tasks_responsible_group_idx
  on public.project_tasks (responsible_group_id, status);
create index if not exists project_tasks_responsible_person_idx
  on public.project_tasks (responsible_person_id, status)
  where responsible_person_id is not null;
create index if not exists project_tasks_title_search_idx
  on public.project_tasks using gin (to_tsvector('simple', title || ' ' || description));

-- Add the cross-table current-task relationship after project_tasks exists.
alter table public.rebrand_workspaces
  drop constraint if exists rebrand_workspaces_current_task_fk;
alter table public.rebrand_workspaces
  add constraint rebrand_workspaces_current_task_fk
  foreign key (id, current_task_id)
  references public.project_tasks (workspace_id, id)
  on delete set null;

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  version integer not null default 1,
  stage_id uuid not null references public.workflow_stages(id) on delete restrict,
  title text not null,
  description text not null default '',
  is_required boolean not null default false,
  suggested_priority text not null default 'normal',
  responsible_group_id uuid not null references public.responsibility_groups(id) on delete restrict,
  suggested_sort_order integer not null default 0,
  requires_approval boolean not null default false,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retired_at timestamptz,
  constraint task_templates_title_check check (length(btrim(title)) > 0),
  constraint task_templates_priority_check check (suggested_priority in ('normal', 'important', 'urgent')),
  constraint task_templates_key_version_unique unique (template_key, version)
);

create index if not exists task_templates_stage_active_idx
  on public.task_templates (stage_id, active);

create table if not exists public.file_categories (
  id uuid primary key default gen_random_uuid(),
  category_key text not null,
  name text not null,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint file_categories_key_unique unique (category_key),
  constraint file_categories_name_unique unique (name)
);

insert into public.file_categories (category_key, name, description)
values
  ('brief', 'Brief', 'Branch and project brief information.'),
  ('site_information', 'Site Information', 'Site measurements, photographs, and restrictions.'),
  ('artwork', 'Artwork', 'Design and artwork files.'),
  ('quote', 'Quote', 'Commercial quote files.'),
  ('approval', 'Approval', 'Approval evidence or sign-off records.'),
  ('production', 'Production', 'Production and manufacturing documents.'),
  ('installation', 'Installation', 'Installation planning and instructions.'),
  ('installation_evidence', 'Installation Evidence', 'Installation photographs and completion evidence.'),
  ('final_inspection', 'Final Inspection', 'Final inspection and closeout records.'),
  ('other', 'Other', 'Files that do not fit another category.')
on conflict (category_key) do nothing;

create table if not exists public.task_template_file_requirements (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.task_templates(id) on delete cascade,
  file_category_id uuid not null references public.file_categories(id) on delete restrict,
  requirement_name text not null,
  description text not null default '',
  minimum_count integer not null default 1,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_template_file_requirements_count_check check (minimum_count >= 1),
  constraint task_template_file_requirements_unique unique (template_id, file_category_id, requirement_name)
);

create table if not exists public.task_file_requirements (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  file_category_id uuid not null references public.file_categories(id) on delete restrict,
  requirement_name text not null,
  description text not null default '',
  minimum_count integer not null default 1,
  is_required boolean not null default true,
  satisfied_at timestamptz,
  satisfied_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_file_requirements_count_check check (minimum_count >= 1),
  constraint task_file_requirements_unique unique (task_id, file_category_id, requirement_name)
);

create index if not exists task_file_requirements_task_idx
  on public.task_file_requirements (task_id, is_required, satisfied_at);

-- ---------------------------------------------------------------------------
-- 4. Files and versions
-- ---------------------------------------------------------------------------

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rebrand_workspaces(id) on delete restrict,
  task_id uuid,
  category_id uuid not null references public.file_categories(id) on delete restrict,
  display_name text not null,
  current_version_id uuid,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  constraint project_files_name_check check (length(btrim(display_name)) > 0)
);

create table if not exists public.file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.project_files(id) on delete cascade,
  version_number integer not null,
  storage_bucket text not null default 'project-files',
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  checksum text,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  deleted_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint file_versions_number_check check (version_number >= 1),
  constraint file_versions_size_check check (size_bytes is null or size_bytes >= 0),
  constraint file_versions_path_unique unique (storage_path),
  constraint file_versions_file_version_unique unique (file_id, version_number)
);

alter table public.project_files
  drop constraint if exists project_files_task_workspace_fk;
alter table public.project_files
  add constraint project_files_task_workspace_fk
  foreign key (workspace_id, task_id)
  references public.project_tasks (workspace_id, id)
  on delete set null;

alter table public.project_files
  drop constraint if exists project_files_current_version_fk;
alter table public.project_files
  add constraint project_files_current_version_fk
  foreign key (current_version_id)
  references public.file_versions(id)
  on delete set null;

create index if not exists project_files_workspace_idx
  on public.project_files (workspace_id, deleted_at);
create index if not exists project_files_task_idx
  on public.project_files (task_id, deleted_at);
create index if not exists project_files_category_idx
  on public.project_files (category_id, deleted_at);
create index if not exists project_files_name_search_idx
  on public.project_files using gin (to_tsvector('simple', display_name));
create index if not exists file_versions_file_idx
  on public.file_versions (file_id, version_number desc);

-- ---------------------------------------------------------------------------
-- 5. Updates, requests, approvals, and audit activity
-- ---------------------------------------------------------------------------

create table if not exists public.project_updates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rebrand_workspaces(id) on delete restrict,
  task_id uuid references public.project_tasks(id) on delete set null,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint project_updates_body_check check (length(btrim(body)) > 0)
);

create index if not exists project_updates_workspace_idx
  on public.project_updates (workspace_id, created_at desc);
create index if not exists project_updates_task_idx
  on public.project_updates (task_id, created_at desc);
create index if not exists project_updates_search_idx
  on public.project_updates using gin (to_tsvector('simple', body));

create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rebrand_workspaces(id) on delete restrict,
  task_id uuid references public.project_tasks(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  required_group_id uuid references public.responsibility_groups(id) on delete restrict,
  required_person_id uuid references public.profiles(id) on delete set null,
  subject text not null,
  body text not null,
  status text not null default 'open',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  constraint project_requests_status_check check (status in ('open', 'answered', 'closed', 'cancelled')),
  constraint project_requests_subject_check check (length(btrim(subject)) > 0),
  constraint project_requests_body_check check (length(btrim(body)) > 0)
);

create index if not exists project_requests_workspace_status_idx
  on public.project_requests (workspace_id, status);
create index if not exists project_requests_response_target_idx
  on public.project_requests (required_group_id, required_person_id, status);
create index if not exists project_requests_due_date_idx
  on public.project_requests (due_date)
  where status in ('open', 'answered');
create index if not exists project_requests_search_idx
  on public.project_requests using gin (to_tsvector('simple', subject || ' ' || body));

create table if not exists public.request_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.project_requests(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint request_responses_body_check check (length(btrim(body)) > 0)
);

create index if not exists request_responses_request_idx
  on public.request_responses (request_id, created_at);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rebrand_workspaces(id) on delete restrict,
  task_id uuid references public.project_tasks(id) on delete set null,
  approval_type text not null,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  decision_group_id uuid references public.responsibility_groups(id) on delete restrict,
  decision_person_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending',
  subject text not null,
  description text not null default '',
  requested_at timestamptz not null default now(),
  due_date date,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approvals_status_check check (status in ('pending', 'approved', 'rejected', 'changes_requested', 'withdrawn')),
  constraint approvals_type_check check (approval_type in ('artwork', 'quote', 'site_specs', 'installation', 'final_inspection', 'other')),
  constraint approvals_subject_check check (length(btrim(subject)) > 0),
  constraint approvals_decision_date_check check (status = 'pending' or decided_at is not null)
);

create index if not exists approvals_workspace_status_idx
  on public.approvals (workspace_id, status);
create index if not exists approvals_decision_target_idx
  on public.approvals (decision_group_id, decision_person_id, status);
create index if not exists approvals_due_date_idx
  on public.approvals (due_date)
  where status = 'pending';

create table if not exists public.approval_files (
  approval_id uuid not null references public.approvals(id) on delete cascade,
  file_id uuid not null references public.project_files(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (approval_id, file_id)
);

create table if not exists public.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.approvals(id) on delete cascade,
  decision text not null,
  decided_by uuid not null references public.profiles(id) on delete restrict,
  comment text not null default '',
  created_at timestamptz not null default now(),
  constraint approval_decisions_decision_check check (decision in ('approved', 'rejected', 'changes_requested', 'withdrawn'))
);

create index if not exists approval_decisions_approval_idx
  on public.approval_decisions (approval_id, created_at desc);

create table if not exists public.project_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.rebrand_workspaces(id) on delete set null,
  branch_id text references public.branches(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  occurred_at timestamptz not null default now(),
  source text not null default 'user',
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  correlation_id uuid,
  constraint project_activity_source_check check (source in ('user', 'automation', 'import', 'migration'))
);

comment on table public.project_activity is
  'Append-only audit log. Normal users cannot update or delete rows.';

create index if not exists project_activity_workspace_time_idx
  on public.project_activity (workspace_id, occurred_at desc);
create index if not exists project_activity_entity_time_idx
  on public.project_activity (entity_type, entity_id, occurred_at desc);
create index if not exists project_activity_actor_time_idx
  on public.project_activity (actor_id, occurred_at desc);

-- Prevent UPDATE/DELETE even if a future policy is accidentally broadened.
create or replace function private.prevent_rebrand_activity_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'project_activity is immutable';
end;
$$;

drop trigger if exists project_activity_immutable_trigger on public.project_activity;
create trigger project_activity_immutable_trigger
before update or delete on public.project_activity
for each row execute function private.prevent_rebrand_activity_mutation();

-- ---------------------------------------------------------------------------
-- 6. Roles and scoped workspace access
-- ---------------------------------------------------------------------------

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null,
  name text not null,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_key_unique unique (role_key),
  constraint roles_name_unique unique (name)
);

insert into public.roles (role_key, name, description)
values
  ('colourpix_admin', 'Colourpix Admin', 'Full internal rollout administration.'),
  ('colourpix_staff', 'Colourpix Staff', 'Internal rollout staff access.'),
  ('psg_head_office', 'PSG Head Office', 'Internal PSG oversight and approval access.')
on conflict (role_key) do nothing;

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null,
  name text not null,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permissions_key_unique unique (permission_key)
);

insert into public.permissions (permission_key, name, description)
values
  ('view_branches', 'View branches', 'Read branch identity and contact data.'),
  ('view_workspaces', 'View workspaces', 'Read permitted rebrand workspaces.'),
  ('edit_workspace', 'Edit workspace', 'Edit workspace status, dates, health, and summary.'),
  ('edit_tasks', 'Edit tasks', 'Create and edit task records.'),
  ('change_task_status', 'Change task status', 'Change task status and transition metadata.'),
  ('upload_files', 'Upload files', 'Upload permitted project files.'),
  ('delete_files', 'Delete files', 'Delete project files and versions.'),
  ('create_updates', 'Create updates', 'Create progress updates.'),
  ('create_requests', 'Create requests', 'Create response-required requests.'),
  ('answer_requests', 'Answer requests', 'Respond to requests.'),
  ('decide_approvals', 'Decide approvals', 'Approve, reject, or request changes.'),
  ('view_reports', 'View reports', 'Read rollout reports.'),
  ('manage_users', 'Manage users', 'Manage internal profiles and access.'),
  ('manage_permissions', 'Manage permissions', 'Manage roles and permission assignments.')
on conflict (permission_key) do nothing;

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.profile_role_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  active boolean not null default true,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  constraint profile_role_assignments_active_check check ((active and revoked_at is null) or (not active))
);

create unique index if not exists profile_role_assignments_one_active_role
  on public.profile_role_assignments (profile_id)
  where active = true;

create table if not exists public.workspace_access_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rebrand_workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  access_level text not null default 'view',
  allowed_sections jsonb not null default '["installation_tasks", "installation_evidence", "installation_updates"]'::jsonb,
  active boolean not null default true,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  constraint workspace_access_grants_level_check check (access_level in ('view', 'operational_edit', 'installation_edit')),
  constraint workspace_access_grants_active_check check ((active and revoked_at is null) or (not active)),
  constraint workspace_access_grants_unique_active unique (workspace_id, profile_id)
);

create index if not exists workspace_access_grants_profile_idx
  on public.workspace_access_grants (profile_id, active);
create index if not exists workspace_access_grants_workspace_idx
  on public.workspace_access_grants (workspace_id, active);

-- ---------------------------------------------------------------------------
-- 7. Notifications
-- ---------------------------------------------------------------------------

create table if not exists public.rebrand_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid references public.rebrand_workspaces(id) on delete cascade,
  task_id uuid references public.project_tasks(id) on delete cascade,
  request_id uuid references public.project_requests(id) on delete cascade,
  approval_id uuid references public.approvals(id) on delete cascade,
  activity_id uuid references public.project_activity(id) on delete set null,
  notification_type text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  email_status text not null default 'not_requested',
  email_sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint rebrand_notifications_email_status_check check (email_status in ('not_requested', 'queued', 'sent', 'failed', 'not_applicable'))
);

create index if not exists rebrand_notifications_recipient_idx
  on public.rebrand_notifications (recipient_id, read_at, created_at desc);
create index if not exists rebrand_notifications_workspace_idx
  on public.rebrand_notifications (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 8. Grants and RLS
-- ---------------------------------------------------------------------------

-- New public-schema tables are not automatically exposed by newer Supabase
-- Data API defaults. These explicit grants are necessary for authenticated
-- REST access; RLS below remains the row-level security boundary. Do not use
-- GRANT ... ON ALL TABLES here because that would change legacy table grants.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.workflow_stages,
  public.responsibility_groups,
  public.rebrand_workspaces,
  public.project_tasks,
  public.task_templates,
  public.file_categories,
  public.task_template_file_requirements,
  public.task_file_requirements,
  public.project_files,
  public.file_versions,
  public.project_updates,
  public.project_requests,
  public.request_responses,
  public.approvals,
  public.approval_files,
  public.approval_decisions,
  public.project_activity,
  public.roles,
  public.permissions,
  public.role_permissions,
  public.profile_role_assignments,
  public.workspace_access_grants,
  public.rebrand_notifications
to authenticated;

alter table public.workflow_stages enable row level security;
alter table public.responsibility_groups enable row level security;
alter table public.rebrand_workspaces enable row level security;
alter table public.project_tasks enable row level security;
alter table public.task_templates enable row level security;
alter table public.file_categories enable row level security;
alter table public.task_template_file_requirements enable row level security;
alter table public.task_file_requirements enable row level security;
alter table public.project_files enable row level security;
alter table public.file_versions enable row level security;
alter table public.project_updates enable row level security;
alter table public.project_requests enable row level security;
alter table public.request_responses enable row level security;
alter table public.approvals enable row level security;
alter table public.approval_files enable row level security;
alter table public.approval_decisions enable row level security;
alter table public.project_activity enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profile_role_assignments enable row level security;
alter table public.workspace_access_grants enable row level security;
alter table public.rebrand_notifications enable row level security;

-- Phase 1 locked user model: only authenticated profiles with one of these
-- existing role values may access the new foundation. Branch Managers and
-- Installers are external contacts in this phase, not app users.
--
-- The EXISTS checks intentionally use profiles.user_id and auth.uid(). They do
-- not trust editable user_metadata or raw_user_meta_data claims.

-- Reference data: internal users can read; only administrators should later
-- receive write policies for protected reference rows.
drop policy if exists rebrand_workflow_stages_read on public.workflow_stages;
create policy rebrand_workflow_stages_read
on public.workflow_stages for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_responsibility_groups_read on public.responsibility_groups;
create policy rebrand_responsibility_groups_read
on public.responsibility_groups for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_file_categories_read on public.file_categories;
create policy rebrand_file_categories_read
on public.file_categories for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_roles_read on public.roles;
create policy rebrand_roles_read
on public.roles for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_permissions_read on public.permissions;
create policy rebrand_permissions_read
on public.permissions for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

-- Internal-user helper predicate repeated in policies so the policy remains
-- transparent and does not require a SECURITY DEFINER authorization function.

-- Workspaces are visible only to internal app users in Phase 1.
drop policy if exists rebrand_workspaces_internal_all on public.rebrand_workspaces;
create policy rebrand_workspaces_internal_all
on public.rebrand_workspaces for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

-- All operational child rows inherit Phase 1 internal-user visibility.
-- Later phases should replace this with workspace-scoped policies and explicit
-- permission checks for each mutation type.
drop policy if exists rebrand_project_tasks_internal_all on public.project_tasks;
create policy rebrand_project_tasks_internal_all
on public.project_tasks for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_task_templates_internal_all on public.task_templates;
create policy rebrand_task_templates_internal_all
on public.task_templates for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_task_template_file_requirements_internal_all on public.task_template_file_requirements;
create policy rebrand_task_template_file_requirements_internal_all
on public.task_template_file_requirements for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_task_file_requirements_internal_all on public.task_file_requirements;
create policy rebrand_task_file_requirements_internal_all
on public.task_file_requirements for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_project_files_internal_all on public.project_files;
create policy rebrand_project_files_internal_all
on public.project_files for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_file_versions_internal_all on public.file_versions;
create policy rebrand_file_versions_internal_all
on public.file_versions for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_project_updates_internal_all on public.project_updates;
create policy rebrand_project_updates_internal_all
on public.project_updates for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_project_requests_internal_all on public.project_requests;
create policy rebrand_project_requests_internal_all
on public.project_requests for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_request_responses_internal_all on public.request_responses;
create policy rebrand_request_responses_internal_all
on public.request_responses for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_approvals_internal_all on public.approvals;
create policy rebrand_approvals_internal_all
on public.approvals for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_approval_files_internal_all on public.approval_files;
create policy rebrand_approval_files_internal_all
on public.approval_files for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_approval_decisions_internal_all on public.approval_decisions;
create policy rebrand_approval_decisions_internal_all
on public.approval_decisions for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

-- Activity is readable/insertable by internal users but never updateable or
-- deleteable. The trigger above is defense in depth.
drop policy if exists rebrand_project_activity_internal_read on public.project_activity;
create policy rebrand_project_activity_internal_read
on public.project_activity for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_project_activity_internal_insert on public.project_activity;
create policy rebrand_project_activity_internal_insert
on public.project_activity for insert to authenticated
with check (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
));

drop policy if exists rebrand_roles_permissions_read on public.role_permissions;
create policy rebrand_roles_permissions_read
on public.role_permissions for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role in ('colourpix_admin', 'psg_head_office')
));

drop policy if exists rebrand_profile_role_assignments_internal_all on public.profile_role_assignments;
create policy rebrand_profile_role_assignments_internal_all
on public.profile_role_assignments for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role = 'colourpix_admin'
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role = 'colourpix_admin'
));

drop policy if exists rebrand_workspace_access_grants_internal_all on public.workspace_access_grants;
create policy rebrand_workspace_access_grants_internal_all
on public.workspace_access_grants for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role = 'colourpix_admin'
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.role = 'colourpix_admin'
));

drop policy if exists rebrand_notifications_own on public.rebrand_notifications;
create policy rebrand_notifications_own
on public.rebrand_notifications for select to authenticated
using (recipient_id = (select id from public.profiles where user_id = (select auth.uid())));

drop policy if exists rebrand_notifications_mark_own on public.rebrand_notifications;
create policy rebrand_notifications_mark_own
on public.rebrand_notifications for update to authenticated
using (recipient_id = (select id from public.profiles where user_id = (select auth.uid())))
with check (recipient_id = (select id from public.profiles where user_id = (select auth.uid())));

-- No anon grants are added. New tables are intentionally private to the
-- authenticated internal roles for Phase 1.

-- ---------------------------------------------------------------------------
-- 9. Side-by-side verification queries
-- ---------------------------------------------------------------------------

-- Query A: compare each legacy project with its new workspace counterpart.
-- This is read-only and returns missing/new matches without changing data.
select
  legacy.id as legacy_project_id,
  legacy.branch_id,
  legacy.branch as legacy_branch_name,
  workspace.id as relational_workspace_id,
  workspace.workspace_reference,
  workspace.lifecycle_state,
  workspace.current_stage_id,
  workspace.current_task_id,
  jsonb_array_length(case when jsonb_typeof(legacy.tasks) = 'array' then legacy.tasks else '[]'::jsonb end) as legacy_task_count,
  coalesce(relational_task_counts.task_count, 0) as relational_task_count,
  jsonb_array_length(case when jsonb_typeof(legacy.files) = 'array' then legacy.files else '[]'::jsonb end) as legacy_file_count,
  coalesce(relational_file_counts.file_count, 0) as relational_file_count
from public.projects legacy
left join public.rebrand_workspaces workspace
  on workspace.branch_id = legacy.branch_id
left join lateral (
  select count(*)::integer as task_count
  from public.project_tasks task
  where task.workspace_id = workspace.id
    and task.deleted_at is null
) relational_task_counts on true
left join lateral (
  select count(*)::integer as file_count
  from public.project_files file
  where file.workspace_id = workspace.id
    and file.deleted_at is null
) relational_file_counts on true
order by legacy.branch_id, legacy.id;

-- Query B: compare legacy JSONB task rows with relational task rows by title.
-- Duplicate titles require manual review; this query is a diagnostic only.
select
  legacy.id as legacy_project_id,
  legacy.branch_id,
  legacy_task->>'id' as legacy_task_id,
  legacy_task->>'text' as legacy_task_title,
  legacy_task->>'status' as legacy_task_status,
  task.id as relational_task_id,
  task.status as relational_task_status,
  task.responsible_group_id,
  task.responsible_person_id
from public.projects legacy
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(legacy.tasks) = 'array' then legacy.tasks else '[]'::jsonb end
) legacy_task
left join public.rebrand_workspaces workspace
  on workspace.branch_id = legacy.branch_id
left join public.project_tasks task
  on task.workspace_id = workspace.id
 and lower(task.title) = lower(coalesce(legacy_task->>'text', ''))
where legacy_task->>'text' is not null
order by legacy.branch_id, legacy_task->>'text';

-- Query C: find legacy records that still have no relational workspace.
select
  legacy.id as legacy_project_id,
  legacy.branch_id,
  legacy.branch,
  legacy.updated_at
from public.projects legacy
left join public.rebrand_workspaces workspace
  on workspace.branch_id = legacy.branch_id
where workspace.id is null
order by legacy.updated_at desc nulls last;

-- Query D: show the new structure for a workspace and its tasks/files.
-- Set selected_workspace.id to a known workspace UUID to filter one workspace;
-- leave it NULL to inspect all relational workspaces.
with selected_workspace(id) as (
  values (null::uuid)
)
select
  workspace.id as workspace_id,
  workspace.workspace_reference,
  branch.code as branch_code,
  branch.name as branch_name,
  stage.stage_number,
  stage.name as stage_name,
  task.id as task_id,
  task.title,
  task.status,
  task.priority,
  group_ref.name as responsible_group,
  person.name as responsible_person,
  task.due_date,
  task.required_action,
  task.waiting_reason,
  task.blocker_reason,
  count(file.id) filter (where file.deleted_at is null) as file_count
from public.rebrand_workspaces workspace
join public.branches branch on branch.id = workspace.branch_id
left join public.workflow_stages stage on stage.id = workspace.current_stage_id
left join public.project_tasks task on task.workspace_id = workspace.id and task.deleted_at is null
left join public.responsibility_groups group_ref on group_ref.id = task.responsible_group_id
left join public.profiles person on person.id = task.responsible_person_id
left join public.project_files file on file.task_id = task.id and file.deleted_at is null
cross join selected_workspace selected
where selected.id is null
   or workspace.id = selected.id
group by workspace.id, workspace.workspace_reference, branch.code, branch.name,
         stage.stage_number, stage.name, task.id, task.title, task.status,
         task.priority, group_ref.name, person.name, task.due_date,
         task.required_action, task.waiting_reason, task.blocker_reason,
         selected.id
order by task.sort_order;

commit;
