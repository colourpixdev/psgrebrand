create extension if not exists pgcrypto;

create table if not exists public.projects (
  id text primary key,
  province text not null,
  town text not null,
  branch text not null,
  manager text not null,
  manager_email text not null,
  installer text not null,
  designer text not null,
  current_stage text not null,
  status text not null check (status in ('completed', 'in_progress', 'awaiting_approval', 'delayed', 'on_hold', 'cancelled')),
  target_date text not null,
  installation_date text not null,
  completion_date text not null,
  updated_at timestamptz not null default now(),
  progress integer not null default 0 check (progress between 0 and 100),
  branch_manager_view_only boolean not null default false,
  notes text not null default '',
  files jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  activity jsonb not null default '[]'::jsonb
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  branch text,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.profiles enable row level security;

do $$
begin
  create policy "Public read access to projects"
    on public.projects
    for select
    to authenticated
    using (auth.role() = 'authenticated');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated insert projects"
    on public.projects
    for insert
    to authenticated
    with check (auth.role() = 'authenticated');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated update projects"
    on public.projects
    for update
    to authenticated
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated delete projects"
    on public.projects
    for delete
    to authenticated
    using (auth.role() = 'authenticated');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Public read access to profiles"
    on public.profiles
    for select
    to authenticated
    using (auth.role() = 'authenticated');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated insert profiles"
    on public.profiles
    for insert
    to authenticated
    with check (auth.role() = 'authenticated');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated update profiles"
    on public.profiles
    for update
    to authenticated
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Authenticated delete profiles"
    on public.profiles
    for delete
    to authenticated
    using (auth.role() = 'authenticated');
exception
  when duplicate_object then null;
end $$;

insert into public.projects (
  id,
  province,
  town,
  branch,
  manager,
  manager_email,
  installer,
  designer,
  current_stage,
  status,
  target_date,
  installation_date,
  completion_date,
  updated_at,
  progress,
  branch_manager_view_only,
  notes,
  files,
  tasks,
  comments,
  activity
)
values
  (
    'PSG-00123',
    'Western Cape',
    'Hermanus',
    'PSG Hermanus',
    'John Smith',
    'john.smith@psg.co.za',
    'ABC Signage',
    'Colourpix',
    'Production',
    'in_progress',
    '15 August',
    '22 August',
    '25 August',
    '2026-07-18T00:00:00Z',
    72,
    false,
    'Awaiting final print confirmation before booking install crew.',
    '["Artwork.pdf","Quotation.pdf","PO.pdf","Install Photos"]'::jsonb,
    '["Confirm artwork pack","Schedule install crew","Send reminder to branch manager"]'::jsonb,
    '[{"date":"15 July","author":"Francois","message":"Called installer. Waiting on measurements."},{"date":"17 July","author":"Installer","message":"Measurements uploaded."},{"date":"18 July","author":"PSG","message":"Artwork approved."}]'::jsonb,
    '[{"date":"Today","title":"Production in progress","detail":"Artwork pack released to print.","type":"info"},{"date":"Yesterday","title":"Approval received","detail":"PSG approved the final artwork.","type":"success"}]'::jsonb
  ),
  (
    'PSG-00124',
    'Western Cape',
    'Paarl',
    'PSG Paarl',
    'Mia van Rensburg',
    'mia.vanrensburg@psg.co.za',
    'Cape Installers',
    'Colourpix',
    'Awaiting Approval',
    'awaiting_approval',
    '19 August',
    '27 August',
    '29 August',
    '2026-07-17T00:00:00Z',
    56,
    false,
    'Artwork shared with PSG for signoff.',
    '["Artwork-v2.pdf","Measurements.xlsx"]'::jsonb,
    '["Approve artwork","Confirm PO status"]'::jsonb,
    '[{"date":"17 July","author":"Colourpix","message":"Artwork sent for approval."}]'::jsonb,
    '[{"date":"Today","title":"Awaiting approval","detail":"Branch signoff required before production.","type":"warning"}]'::jsonb
  ),
  (
    'PSG-00125',
    'KwaZulu-Natal',
    'Durban',
    'PSG Durban',
    'Sibusiso Dlamini',
    'sibusiso.dlamini@psg.co.za',
    'Durban Signs',
    'Colourpix',
    'Installation Scheduled',
    'in_progress',
    '21 August',
    '23 August',
    '24 August',
    '2026-07-16T00:00:00Z',
    81,
    false,
    'Install date locked and team notified.',
    '["Purchase-Order.pdf","Site-Photos.zip"]'::jsonb,
    '["Call installer","Send reminder email"]'::jsonb,
    '[{"date":"16 July","author":"Installer","message":"Measurements confirmed and crew booked."}]'::jsonb,
    '[{"date":"Today","title":"Installation scheduled","detail":"Reminder queued for tomorrow morning.","type":"success"}]'::jsonb
  ),
  (
    'PSG-00126',
    'Western Cape',
    'Mossel Bay',
    'PSG Mossel Bay',
    'Leah de Villiers',
    'leah.devilliers@psg.co.za',
    'Garden Route Branding',
    'Colourpix',
    'Delayed',
    'delayed',
    '12 August',
    'TBC',
    'TBC',
    '2026-07-15T00:00:00Z',
    43,
    false,
    'Measurements still outstanding from installer.',
    '["Site-Form.pdf"]'::jsonb,
    '["Chase measurements","Escalate delay"]'::jsonb,
    '[{"date":"15 July","author":"Francois","message":"Need measurements before artwork can proceed."}]'::jsonb,
    '[{"date":"Today","title":"Delayed","detail":"Waiting on site survey completion.","type":"warning"}]'::jsonb
  ),
  (
    'PSG-00127',
    'Namibia',
    'Windhoek',
    'PSG Windhoek',
    'Petra Haak',
    'petra.haak@psg.co.na',
    'Namibia Install Co',
    'Colourpix',
    'Completed',
    'completed',
    '30 July',
    '02 August',
    '03 August',
    '2026-07-13T00:00:00Z',
    100,
    false,
    'Project signed off and closed.',
    '["Signoff-Form.pdf","Final-Photos.jpg"]'::jsonb,
    '["Archive","Send completion report"]'::jsonb,
    '[{"date":"13 July","author":"PSG","message":"Final signoff received."}]'::jsonb,
    '[{"date":"Today","title":"Project completed","detail":"All deliverables uploaded and signed off.","type":"success"}]'::jsonb
  )
on conflict (id) do nothing;

insert into public.profiles (name, role, branch, email)
values
  ('Beverley', 'colourpix_admin', null, 'beverley@colourpix.co.za'),
  ('Francois', 'colourpix_admin', null, 'francois@colourpix.co.za'),
  ('PSG Head Office', 'psg_head_office', null, 'head.office@psg.co.za'),
  ('John Smith', 'psg_branch_manager', 'PSG Hermanus', 'john.smith@psg.co.za'),
  ('ABC Signage', 'sign_company', null, 'ops@abcsignage.co.za')
on conflict (email) do nothing;