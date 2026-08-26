begin;

drop policy if exists rebrand_project_files_internal_insert on storage.objects;
create policy rebrand_project_files_internal_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-files'
  and exists (
    select 1
    from public.projects project
    where project.id::text = split_part(storage.objects.name, '/', 1)
  )
  and exists (
    select 1
    from public.profiles profile
    where profile.user_id = (select auth.uid())
      and profile.role in ('colourpix_admin', 'colourpix_staff', 'psg_head_office')
  )
);

commit;
