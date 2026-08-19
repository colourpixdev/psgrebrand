-- Quick diagnostic: check what columns exist in public.projects
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'projects'
order by ordinal_position;
