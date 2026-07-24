create sequence if not exists public.branch_code_sequence start with 1;

alter table public.branches add column if not exists code text;
alter table public.branches add column if not exists city text;
alter table public.branches add column if not exists contacts jsonb not null default '[]'::jsonb;
alter table public.projects add column if not exists branch_code text;

with ordered_branches as (
	select id, row_number() over (order by created_at asc nulls last, lower(name), id) as position
	from public.branches
	where code is null or btrim(code) = ''
)
update public.branches branch
set code = 'PSG' || lpad(ordered_branches.position::text, 3, '0')
from ordered_branches
where branch.id = ordered_branches.id;

do $$
declare
	max_code_number bigint;
begin
	select coalesce(max(substring(code from '^PSG([0-9]+)$')::bigint), 0)
	into max_code_number
	from public.branches;

	if max_code_number > 0 then
		perform setval('public.branch_code_sequence', max_code_number, true);
	end if;
end $$;

alter table public.branches
	alter column code set default ('PSG' || lpad(nextval('public.branch_code_sequence')::text, 3, '0'));

update public.branches
set contacts = case
	when nullif(btrim(contact_name), '') is null then '[]'::jsonb
	else jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
		'name', contact_name,
		'email', nullif(btrim(contact_email), ''),
		'phone', nullif(btrim(contact_phone), ''),
		'designation', 'Branch Contact'
	)))
end
where case when jsonb_typeof(contacts) = 'array' then jsonb_array_length(contacts) = 0 else true end;

update public.projects project
set branch_code = branch.code
from public.branches branch
where project.branch_id = branch.id
	and (project.branch_code is null or btrim(project.branch_code) = '');

alter table public.branches alter column code set not null;

create unique index if not exists branches_code_key on public.branches (code);
create index if not exists projects_branch_code_idx on public.projects (branch_code);
