begin;

create schema if not exists private;

revoke all on schema private from public;

create table if not exists private.project_id_counters (
	branch_code text primary key,
	next_number bigint not null check (next_number > 0)
);

alter table private.project_id_counters enable row level security;

with project_numbers as (
	select
		upper(btrim(coalesce(nullif(project.branch_code, ''), branch.code))) as branch_code,
		substring(
			project.id
			from length(upper(btrim(coalesce(nullif(project.branch_code, ''), branch.code)))) + 2
		)::bigint as project_number
	from public.projects project
	left join public.branches branch on branch.id = project.branch_id
	where project.id ~ '^PSG[0-9]+P[0-9]+$'
),
next_numbers as (
	select branch_code, max(project_number) + 1 as next_number
	from project_numbers
	where branch_code ~ '^PSG[0-9]+$'
	group by branch_code
)
insert into private.project_id_counters (branch_code, next_number)
select branch_code, next_number
from next_numbers
on conflict (branch_code) do update
set next_number = greatest(
	private.project_id_counters.next_number,
	excluded.next_number
);

create or replace function public.allocate_project_id(p_branch_code text)
returns text
language plpgsql
security definer
set search_path = public, private
as $$
declare
	normalized_branch_code text;
	allocated_number bigint;
begin
	if auth.uid() is null then
		raise exception 'Authentication required';
	end if;

	normalized_branch_code := upper(btrim(p_branch_code));

	if normalized_branch_code !~ '^PSG[0-9]+$' then
		raise exception 'Invalid branch code';
	end if;

	insert into private.project_id_counters (branch_code, next_number)
	values (normalized_branch_code, 1)
	on conflict (branch_code) do nothing;

	update private.project_id_counters
	set next_number = next_number + 1
	where branch_code = normalized_branch_code
	returning next_number - 1 into allocated_number;

	return normalized_branch_code || 'P' || allocated_number;
end;
$$;

revoke all on function public.allocate_project_id(text) from public;
grant execute on function public.allocate_project_id(text) to authenticated;

commit;
