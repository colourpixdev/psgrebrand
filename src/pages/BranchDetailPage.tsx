import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { FileText, Download, Eye } from 'lucide-react';
import { getAllBranches } from '../services/branchService';
import { getProjectFileUrl, getProjects, renameProjectFile } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { can, filterProjectsForUser } from '../utils/permissions';
import { filterActivityExcludingUser } from '../utils/activityFilter';
import { isTaskOutstanding } from '../utils/taskStatus';
import type { Project, ProjectFile, TaskAssignee } from '../types/domain';

function canPreviewFile(file: ProjectFile) {
  const fileType = file.type ?? '';
  const fileName = file.name.toLowerCase();

  return fileType.startsWith('image/') || fileType === 'application/pdf' || fileName.endsWith('.pdf');
}

function isPreviewThumbnailCandidate(file: ProjectFile) {
  const fileType = file.type ?? '';
  const fileName = file.name.toLowerCase();

  return fileType.startsWith('image/') || fileType === 'application/pdf' || fileName.endsWith('.pdf');
}

function formatPhoneHref(phone: string) {
  const normalized = phone.replace(/[^+\d]/g, '');
  return `tel:${normalized}`;
}

function byUpdatedAtDesc(a: Project, b: Project) {
  return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
}

function projectParticipants(project: Project) {
  const participants = new Map<string, TaskAssignee>();

  project.tasks.forEach((task) => {
    task.assignees?.forEach((assignee) => {
      participants.set(assignee.email.toLowerCase(), assignee);
    });

    if (task.assigneeEmail && task.assigneeName) {
      const key = task.assigneeEmail.toLowerCase();
      if (!participants.has(key)) {
        participants.set(key, {
          name: task.assigneeName,
          email: task.assigneeEmail,
          designation: 'Participant',
        });
      }
    }
  });

  return [...participants.values()];
}

