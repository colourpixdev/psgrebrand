import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { FileGrid } from '../components/uploads/FileGrid';
import { Timeline } from '../components/timeline/Timeline';
import { timelineStages } from '../constants/portal';
import { addProjectComment, addProjectTask, deleteProjectTask, getProjectById, getProjectFileUrl, updateProjectTask, updateProjectWorkflow, uploadProjectFile } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { can, canViewProject } from '../utils/permissions';
import type { Project, ProjectFile, ProjectStatus, ProjectStage, TaskItem } from '../types/domain';

const statusOptions: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'in_progress', label: 'In progress' },
  { value: 'awaiting_approval', label: 'Awaiting approval' },
  { value: 'completed', label: 'Completed' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<ProjectStage>('New Project');
  const [status, setStatus] = useState<ProjectStatus>('in_progress');
  const [progress, setProgress] = useState(0);
  const [commentMessage, setCommentMessage] = useState('');
  const [taskText, setTaskText] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectById(projectId ?? ''),
    enabled: Boolean(projectId),
  });

  useEffect(() => {
    if (project) {
      setStage(project.currentStage);
      setStatus(project.status);
      setProgress(project.progress);
    }
  }, [project]);

  const syncProject = async (updatedProject: Project) => {
    queryClient.setQueryData(['project', projectId], updatedProject);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
      queryClient.invalidateQueries({ queryKey: ['portal-summary'] }),
    ]);
  };

  const workflowMutation = useMutation({
    mutationFn: () => updateProjectWorkflow({
      projectId: projectId ?? '',
      currentStage: stage,
      status,
      progress,
      actor: user?.name ?? 'Portal user',
    }),
    onSuccess: syncProject,
  });

  const commentMutation = useMutation({
    mutationFn: () => addProjectComment({
      projectId: projectId ?? '',
      author: user?.name ?? 'Portal user',
      message: commentMessage,
    }),
    onSuccess: async (updatedProject) => {
      setCommentMessage('');
      await syncProject(updatedProject);
    },
  });

  const taskMutation = useMutation({
    mutationFn: () => addProjectTask({
      projectId: projectId ?? '',
      task: taskText,
      actor: user?.name ?? 'Portal user',
    }),
    onSuccess: async (updatedProject) => {
      setTaskText('');
      await syncProject(updatedProject);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ task, text, completed }: { task: TaskItem; text?: string; completed?: boolean }) => updateProjectTask({
      projectId: projectId ?? '',
      taskId: task.id,
      text,
      completed,
      actor: user?.name ?? 'Portal user',
    }),
    onSuccess: async (updatedProject) => {
      setEditingTaskId(null);
      setEditingTaskText('');
      await syncProject(updatedProject);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (task: TaskItem) => deleteProjectTask({
      projectId: projectId ?? '',
      taskId: task.id,
      actor: user?.name ?? 'Portal user',
    }),
    onSuccess: async (updatedProject) => {
      setEditingTaskId(null);
      setEditingTaskText('');
      await syncProject(updatedProject);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadProjectFile(projectId ?? '', file, project?.files ?? []),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]);
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (file: ProjectFile) => {
      const url = await getProjectFileUrl(file);
      if (!url) {
        return null;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Unable to download file.');
      }

      return { blob: await response.blob(), name: file.name };
    },
    onSuccess: (download) => {
      if (download) {
        const url = URL.createObjectURL(download.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = download.name;
        link.click();
        URL.revokeObjectURL(url);
      }
    },
  });

  const fileError = uploadMutation.error ?? downloadMutation.error;
  const workflowError = workflowMutation.error ?? commentMutation.error ?? taskMutation.error ?? updateTaskMutation.error ?? deleteTaskMutation.error;
  const canManageWorkflow = can(user, 'manage_workflow');
  const canUploadFiles = can(user, 'upload_files');
  const canAddComments = can(user, 'add_comments');
  const canAddTasks = can(user, 'add_tasks');

  if (isLoading) {
    return <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-soft">Loading project...</div>;
  }

  if (!project) {
    return <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-soft">No project data found in Supabase yet.</div>;
  }

  if (!canViewProject(user, project)) {
    return <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-soft">This project is not available for your role.</div>;
  }

  const selectedProject = project;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Project ID {selectedProject.id}</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">{selectedProject.branch}</h2>
        <p className="mt-2 text-sm text-slate-400">
          {selectedProject.town}, {selectedProject.province} · Manager {selectedProject.manager} · Installer {selectedProject.installer}
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-4 text-sm text-slate-300">
          <div>Current Status: <span className="text-white">{selectedProject.currentStage}</span></div>
          <div>Target Date: <span className="text-white">{selectedProject.targetDate}</span></div>
          <div>Installation Date: <span className="text-white">{selectedProject.installationDate}</span></div>
          <div>Completion Date: <span className="text-white">{selectedProject.completionDate}</span></div>
        </div>
      </section>

      <Timeline stages={timelineStages} activeStage={selectedProject.currentStage} />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
          <h3 className="text-lg font-semibold text-white">Workflow Actions</h3>
          <p className="mt-1 text-sm text-slate-400">Update the stage, status, and progress while keeping an activity trail.</p>
          {!canManageWorkflow ? <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">Your role can view this workflow but cannot update it.</p> : null}

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
              Stage
              <select value={stage} disabled={!canManageWorkflow} onChange={(event) => setStage(event.target.value as ProjectStage)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60">
                {timelineStages.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-slate-300">
              Status
              <select value={status} disabled={!canManageWorkflow} onChange={(event) => setStatus(event.target.value as ProjectStatus)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60">
                {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
              Progress
              <input type="range" min="0" max="100" value={progress} disabled={!canManageWorkflow} onChange={(event) => setProgress(Number(event.target.value))} className="accent-sky-400 disabled:cursor-not-allowed disabled:opacity-60" />
            </label>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white">{progress}% complete</div>
          </div>

          {workflowError instanceof Error ? <p className="mt-4 text-sm text-red-300">{workflowError.message}</p> : null}

          <button type="button" disabled={!canManageWorkflow || workflowMutation.isPending} onClick={() => workflowMutation.mutate()} className="mt-5 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60">
            {workflowMutation.isPending ? 'Updating workflow...' : 'Update workflow'}
          </button>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
          <h3 className="text-lg font-semibold text-white">Tasks</h3>
          <div className="mt-4 flex gap-3">
            <input value={taskText} disabled={!canAddTasks} onChange={(event) => setTaskText(event.target.value)} placeholder={canAddTasks ? 'Add next action...' : 'Task updates restricted'} className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60" />
            <button type="button" disabled={!canAddTasks || taskMutation.isPending || !taskText.trim()} onClick={() => taskMutation.mutate()} className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
              Add
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {selectedProject.tasks.length > 0 ? selectedProject.tasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
                {editingTaskId === task.id ? (
                  <div className="grid gap-3">
                    <input value={editingTaskText} onChange={(event) => setEditingTaskText(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/50" />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={updateTaskMutation.isPending || !editingTaskText.trim()} onClick={() => updateTaskMutation.mutate({ task, text: editingTaskText })} className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">Save</button>
                      <button type="button" onClick={() => { setEditingTaskId(null); setEditingTaskText(''); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <label className="flex min-w-0 flex-1 items-start gap-3">
                      <input type="checkbox" checked={task.completed} disabled={!canAddTasks || updateTaskMutation.isPending} onChange={(event) => updateTaskMutation.mutate({ task, completed: event.target.checked })} className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 accent-emerald-400 disabled:cursor-not-allowed disabled:opacity-50" />
                      <span className={task.completed ? 'text-slate-500 line-through' : 'text-slate-200'}>{task.text}</span>
                    </label>
                    {canAddTasks ? (
                      <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => { setEditingTaskId(task.id); setEditingTaskText(task.text); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">Edit</button>
                        <button type="button" disabled={deleteTaskMutation.isPending} onClick={() => deleteTaskMutation.mutate(task)} className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50">Delete</button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )) : <p className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-slate-400">No open tasks.</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <FileGrid
          files={selectedProject.files}
          isUploading={uploadMutation.isPending || downloadMutation.isPending}
          uploadError={fileError instanceof Error ? fileError.message : null}
          canUpload={canUploadFiles}
          onUpload={(file) => uploadMutation.mutate(file)}
          onDownload={(file: ProjectFile) => downloadMutation.mutate(file)}
        />
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-white">Notes</h3>
            <p className="mt-4 text-sm leading-6 text-slate-300">{selectedProject.notes}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-white">Project Activity</h3>
            <div className="mt-4 space-y-3">
              {selectedProject.activity.length > 0 ? selectedProject.activity.map((item) => (
                <div key={`${item.date}-${item.title}-${item.detail}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="shrink-0 text-xs text-slate-500">{item.date}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{item.detail}</p>
                </div>
              )) : <p className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-slate-400">No activity recorded yet.</p>}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-white">Communication Log</h3>
            <div className="mt-4 grid gap-3">
              <textarea value={commentMessage} disabled={!canAddComments} onChange={(event) => setCommentMessage(event.target.value)} rows={3} placeholder={canAddComments ? 'Add a project update...' : 'Commenting restricted'} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60" />
              <button type="button" disabled={!canAddComments || commentMutation.isPending || !commentMessage.trim()} onClick={() => commentMutation.mutate()} className="w-fit rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
                {commentMutation.isPending ? 'Adding comment...' : 'Add comment'}
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {selectedProject.comments.map((comment) => (
                <div key={`${comment.date}-${comment.author}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <p className="font-medium text-white">{comment.author}</p>
                    <p className="text-slate-500">{comment.date}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{comment.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
