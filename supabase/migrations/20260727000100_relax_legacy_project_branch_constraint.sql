-- Branch identity is enforced by projects.branch_id. The legacy display-name
-- column remains optional so older database/API schemas cannot reject creates.
alter table public.projects add column if not exists branch text;
alter table public.projects alter column branch drop not null;