export function BranchDetailPage() {
  const { branchId } = useParams();
  const { user } = useAuth();

  const { data: branches = [], isLoading: isLoadingBranches } = useQuery({
    queryKey: ['branches'],
    queryFn: getAllBranches,
  });

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  const normalizedParam = branchId ?? '';
  const branch = branches.find((item) => item.id === normalizedParam)
    || branches.find((item) => item.code === normalizedParam)
    || branches.find((item) => encodeURIComponent(item.id) === normalizedParam)
    || branches.find((item) => item.name?.toLowerCase() === decodeURIComponent(normalizedParam).toLowerCase());
  const canCreateProjects = can(user, 'create_project');
  const scopedProjects = filterProjectsForUser(projects, user);
  const branchProjects = useMemo(() => {
    if (!branch) {
      return [];
    }

    return scopedProjects
      .filter((project) => project.branchId === branch.id || project.branch.toLowerCase() === branch.name.toLowerCase())
      .sort(byUpdatedAtDesc);
  }, [branch, scopedProjects]);

  const branchProject = branchProjects[0];
  const outstandingTasks = branchProjects.reduce((count, project) => count + project.tasks.filter(isTaskOutstanding).length, 0);
  const totalFiles = branchProjects.reduce((count, project) => count + project.files.length, 0);
  const branchFiles = useMemo(() => branchProjects.flatMap((project) => project.files), [branchProjects]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [renamingFileKey, setRenamingFileKey] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const thumbnailRequestedKeys = useRef(new Set<string>());
  const queryClient = useQueryClient();

  const renameFileMutation = useMutation({
    mutationFn: ({ file, nextName }: { file: ProjectFile; nextName: string }) => renameProjectFile({
      projectId: branchProject?.id ?? '',
      filePath: file.path,
      currentName: file.name,
      nextName,
      actor: user?.name ?? 'Workspace user',
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      setRenamingFileKey(null);
    },
  });

  const previewMutation = useMutation({
    mutationFn: (file: ProjectFile) => getProjectFileUrl(file),
    onSuccess: (url) => {
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (file: ProjectFile) => {
      const url = await getProjectFileUrl(file, { download: true });
      if (!url) {
        return null;
      }

      return { url, name: file.name };
    },
    onSuccess: (download) => {
      if (download) {
        const link = document.createElement('a');
        link.href = download.url;
        link.download = download.name;
        link.rel = 'noreferrer';
        link.click();
      }
    },
  });

  useEffect(() => {
    branchFiles.forEach((file) => {
      const key = file.path ?? file.name;
      const isThumbnailCandidate = isPreviewThumbnailCandidate(file);

      if (!file.path || !isThumbnailCandidate || thumbnails[key] || thumbnailRequestedKeys.current.has(key)) {
        return;
      }

      thumbnailRequestedKeys.current.add(key);
      getProjectFileUrl(file).then((url) => {
        if (url) {
          setThumbnails((current) => ({ ...current, [key]: url }));
        }
      }).catch(() => {
        thumbnailRequestedKeys.current.delete(key);
      });
    });
  }, [branchFiles, thumbnails]);

  if (isLoadingBranches || isLoadingProjects) {
    return <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-soft">Loading branch workspace...</div>;
  }

  if (!branch) {
    return <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-soft">Branch not found.</div>;
  }

  const branchParticipants = branch.contacts?.length
    ? branch.contacts
    : branch.contactName
      ? [{
        name: branch.contactName,
        email: branch.contactEmail,
        phone: branch.contactPhone,
        designation: 'Contact Person',
      }]
      : [];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3">
              <Link to="/branches" className="text-sm font-semibold text-sky-200 transition hover:text-sky-100">← Back to branches</Link>
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-white">{branch.name}</h2>
            <p className="mt-2 text-sm text-slate-400">{branch.town}, {branch.province}</p>
            <p className="mt-2 text-sm text-slate-300">{branch.physicalAddress}</p>
          </div>
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-200">
            <p>Rebrand records: <span className="text-white">{branchProjects.length}</span></p>
            <p>Outstanding tasks: <span className="text-white">{outstandingTasks}</span></p>
            <p>Files: <span className="text-white">{totalFiles}</span></p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">Contact persons</h3>
        </div>
        {branchParticipants.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {branchParticipants.map((participant, index) => (
              <div key={`${participant.email ?? participant.name}-${index}`} className="border-l-2 border-sky-400/50 pl-3">
                <p className="font-medium text-white">{participant.name}</p>
                <p className="mt-1 text-sm text-slate-400">{participant.designation}</p>
                {participant.phone ? (
                  <p className="mt-2 text-xs text-slate-400">
                    <a href={formatPhoneHref(participant.phone)} className="hover:text-white">
                      {participant.phone}
                    </a>
                  </p>
                ) : null}
                {participant.email ? (
                  <p className="mt-1 text-xs text-slate-400">
                    <a href={`mailto:${participant.email}`} className="hover:text-white">
                      {participant.email}
                    </a>
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-400">No contact persons have been added yet.</p>
            <Link
              to={`/branches?editBranch=${branch.id}#branch-${branch.id}`}
              className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              Add contact person
            </Link>
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">Branch rebrand updates</h3>
          <div className="flex flex-wrap gap-2">
            {canCreateProjects ? (
              <Link to={`/projects?branchId=${encodeURIComponent(branch.id)}`} className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">Add project</Link>
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {branchProjects.length > 0 ? branchProjects.map((project) => {
            const participants = projectParticipants(project);
            const pendingTasks = project.tasks.filter((task) => !task.completed);
            const latestUpdates = [...project.comments].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 5);
            const latestActivity = filterActivityExcludingUser([...project.activity], user?.name)
              .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 5);

            return (
              <article key={project.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">{project.branch}</p>
                    <p className="mt-1 text-sm text-slate-300">{project.currentStage} · {project.status.replace('_', ' ')}</p>
                    <p className="mt-1 text-xs text-slate-400">Target {project.targetDate || 'Not set'} · Updated {project.updatedAt || 'Unknown'}</p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link to={`/projects/${project.id}`} className="inline-flex items-center justify-center rounded-xl border border-sky-300/35 bg-sky-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sky-100 transition hover:bg-sky-400/25">Edit branch project</Link>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Assigned participants</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-200">
                      {participants.length > 0 ? participants.map((participant) => (
                        <p key={`${project.id}-${participant.email}`}>{participant.name} · {participant.designation}</p>
                      )) : <p className="text-slate-400">No participants assigned yet.</p>}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Pending tasks</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-200">
                      {pendingTasks.length > 0 ? pendingTasks.slice(0, 5).map((task) => (
                        <p key={`${project.id}-${task.id}`}>{task.text}</p>
                      )) : <p className="text-slate-400">No pending tasks.</p>}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">All tasks</p>
                  <div className="mt-2 space-y-3 text-sm text-slate-200">
                    {project.tasks.length > 0 ? project.tasks.map((task) => {
                      const taskFiles = project.files.filter((file) => file.taskId === task.id);
                      return (
                        <div key={`${project.id}-${task.id}`} className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className={task.completed ? 'text-slate-500 line-through' : 'text-slate-200'}>{task.text}</p>
                            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-300">{task.completed ? 'Done' : (task.status ?? 'Open')}</span>
                          </div>
                          {taskFiles.length > 0 ? (
                            <div className="mt-3 space-y-3 rounded-xl border border-slate-700/80 bg-slate-950/80 p-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Attached files</p>
                              <div className="grid gap-3 sm:grid-cols-2">
                                {taskFiles.map((file) => {
                                  const key = file.path ?? file.name;
                                  const thumbnailUrl = thumbnails[key];
                                  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                                  const isPreviewable = canPreviewFile(file);

                                  return (
                                    <div key={`${project.id}-${task.id}-${key}`} className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                                      {thumbnailUrl && !isPdf ? (
                                        <img src={thumbnailUrl} alt={file.name} className="mb-3 h-28 w-full rounded-xl object-cover" />
                                      ) : (
                                        <div className="mb-3 flex h-28 items-center justify-center rounded-xl bg-slate-900/70 text-slate-400">
                                          <div className="flex flex-col items-center gap-2 text-center">
                                            <FileText className="h-8 w-8" />
                                            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{isPdf ? 'PDF File' : 'Preview unavailable'}</span>
                                          </div>
                                        </div>
                                      )}
                                      <p className="truncate font-medium text-white">{file.name}</p>
                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        {isPreviewable ? (
                                          <button type="button" onClick={() => previewMutation.mutate(file)} className="text-xs font-semibold text-sky-200 transition hover:text-sky-100">
                                            <Eye className="mr-1 inline h-3.5 w-3.5" /> Preview
                                          </button>
                                        ) : null}
                                        <button type="button" onClick={() => downloadMutation.mutate(file)} className="text-xs font-semibold text-sky-200 transition hover:text-sky-100">
                                          <Download className="mr-1 inline h-3.5 w-3.5" /> Download
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setRenamingFileKey(key);
                                            setRenameDraft(file.name);
                                          }}
                                          className="text-xs font-semibold text-sky-200 transition hover:text-sky-100"
                                        >
                                          Rename
                                        </button>
                                      </div>
                                      {renamingFileKey === key ? (
                                        <div className="mt-3 grid gap-2">
                                          <input
                                            value={renameDraft}
                                            onChange={(event) => setRenameDraft(event.target.value)}
                                            className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-white outline-none focus:border-sky-400/50"
                                          />
                                          <div className="flex gap-2">
                                            <button
                                              type="button"
                                              disabled={!renameDraft.trim()}
                                              onClick={() => {
                                                renameFileMutation.mutate({ file, nextName: renameDraft });
                                                setRenamingFileKey(null);
                                              }}
                                              className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                              Save
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setRenamingFileKey(null)}
                                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    }) : <p className="text-slate-400">No tasks added yet.</p>}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Latest updates</p>
                    <div className="mt-2 space-y-2 text-sm text-slate-200">
                      {latestUpdates.length > 0 ? latestUpdates.map((item, index) => (
                        <div key={`${project.id}-${item.author}-${item.date}-${index}`} className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2">
                          <p className="text-xs text-slate-400">{item.date}</p>
                          <p className="mt-1 font-medium text-white">{item.author}</p>
                          <p className="mt-1 text-slate-300">{item.message}</p>
                        </div>
                      )) : <p className="text-slate-400">No updates captured yet.</p>}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Latest activity</p>
                    <div className="mt-2 space-y-2 text-sm text-slate-200">
                      {latestActivity.length > 0 ? latestActivity.map((item, index) => (
                        <div key={`${project.id}-${item.title}-${item.date}-${index}`} className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2">
                          <p className="text-xs text-slate-400">{item.date}</p>
                          <p className="mt-1 font-medium text-white">{item.title}</p>
                          <p className="mt-1 text-slate-300">{item.detail}</p>
                        </div>
                      )) : <p className="text-slate-400">No activity recorded yet.</p>}
                    </div>
                  </div>
                </div>
              </article>
            );
          }) : <p className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-slate-400">No projects are linked to this branch yet.</p>}
        </div>
      </section>
    </div>
  );
}
