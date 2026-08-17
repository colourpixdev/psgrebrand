import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileText, Download, Eye } from 'lucide-react';
import { getAllBranches } from '../services/branchService';
import { addProjectComment, getProjectFileUrl, getProjects, renameProjectFile } from '../services/portalService';
import CurrentTaskCard from '../components/CurrentTaskCard';
import QuickUpdate from '../components/QuickUpdate/QuickUpdate';
import { useAuth } from '../contexts/AuthContext';
import { useSaveFeedback } from '../contexts/SaveFeedbackContext';
import { can, canAddTaskComments, getRolePolicy, filterProjectsForUser } from '../utils/permissions';
import { normalizeRole } from '../types/domain';
import { isPlatformOwnerEmail } from '../constants/workspaces';
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
  const navigate = useNavigate();
  const { showSuccess } = useSaveFeedback();

  const { data: branches = [], isLoading: isLoadingBranches } = useQuery({
    queryKey: ['branches'],
    queryFn: getAllBranches,
  });

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  const normalizedParam = String(branchId ?? '').trim();
  const decodedParam = decodeURIComponent(normalizedParam);
  const branch = branches.find((item) => item.id === normalizedParam)
    || branches.find((item) => item.code === normalizedParam)
    || branches.find((item) => encodeURIComponent(item.id) === normalizedParam)
    || branches.find((item) => typeof item.name === 'string' && item.name.toLowerCase() === decodedParam.toLowerCase());
  const canCreateProjects = can(user, 'create_project') || Boolean(user && (user.role === 'colourpix_admin' || isPlatformOwnerEmail(user.email)));
  const scopedProjects = filterProjectsForUser(projects, user);
  const branchProjects = useMemo(() => {
    if (!branch) {
      return [];
    }

    const branchName = branch.name ?? '';
    return scopedProjects
      .filter((project) => {
        const projectBranch = typeof project.branch === 'string' ? project.branch : '';
        return project.branchId === branch.id || projectBranch.toLowerCase() === branchName.toLowerCase();
      })
      .sort(byUpdatedAtDesc);
  }, [branch, scopedProjects]);

  const branchProject = branchProjects[0];
  const outstandingTasks = branchProjects.reduce((count, project) => count + project.tasks.filter(isTaskOutstanding).length, 0);
  const totalFiles = branchProjects.reduce((count, project) => count + project.files.length, 0);
  const branchFiles = useMemo(() => branchProjects.flatMap((project) => project.files), [branchProjects]);
  const branchLatestUpdates = useMemo(() => {
    return branchProjects
      .flatMap((project) => (project.comments ?? []).map((comment) => ({ project, comment })))
      .sort((a, b) => (b.comment.date ?? '').localeCompare(a.comment.date ?? ''))
      .slice(0, 4);
  }, [branchProjects]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [renamingFileKey, setRenamingFileKey] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [quickUpdateDrafts, setQuickUpdateDrafts] = useState<Record<string, { taskId: string; message: string }>>({});
  const [taskCommentDrafts, setTaskCommentDrafts] = useState<Record<string, string>>({});
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(() => {
    const initialCollapsed = new Set<string>();
    branchProjects.forEach((project) => {
      project.tasks.forEach((task) => {
        initialCollapsed.add(`${project.id}-${task.id}`);
      });
    });
    return initialCollapsed;
  });
  const thumbnailRequestedKeys = useRef(new Set<string>());
  const previousTaskIdsRef = useRef<Set<string>>(new Set());
  const collapsedTasksRef = useRef(collapsedTasks);
  const queryClient = useQueryClient();

  // Keep ref in sync with state to avoid stale closures
  useEffect(() => {
    collapsedTasksRef.current = collapsedTasks;
  }, [collapsedTasks]);

  const quickUpdateMutation = useMutation({
    mutationFn: ({ projectId, taskId, message }: { projectId: string; taskId: string; message: string }) => addProjectComment({
      projectId,
      author: user?.name ?? 'Workspace user',
      message,
      taskId: taskId || undefined,
    }),
    onSuccess: async (_, variables) => {
      setQuickUpdateDrafts((current) => ({
        ...current,
        [variables.projectId]: {
          taskId: '',
          message: '',
        },
      }));
      showSuccess('Quick update saved');
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });

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

  const taskCommentMutation = useMutation({
    mutationFn: ({ projectId, taskId, message }: { projectId: string; taskId: string; message: string }) => addProjectComment({
      projectId,
      author: user?.name ?? 'Workspace user',
      message,
      taskId: taskId || undefined,
    }),
    onSuccess: async (_, variables) => {
      setTaskCommentDrafts((current) => ({ ...current, [`${variables.projectId}-${variables.taskId}`]: '' }));
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['branches'] });
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

  useEffect(() => {
    // Track task IDs and preserve collapsed state when tasks change
    const currentTaskIds = new Set<string>();
    branchProjects.forEach((project) => {
      project.tasks.forEach((task) => {
        currentTaskIds.add(`${project.id}-${task.id}`);
      });
    });

    // Only update if tasks actually changed
    if (previousTaskIdsRef.current.size === 0) {
      // First mount: initialize with all tasks collapsed
      previousTaskIdsRef.current = currentTaskIds;
      return;
    }

    const previousIds = previousTaskIdsRef.current;
    const hasTaskChanges = currentTaskIds.size !== previousIds.size || 
      [...currentTaskIds].some(id => !previousIds.has(id));

    if (!hasTaskChanges) {
      return; // No changes, skip state update
    }

    // Add new tasks as collapsed, preserve user's expansion choices
    setCollapsedTasks((prev) => {
      const next = new Set<string>();
      
      // Keep all previously collapsed tasks that still exist
      prev.forEach((taskId) => {
        if (currentTaskIds.has(taskId)) {
          next.add(taskId);
        }
      });
      
      // Add any truly new tasks as collapsed
      currentTaskIds.forEach((taskId) => {
        if (!previousIds.has(taskId)) {
          next.add(taskId);
        }
      });
      
      return next;
    });

    previousTaskIdsRef.current = currentTaskIds;
  }, [branchProjects]);

  // Memoized callback for toggling accordion
  const toggleTaskAccordion = useCallback((taskId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    setCollapsedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

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
        <div className="grid gap-6">
          <div className="space-y-6">
            <div>
              <div className="mb-3">
                <Link to="/branches" className="text-sm font-semibold text-sky-200 transition hover:text-sky-100">← Back to branches</Link>
              </div>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">{branch.name}</h2>
              <p className="mt-2 text-sm text-slate-400">{branch.town}, {branch.province}</p>
              <p className="mt-2 text-sm text-slate-300">{branch.physicalAddress}</p>
            </div>

            {branchParticipants.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-blue-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-white">Contact persons</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {branchParticipants.slice(0, 4).map((p, i) => (
                    <div key={`${p.email ?? p.name}-${i}`} className="rounded-2xl border border-white/10 bg-blue-900/50 p-4">
                      <p className="font-semibold text-white">{p.name}</p>
                      {p.designation ? <p className="mt-1 text-xs text-white">{p.designation}</p> : null}
                      {p.phone ? (
                        <p className="mt-2 text-xs text-white">
                          <a href={formatPhoneHref(p.phone)} className="hover:text-sky-300">{p.phone}</a>
                        </p>
                      ) : null}
                      {p.email ? (
                        <p className="mt-1 text-xs text-white">
                          <a href={`mailto:${p.email}`} className="hover:text-sky-300">{p.email}</a>
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Contact persons shown in header above; section removed to avoid duplication */}

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">Branch rebrand updates</h3>
          <div className="flex flex-wrap gap-2">
            {canCreateProjects ? (
              <Link to={`/projects?branchId=${encodeURIComponent(branch.id)}`} className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">Add project</Link>
            ) : null}
          </div>
        </div>

        {branchLatestUpdates.length > 0 ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {branchLatestUpdates.map(({ project, comment }, index) => (
              <div key={`${project.id}-update-${index}-${comment.taskId ?? 'general'}`} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{project.branch}</p>
                <p className="mt-2 text-sm font-semibold text-white">{comment.author}</p>
                <p className="mt-1 text-sm text-slate-300 line-clamp-3">{comment.message}</p>
                <p className="mt-3 text-xs text-slate-500">{comment.date || 'Unknown date'}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-slate-900/60 p-4 text-sm text-slate-300">
            No recent branch updates yet. Use the quick update form below to capture progress instantly.
          </div>
        )}

        <div className="mt-4 space-y-4">
          {branchProjects.length > 0 ? branchProjects.map((project) => {
            const participants = projectParticipants(project);
            const pendingTasks = project.tasks.filter((task) => !task.completed);
            const latestUpdates = [...project.comments].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 5);
            const latestActivity = filterActivityExcludingUser([...project.activity], user?.name)
              .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 5);

            return (
              <article key={project.id} className="rounded-2xl border border-white/10 bg-slate-950/90 p-5 shadow-soft">
                {(() => {
                  const isSpecialBranch = project.branch === 'PSG Jan Kemp Dorp Wealth';
                  const isAdmin = user && (user.role === 'colourpix_admin' || isPlatformOwnerEmail(user.email));
                  const shouldShow = !isSpecialBranch || isAdmin;

                  return shouldShow ? (
                    <div className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-base font-semibold text-white">{project.branch}</p>
                        <p className="mt-1 text-sm text-slate-300">{project.currentStage} · {project.status.replace('_', ' ')}</p>
                        <p className="mt-1 text-xs text-slate-400">Target {project.targetDate || 'Not set'} · Updated {project.updatedAt || 'Unknown'}</p>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {(() => {
                          const policy = getRolePolicy(user);
                          const canEditProject = Boolean(user && (user.role === 'colourpix_admin' || isPlatformOwnerEmail(user.email))) || Boolean(policy && (
                            policy.projectAccess.canCreateProjects ||
                            policy.projectAccess.canArchiveProjects ||
                            policy.projectAccess.canDeleteProjects ||
                            policy.projectAccess.canDuplicateProject ||
                            policy.workflow.canChangeStage ||
                            policy.workflow.canChangeStatus ||
                            policy.workflow.canChangeProgress ||
                            policy.workflow.canChangeTargetDates ||
                            policy.communication.canCreateComments ||
                            policy.tasks.canCreateTasks
                          ));
                          
                          return canEditProject ? (
                            <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}`); }} className="inline-flex items-center justify-center rounded-xl border border-sky-300/35 bg-sky-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sky-100 transition hover:bg-sky-400/25 cursor-pointer">Edit branch project</button>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  ) : null;
                })()}

                {(() => {
                  const policy = getRolePolicy(user);
                  const canQuickUpdate = policy && (policy.communication.canCreateComments || policy.tasks.canCreateTasks);
                  
                  return canQuickUpdate ? (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">Quick update</p>
                          <p className="text-xs text-white">Leave a short task update for this project.</p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white">Fast entry</span>
                      </div>
                      <QuickUpdate
                        project={project}
                        canSave={!quickUpdateMutation.isPending}
                        onSave={(taskId, message) => quickUpdateMutation.mutate({ projectId: project.id, taskId: taskId ?? '', message })}
                      />
                    </div>
                  ) : null;
                })()}

                {project.branch !== 'PSG Jan Kemp Dorp Wealth' ? (
                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Assigned participants</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-200">
                        {participants.length > 0 ? participants.map((participant, index) => (
                          <p key={`${project.id}-${participant.email ?? participant.name ?? index}`}>{participant.name} · {participant.designation}</p>
                        )) : <p className="text-slate-400">No participants assigned yet.</p>}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Pending tasks</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-200">
                        {pendingTasks.length > 0 ? pendingTasks.slice(0, 5).map((task) => (
                          <p key={`${project.id}-${task.id}`}>{task.text}</p>
                        )) : <p className="text-slate-400">No pending tasks.</p>}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 border-t border-white/10 pt-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">All tasks</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-200">
                    {project.tasks.length > 0 ? project.tasks.map((task) => {
                      const taskFiles = project.files.filter((file) => file.taskId === task.id);
                      const taskKey = `${project.id}-${task.id}`;
                      const taskComments = (project.comments ?? []).filter((c) => c.taskId === task.id).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
                      const taskId = `${project.id}-${task.id}`;
                      const isExpanded = !collapsedTasks.has(taskId);
                      return (
                        <div key={taskId} className="rounded-2xl border border-white/10 bg-slate-950/50 overflow-hidden">
                          <button
                            type="button"
                            onClick={(e) => toggleTaskAccordion(taskId, e)}
                            className="w-full px-4 py-3 text-sm text-slate-200 hover:bg-slate-900/40 transition text-left focus:outline-none focus:ring-2 focus:ring-sky-400/50 rounded-2xl"
                            aria-label={isExpanded ? 'Collapse task' : 'Expand task'}
                            aria-expanded={isExpanded}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="shrink-0 text-slate-400">{isExpanded ? '▼' : '▶'}</span>
                                <span className={`truncate ${task.completed ? 'text-slate-500 line-through' : 'text-slate-200 font-medium'}`}>{task.text}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 text-xs text-slate-500">
                                <span className="rounded-full bg-white/5 px-2 py-1">{task.completed ? 'Done' : (task.status ?? 'Open')}</span>
                                <span>·</span>
                                <span>{taskComments.length} comment{taskComments.length === 1 ? '' : 's'}</span>
                                <span>·</span>
                                <span>{taskFiles.length} file{taskFiles.length === 1 ? '' : 's'}</span>
                              </div>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="border-t border-white/10 px-4 py-3 text-sm text-slate-200 space-y-3">
                              {taskFiles.length > 0 ? (
                                <div className="space-y-3">
                                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Attached files</p>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                {taskFiles.map((file) => {
                                  const key = file.path ?? file.name;
                                  const thumbnailUrl = thumbnails[key];
                                  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                                  const isPreviewable = canPreviewFile(file);

                                  return (
                                    <div key={`${project.id}-${task.id}-${key}`} className="rounded-2xl bg-slate-950/70 p-3">
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
                                          <button type="button" onClick={(e) => { e.stopPropagation(); previewMutation.mutate(file); }} className="text-xs font-semibold text-sky-200 transition hover:text-sky-100">
                                            <Eye className="mr-1 inline h-3.5 w-3.5" /> Preview
                                          </button>
                                        ) : null}
                                        <button type="button" onClick={(e) => { e.stopPropagation(); downloadMutation.mutate(file); }} className="text-xs font-semibold text-sky-200 transition hover:text-sky-100">
                                          <Download className="mr-1 inline h-3.5 w-3.5" /> Download
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setRenamingFileKey(key); setRenameDraft(file.name); }}
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
                                              onClick={(e) => { e.stopPropagation(); renameFileMutation.mutate({ file, nextName: renameDraft }); setRenamingFileKey(null); }}
                                              className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                              Save
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); setRenamingFileKey(null); }}
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
                              {normalizeRole(user?.role) !== 'psg_user' ? (
                                <div>
                                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Comments</p>
                                  <div className="mt-2 space-y-2">
                                    {taskComments.length > 0 ? taskComments.map((c, i) => (
                                      <div key={`${taskKey}-comment-${i}-${c.taskId ?? 'general'}`} className="rounded-2xl bg-slate-950/80 p-3">
                                        <p className="text-xs text-slate-400">{c.date}</p>
                                        <p className="mt-1 font-medium text-white">{c.author}</p>
                                        <p className="mt-1 text-slate-300">{c.message}</p>
                                      </div>
                                    )) : <p className="text-slate-400">No comments yet.</p>}
                                  </div>

                                  {/* Add comment */}
                                  {canAddTaskComments(user) ? (
                                  <div className="mt-3 grid gap-2">
                                <textarea
                                  value={taskCommentDrafts[taskKey] ?? ''}
                                  onChange={(e) => setTaskCommentDrafts((cur) => ({ ...cur, [taskKey]: e.target.value }))}
                                  rows={2}
                                  placeholder="Leave a comment for this task"
                                  className="rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-300 focus:border-sky-400/50"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={!taskCommentDrafts[taskKey]?.trim() || taskCommentMutation.isPending}
                                    onClick={(e) => { e.stopPropagation(); taskCommentMutation.mutate({ projectId: project.id, taskId: task.id, message: taskCommentDrafts[taskKey] ?? '' }); }}
                                    className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {taskCommentMutation.isPending ? 'Posting...' : 'Add comment'}
                                  </button>
                                  <p className="text-xs text-slate-400">Comments appear in the project journal and under the task.</p>
                                </div>
                              </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    }) : <p className="text-slate-400">No tasks added yet.</p>}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-950/70 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Latest updates</p>
                    <div className="mt-3 space-y-2 text-sm text-slate-200">
                      {latestUpdates.length > 0 ? latestUpdates.map((item, index) => (
                        <div key={`${project.id}-${item.author}-${item.date}-${index}`} className="rounded-2xl bg-slate-950/80 px-3 py-2">
                          <p className="text-xs text-slate-400">{item.date}</p>
                          <p className="mt-1 font-medium text-white">{item.author}</p>
                          <p className="mt-1 text-slate-300">{item.message}</p>
                        </div>
                      )) : <p className="text-slate-400">No updates captured yet.</p>}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-950/70 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Latest activity</p>
                    <div className="mt-3 space-y-2 text-sm text-slate-200">
                      {latestActivity.length > 0 ? latestActivity.map((item, index) => (
                        <div key={`${project.id}-${item.title}-${item.date}-${index}`} className="rounded-2xl bg-slate-950/80 px-3 py-2">
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
