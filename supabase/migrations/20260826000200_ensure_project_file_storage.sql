begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-files',
  'project-files',
  false,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/postscript',
    'application/illustrator',
    'application/acad',
    'application/x-acad',
    'application/autocad_dwg',
    'application/x-dwg',
    'drawing/x-dwg',
    'image/vnd.dwg',
    'image/x-dwg',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists rebrand_project_files_storage_read on storage.objects;
create policy rebrand_project_files_storage_read
on storage.objects for select to authenticated
using (
  bucket_id = 'project-files'
  and exists (
    select 1
    from public.project_files file_record
    join public.file_versions version_record on version_record.file_id = file_record.id
    where version_record.storage_path = storage.objects.name
  )
);

drop policy if exists rebrand_project_files_internal_insert on storage.objects;
create policy rebrand_project_files_internal_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-files'
  and exists (
    select 1
    from public.projects project
    join public.profiles profile on profile.user_id = (select auth.uid())
    where project.id::text = split_part(storage.objects.name, '/', 1)
      and profile.role in ('colourpix_admin', 'psg_head_office')
  )
);

drop policy if exists rebrand_project_files_internal_delete on storage.objects;
create policy rebrand_project_files_internal_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'project-files'
  and exists (
    select 1
    from public.profiles profile
    where profile.user_id = (select auth.uid())
      and profile.role in ('colourpix_admin', 'psg_head_office')
  )
);

commit;