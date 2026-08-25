begin;

-- All authenticated users may view staged files and their versions.
-- Upload, replacement, deletion, and project mutation policies remain unchanged.
drop policy if exists rebrand_project_files_psg_read on public.project_files;
create policy rebrand_project_files_authenticated_read
on public.project_files for select to authenticated
using (true);

drop policy if exists rebrand_file_versions_psg_read on public.file_versions;
create policy rebrand_file_versions_authenticated_read
on public.file_versions for select to authenticated
using (true);

drop policy if exists "Authenticated read project files" on storage.objects;
create policy "Authenticated read project files"
on storage.objects for select to authenticated
using (bucket_id = 'project-files');

commit;
