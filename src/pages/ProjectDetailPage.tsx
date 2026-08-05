import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileGrid } from '../components/uploads/FileGrid';
import { Timeline } from '../components/timeline/Timeline';
import { roleLabels, timelineStages } from '../constants/portal';
import { addProjectComment, addProjectTask, answerProjectQuestion, askProjectQuestion, deleteProject, deleteProjectFile, deleteProjectTask, getProjectById, getProjectFileUrl, markProjectQuestionRead, renameProjectFile, updateProjectNotes, updateProjectTask, updateProjectWorkflow, uploadProjectFile, upsertProjectStageTask } from '../services/portalService';
import { getBranchById } from '../services/branchService';
import { getUsers } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import { canViewProject, getRolePolicy } from '../utils/permissions';
import type { CommentItem, Project, ProjectFile, ProjectStatus, ProjectStage, TaskAssignee, TaskItem } from '../types/domain';

const statusOptions: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'busy', label: 'Busy' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'awaiting_approval', label: 'Awaiting approval' },
  { value: 'completed', label: 'Completed' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'cancelled', label: 'Cancelled' },
];

type ProjectSectionId = 'timeline' | 'journal' | 'files' | 'notes';

const projectSections: Array<{ id: ProjectSectionId; number: string; label: string }> = [
  { id: 'timeline', number: '01', label: 'Timeline and tasks' },
  { id: 'journal', number: '02', label: 'Journal' },
  { id: 'files', number: '03', label: 'Files' },
  { id: 'notes', number: '04', label: 'Notes' },
];

function getStagePlan(project: Project): ProjectStage[] {
  const stageTasks = project.tasks.filter((task) => Boolean(task.stage));
  return stageTasks.length > 0 ? stageTasks.map((task) => task.stage as ProjectStage) : [...timelineStages];
}

function deriveWorkflowFromStagePlan(project: Project, stagePlan: readonly ProjectStage[]) {
  const completedStages = new Set<ProjectStage>();
  stagePlan.forEach((timelineStage) => {
    const stageTask = project.tasks.find((task) => task.stage === timelineStage);
    if (stageTask?.completed) {
      completedStages.add(timelineStage);
    }
  });

  const completedCount = stagePlan.filter((timelineStage) => completedStages.has(timelineStage)).length;
  const currentStage = stagePlan.find((timelineStage) => !completedStages.has(timelineStage)) ?? stagePlan[stagePlan.length - 1] ?? project.currentStage;
  const status: ProjectStatus = stagePlan.length > 0 && completedCount === stagePlan.length
    ? 'completed'
    : currentStage === 'Awaiting Approval'
      ? 'awaiting_approval'
      : 'busy';

  return {
    currentStage,
    status,
    progress: stagePlan.length > 0 ? Math.round((completedCount / stagePlan.length) * 100) : project.progress,
  };
}

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeProjectSection, setActiveProjectSection] = useState<ProjectSectionId>('timeline');
  const [commentMessage, setCommentMessage] = useState('');
  const [journalTaskId, setJournalTaskId] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [questionMessage, setQuestionMessage] = useState('');
  const [questionTaskId, setQuestionTaskId] = useState('');
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  const [answerMessage, setAnswerMessage] = useState('');
  const [answerStage, setAnswerStage] = useState<ProjectStage>('New Project');
  const [answerStatus, setAnswerStatus] = useState<ProjectStatus>('in_progress');
  const [answerProgress, setAnswerProgress] = useState(0);
  const [answerTargetDate, setAnswerTargetDate] = useState('');
  const [answerInstallationDate, setAnswerInstallationDate] = useState('');
  const [taskText, setTaskText] = useState('');
  const [taskAssigneeEmails, setTaskAssigneeEmails] = useState<string[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [editingTaskAssigneeEmails, setEditingTaskAssigneeEmails] = useState<string[]>([]);
  const [deleteConfirmationArmed, setDeleteConfirmationArmed] = useState(false);
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectById(projectId ?? ''),
    enabled: Boolean(projectId),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  });
  const { data: branch } = useQuery({
    queryKey: ['branch', project?.branchId],
    queryFn: () => getBranchById(project?.branchId ?? ''),
    enabled: Boolean(project?.branchId),
  });

  function getAssignee(email: string) {
    return users.find((item) => item.email.toLowerCase() === email.toLowerCase());
  }

  function buildTaskAssignees(emails: string[]): TaskAssignee[] {
    return emails
      .map((email) => getAssignee(email) ?? (email.toLowerCase() === user?.email.toLowerCase() && user ? user : undefined))
      .filter((assignee): assignee is NonNullable<typeof assignee> => Boolean(assignee))
      .map((assignee) => ({
        name: assignee.name,
        email: assignee.email,
        designation: assignee.profileTitle?.trim() || roleLabels[assignee.role],
      }));
  }

  useEffect(() => {
    if (project) {
      setNotesDraft(project.notes);
    }
  }, [project]);

  const syncProject = async (updatedProject: Project) => {
    queryClient.setQueryData(['project', projectId], updatedProject);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
      queryClient.invalidateQueries({ queryKey: ['portal-summary'] }),
    ]);
  };

  const taskUpdateMutation = useMutation({
    mutationFn: () => addProjectComment({
      projectId: projectId ?? '',
      author: user?.name ?? 'Workspace user',
      message: commentMessage,
      taskId: journalTaskId || undefined,
    }),
    onSuccess: async (updatedProject) => {
      setCommentMessage('');
      setJournalTaskId('');
      await syncProject(updatedProject);
    },
  });

  const notesMutation = useMutation({
    mutationFn: () => updateProjectNotes({
      projectId: projectId ?? '',
      actor: user?.name ?? 'Workspace user',
      notes: notesDraft,
    }),
    onSuccess: syncProject,
  });

  const questionMutation = useMutation({
    mutationFn: () => askProjectQuestion({
      projectId: projectId ?? '',
      author: user?.name ?? 'Workspace user',
      authorEmail: user?.email ?? '',
      message: questionMessage,
      taskId: questionTaskId || undefined,
    }),
    onSuccess: async (updatedProject) => {
      setQuestionMessage('');
      setQuestionTaskId('');
      await syncProject(updatedProject);
    },
  });

  const answerQuestionMutation = useMutation({
    mutationFn: (question: CommentItem) => answerProjectQuestion({
      projectId: projectId ?? '',
      questionId: question.id ?? '',
      actor: user?.name ?? 'Workspace user',
      answer: answerMessage,
      currentStage: answerStage,
      status: answerStatus,
      progress: answerProgress,
      targetDate: answerTargetDate,
      installationDate: answerInstallationDate,
    }),
    onSuccess: async (updatedProject) => {
      setAnsweringQuestionId(null);
      setAnswerMessage('');
      await syncProject(updatedProject);
    },
  });

  const readQuestionMutation = useMutation({
    mutationFn: (question: CommentItem) => markProjectQuestionRead({
      projectId: projectId ?? '',
      questionId: question.id ?? '',
    }),
    onSuccess: syncProject,
  });

  const taskMutation = useMutation({
    mutationFn: () => {
      const assignees = buildTaskAssignees(taskAssigneeEmails);
      const primaryAssignee = assignees[assignees.length - 1];
      return addProjectTask({
        projectId: projectId ?? '',
        task: taskText,
        actor: user?.name ?? 'Workspace user',
        assigneeName: primaryAssignee?.name,
        assigneeEmail: primaryAssignee?.email,
        assignees,
      });
    },
    onSuccess: async (updatedProject) => {
      setTaskText('');
      setTaskAssigneeEmails([]);
      await syncProject(updatedProject);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ task, text, completed, status, assigneeEmails }: { task: TaskItem; text?: string; completed?: boolean; status?: TaskItem['status']; assigneeEmails?: string[] }) => {
      const assignees = assigneeEmails !== undefined ? buildTaskAssignees(assigneeEmails) : undefined;
      const primaryAssignee = assignees?.[assignees.length - 1];
      return updateProjectTask({
        projectId: projectId ?? '',
        taskId: task.id,
        text,
        completed,
        status,
        assigneeName: assigneeEmails !== undefined ? primaryAssignee?.name : undefined,
        assigneeEmail: assigneeEmails !== undefined ? primaryAssignee?.email : undefined,
        assignees,
        actor: user?.name ?? 'Workspace user',
        actorEmail: user?.email,
      });
    },
    onSuccess: async (updatedProject) => {
      setEditingTaskId(null);
      setEditingTaskText('');
      setEditingTaskAssigneeEmails([]);
      await syncProject(updatedProject);
    },
  });

  async function ensureStagesMaterialized(currentProject: Project): Promise<Project> {
    const hasStageTasks = currentProject.tasks.some((task) => task.stage);
    if (hasStageTasks) {
      return currentProject;
    }

    const activeIndex = timelineStages.indexOf(currentProject.currentStage);
    let working = currentProject;
    for (let index = 0; index < timelineStages.length; index += 1) {
      working = await upsertProjectStageTask({
        projectId: projectId ?? '',
        stage: timelineStages[index],
        completed: activeIndex > 0 && index < activeIndex,
        actor: user?.name ?? 'Workspace user',
      });
    }

    return working;
  }

  const timelineTaskMutation = useMutation({
    mutationFn: async ({ stage: timelineStage, completed, assigneeEmail }: { stage: ProjectStage; completed?: boolean; assigneeEmail?: string }) => {
      let working = await ensureStagesMaterialized(selectedProject);
      const assignee = assigneeEmail !== undefined ? getAssignee(assigneeEmail) : undefined;
      working = await upsertProjectStageTask({
        projectId: projectId ?? '',
        stage: timelineStage,
        completed,
        assigneeName: assigneeEmail !== undefined ? assignee?.name : undefined,
        assigneeEmail,
        actor: user?.name ?? 'Workspace user',
      });

      const stagePlan = getStagePlan(working);
      const workflow = deriveWorkflowFromStagePlan(working, stagePlan);
      working = await updateProjectWorkflow({
        projectId: projectId ?? '',
        currentStage: workflow.currentStage,
        status: workflow.status,
        progress: workflow.progress,
        actor: user?.name ?? 'Workspace user',
      });

      return working;
    },
    onSuccess: syncProject,
  });

  const addStageMutation = useMutation({
    mutationFn: async (stageName: string) => {
      let working = await ensureStagesMaterialized(selectedProject);
      working = await upsertProjectStageTask({
        projectId: projectId ?? '',
        stage: stageName,
        completed: false,
        actor: user?.name ?? 'Workspace user',
      });

      const stagePlan = getStagePlan(working);
      const workflow = deriveWorkflowFromStagePlan(working, stagePlan);
      working = await updateProjectWorkflow({
        projectId: projectId ?? '',
        currentStage: workflow.currentStage,
        status: workflow.status,
        progress: workflow.progress,
        actor: user?.name ?? 'Workspace user',
      });

      return working;
    },
    onSuccess: syncProject,
  });

  const removeStageMutation = useMutation({
    mutationFn: async (stageName: string) => {
      let working = await ensureStagesMaterialized(selectedProject);
      const stageTask = working.tasks.find((task) => task.stage === stageName);
      if (stageTask) {
        working = await deleteProjectTask({
          projectId: projectId ?? '',
          taskId: stageTask.id,
          actor: user?.name ?? 'Workspace user',
        });
      }

      const stagePlan = getStagePlan(working);
      const workflow = deriveWorkflowFromStagePlan(working, stagePlan);
      working = await updateProjectWorkflow({
        projectId: projectId ?? '',
        currentStage: workflow.currentStage,
        status: workflow.status,
        progress: workflow.progress,
        actor: user?.name ?? 'Workspace user',
      });

      return working;
    },
    onSuccess: syncProject,
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (task: TaskItem) => deleteProjectTask({
      projectId: projectId ?? '',
      taskId: task.id,
      actor: user?.name ?? 'Workspace user',
    }),
    onSuccess: async (updatedProject) => {
      setEditingTaskId(null);
      setEditingTaskText('');
      await syncProject(updatedProject);
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: () => deleteProject(projectId ?? ''),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['portal-summary'] }),
      ]);
      navigate('/projects', { replace: true });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, taskId }: { file: File; taskId?: string }) => uploadProjectFile(projectId ?? '', file, project?.files ?? [], taskId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]);
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
  const renameFileMutation = useMutation({
    mutationFn: ({ file, nextName }: { file: ProjectFile; nextName: string }) => renameProjectFile({
      projectId: projectId ?? '',
      filePath: file.path,
      currentName: file.name,
      nextName,
      actor: user?.name ?? 'Workspace user',
    }),
    onSuccess: syncProject,
  });

  const deleteFileMutation = useMutation({
    mutationFn: (file: ProjectFile) => deleteProjectFile({
      projectId: projectId ?? '',
      filePath: file.path,
      fileName: file.name,
      actor: user?.name ?? 'Workspace user',
    }),
    onSuccess: syncProject,
  });

  const previewMutation = useMutation({
    mutationFn: (file: ProjectFile) => getProjectFileUrl(file),
    onSuccess: (url) => {
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
  });

  const fileError = uploadMutation.error ?? previewMutation.error ?? downloadMutation.error ?? deleteFileMutation.error;
  const workflowError = timelineTaskMutation.error ?? addStageMutation.error ?? removeStageMutation.error ?? taskUpdateMutation.error ?? questionMutation.error ?? answerQuestionMutation.error ?? readQuestionMutation.error ?? taskMutation.error ?? updateTaskMutation.error ?? deleteTaskMutation.error ?? deleteProjectMutation.error;
  const notesError = notesMutation.error;
  const rolePolicy = getRolePolicy(user);
  const canAdministerProjectDetails = Boolean(user?.isPlatformOwner);
  const canUploadFiles = canAdministerProjectDetails && Boolean(rolePolicy?.files.canUploadFiles);
  const canDeleteFiles = canAdministerProjectDetails && Boolean(rolePolicy?.files.canDeleteFiles);
  const canAddComments = Boolean(rolePolicy?.communication.canCreateComments);
  const canAskColourpix = Boolean(rolePolicy?.communication.canAskQuestions);
  const canAnswerColourpixQuestions = canAdministerProjectDetails && Boolean(rolePolicy?.communication.canAnswerQuestions);
  const canAddTasks = Boolean(rolePolicy?.tasks.canCreateTasks);
  const canCompleteTasks = Boolean(rolePolicy?.tasks.canCompleteTasks);
  const canAssignTasks = Boolean(rolePolicy?.tasks.canAssignTasks || rolePolicy?.tasks.canReassignTasks);
  const canDeleteTasks = canAdministerProjectDetails && Boolean(rolePolicy?.tasks.canDeleteTasks);
  const canDeleteProject = Boolean(rolePolicy?.projectAccess.canDeleteProjects);
  const canCreateAssignedUpdate = canAddComments && canAddTasks;
  const assignableUsers = canAssignTasks ? users : users.filter((item) => item.email.toLowerCase() === user?.email.toLowerCase());

  function canCurrentUserCompleteTask(task: TaskItem) {
    if (!canCompleteTasks) {
      return false;
    }

    if (canAdministerProjectDetails) {
      return true;
    }

    if (!user) {
      return false;
    }

    const assignedEmails = task.assignees?.map((assignee) => assignee.email.toLowerCase()) ?? [];
    if (assignedEmails.length > 0) {
      return assignedEmails.includes(user.email.toLowerCase());
    }

    if (task.assigneeEmail) {
      return task.assigneeEmail.toLowerCase() === user.email.toLowerCase();
    }

    return true;
  }

  function getTaskStatus(task: TaskItem): 'open' | 'busy' | 'done' {
    return task.status ?? (task.completed ? 'done' : 'open');
  }

  function nextTaskStatus(status: 'open' | 'busy' | 'done'): 'open' | 'busy' | 'done' {
    if (status === 'open') return 'busy';
    if (status === 'busy') return 'done';
    return 'open';
  }

  function startAnswer(question: CommentItem) {
    setAnsweringQuestionId(question.id ?? null);
    setAnswerMessage(question.answer ?? '');
    setAnswerStage(project?.currentStage ?? 'New Project');
    setAnswerStatus(project?.status ?? 'in_progress');
    setAnswerProgress(project?.progress ?? 0);
    setAnswerTargetDate(project?.targetDate ?? '');
    setAnswerInstallationDate(project?.installationDate ?? '');
  }

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
  const projectQuestions = selectedProject.comments.filter((comment) => comment.kind === 'question');
  const projectComments = selectedProject.comments.filter((comment) => comment.kind !== 'question');
  const isQuestionRequester = (question: CommentItem) => (question.requesterEmail ? question.requesterEmail === user?.email : question.author === user?.name);
  const unreadAnswers = projectQuestions.filter((question) => question.status === 'answered' && question.unreadForRequester && isQuestionRequester(question));
  const adHocTasks = selectedProject.tasks.filter((task) => !task.stage);
  const canUpdateTimelineStages = canViewProject(user, selectedProject);
  const canManageStages = canAdministerProjectDetails && canAddTasks;
  const stagePlan = getStagePlan(selectedProject);
  const canEditNotes = canViewProject(user, selectedProject);
  const hasNotesChange = notesDraft.trim() !== selectedProject.notes.trim();
  const branchParticipants = branch?.contacts?.length
    ? branch.contacts
    : branch?.contactName
      ? [{ name: branch.contactName, email: branch.contactEmail, phone: branch.contactPhone, designation: 'Branch Contact' }]
      : [];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Project ID {selectedProject.id}</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">{selectedProject.branch}</h2>
        <p className="mt-2 text-sm text-slate-400">
          {selectedProject.town}, {selectedProject.province} · Manager {selectedProject.manager} · {selectedProject.deliveryPartnerLabel} {selectedProject.installer}
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-4 text-sm text-slate-300">
          <div>Workspace: <span className="text-white">{selectedProject.workspaceName}</span></div>
          <div>Client: <span className="text-white">{selectedProject.clientCompany}</span></div>
          <div>Project type: <span className="text-white">{selectedProject.projectTypeName}</span></div>
          <div>Service partner: <span className="text-white">{selectedProject.graphicsPartner}</span></div>
          <div>Current Status: <span className="text-white">{selectedProject.currentStage}</span></div>
          <div>Target Date: <span className="text-white">{selectedProject.targetDate}</span></div>
          <div>Installation Date: <span className="text-white">{selectedProject.installationDate}</span></div>
          <div>Completion Date: <span className="text-white">{selectedProject.completionDate}</span></div>
          <div className="md:col-span-4">Physical Address: <span className="text-white">{selectedProject.physicalAddress || 'Not captured'}</span></div>
        </div>

        {selectedProject.notes.trim() ? (
          <div className="mt-5 border-t border-white/10 pt-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Quick summary</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{selectedProject.notes}</p>
          </div>
        ) : null}

        {branch ? (
          <div className="mt-5 border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Branch and contact persons</h3>
              <Link to={`/branches/${branch.id}`} className="text-xs font-semibold text-sky-200 transition hover:text-sky-100">View branch</Link>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-4 text-sm text-slate-300">
              <div>Branch: <span className="text-white">{branch.name}</span></div>
              <div>Division: <span className="text-white">{branch.division}</span></div>
              <div>Town/Province: <span className="text-white">{branch.town}, {branch.province}</span></div>
              <div className="md:col-span-4">Branch address: <span className="text-white">{branch.physicalAddress || 'Not captured'}</span></div>
            </div>
            {branchParticipants.length > 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {branchParticipants.map((participant, index) => (
                  <div key={`${participant.email ?? participant.name}-${index}`} className="border-l-2 border-sky-400/50 pl-3">
                    <p className="font-medium text-white">{participant.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{participant.designation}</p>
                    {participant.email ? <p className="mt-2 text-xs text-slate-400">{participant.email}</p> : null}
                    {participant.phone ? <p className="mt-1 text-xs text-slate-400">{participant.phone}</p> : null}
                  </div>
                ))}
              </div>
            ) : <p className="mt-4 text-sm text-slate-400">No branch contact persons have been added yet.</p>}
          </div>
        ) : null}
        {canDeleteProject ? (
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-red-400/15 pt-5">
            <button
              type="button"
              onClick={() => {
                if (deleteConfirmationArmed) {
                  deleteProjectMutation.mutate();
                  return;
                }

                setDeleteConfirmationArmed(true);
              }}
              disabled={deleteProjectMutation.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteProjectMutation.isPending ? 'Deleting project...' : deleteConfirmationArmed ? 'Confirm delete project' : 'Delete project'}
            </button>
            {deleteConfirmationArmed ? (
              <button type="button" onClick={() => setDeleteConfirmationArmed(false)} disabled={deleteProjectMutation.isPending} className="min-h-11 text-sm font-semibold text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
                Cancel
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-4 shadow-soft">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-teal-200/80">Project menu</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Choose a workspace block</h3>
          </div>
          <Link to="/projects" className="text-sm font-semibold text-sky-200 transition hover:text-sky-100">Back to projects</Link>
        </div>
        <nav className="mt-4 flex flex-wrap gap-2">
          {projectSections.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveProjectSection(item.id)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition sm:px-4 ${
                activeProjectSection === item.id
                  ? 'border-sky-300/40 bg-sky-500/15 text-sky-100'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:border-sky-300/30 hover:bg-sky-500/10 hover:text-white'
              }`}
            >
              <span className="text-xs text-sky-200">#{item.number}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </section>

      <section className={activeProjectSection === 'timeline' ? 'rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft' : 'hidden'}>
        {workflowError instanceof Error ? <p className="mb-4 text-sm text-red-300">{workflowError.message}</p> : null}
        <Timeline
          stages={stagePlan}
          activeStage={selectedProject.currentStage}
          tasks={selectedProject.tasks}
          users={users}
          canCompleteStages={canUpdateTimelineStages}
          canAssignStages={canAdministerProjectDetails && canAssignTasks}
          canManageStages={canManageStages}
          isUpdating={timelineTaskMutation.isPending || addStageMutation.isPending || removeStageMutation.isPending}
          onToggleStage={(timelineStage, completed) => timelineTaskMutation.mutate({ stage: timelineStage, completed })}
          onAssignStage={(timelineStage, assigneeEmail) => timelineTaskMutation.mutate({ stage: timelineStage, assigneeEmail })}
          onAddStage={(stageName) => addStageMutation.mutate(stageName)}
          onRemoveStage={(timelineStage) => removeStageMutation.mutate(timelineStage)}
        />

        <div className="mt-6 border-t border-white/10 pt-6">
          <h3 className="text-lg font-semibold text-white">Tasks</h3>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_18rem_auto]">
            <input value={taskText} disabled={!canAddTasks} onChange={(event) => setTaskText(event.target.value)} placeholder={canAddTasks ? 'Add next action...' : 'Task updates restricted'} className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60" />
            <select multiple value={taskAssigneeEmails} disabled={!canAddTasks} onChange={(event) => setTaskAssigneeEmails(Array.from(event.target.selectedOptions, (option) => option.value))} className="min-h-12 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60">
              {assignableUsers.map((item) => <option key={item.email} value={item.email}>{item.name} · {item.profileTitle?.trim() || roleLabels[item.role]}</option>)}
            </select>
            <button type="button" disabled={!canAddTasks || taskMutation.isPending || !taskText.trim() || taskAssigneeEmails.length === 0} onClick={() => taskMutation.mutate()} className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
              Add
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Every open task needs at least one assignee. Designations come from each user profile title or role label. Click the status button to move a task from Open to Busy to Done.</p>
          <div className="mt-4 space-y-2">
            {adHocTasks.length > 0 ? adHocTasks.map((task) => {
              const taskStatus = getTaskStatus(task);
              const statusStyles: Record<'open' | 'busy' | 'done', string> = {
                open: 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10',
                busy: 'border-amber-400/30 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25',
                done: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25',
              };
              const statusLabels: Record<'open' | 'busy' | 'done', string> = { open: 'Open', busy: 'Busy', done: 'Done' };

              return (
              <div key={task.id} className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
                {editingTaskId === task.id ? (
                  <div className="grid gap-3">
                    <input value={editingTaskText} onChange={(event) => setEditingTaskText(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/50" />
                    <select multiple value={editingTaskAssigneeEmails} onChange={(event) => setEditingTaskAssigneeEmails(Array.from(event.target.selectedOptions, (option) => option.value))} className="min-h-12 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/50">
                      {users.map((item) => <option key={item.email} value={item.email}>{item.name} · {item.profileTitle?.trim() || roleLabels[item.role]}</option>)}
                    </select>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={updateTaskMutation.isPending || !editingTaskText.trim() || (taskStatus !== 'done' && editingTaskAssigneeEmails.length === 0)} onClick={() => updateTaskMutation.mutate({ task, text: editingTaskText, assigneeEmails: editingTaskAssigneeEmails })} className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">Save</button>
                      <button type="button" onClick={() => { setEditingTaskId(null); setEditingTaskText(''); setEditingTaskAssigneeEmails([]); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <button
                        type="button"
                        disabled={!canCurrentUserCompleteTask(task) || updateTaskMutation.isPending}
                        onClick={() => updateTaskMutation.mutate({ task, status: nextTaskStatus(taskStatus) })}
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${statusStyles[taskStatus]}`}
                      >
                        {statusLabels[taskStatus]}
                      </button>
                      <span className="min-w-0">
                        <span className={taskStatus === 'done' ? 'block text-slate-500 line-through' : 'block text-slate-200'}>{task.text}</span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {task.assignees && task.assignees.length > 0
                            ? `Assigned to ${task.assignees.map((assignee) => `${assignee.name} (${assignee.designation})`).join(', ')}`
                            : task.assigneeName
                              ? `Assigned to ${task.assigneeName}`
                              : 'Unassigned'}
                        </span>
                      </span>
                    </div>
                    {canAddTasks || canDeleteTasks ? (
                      <div className="flex shrink-0 gap-2">
                        {canAddTasks ? <button type="button" onClick={() => { setEditingTaskId(task.id); setEditingTaskText(task.text); setEditingTaskAssigneeEmails(task.assignees?.map((assignee) => assignee.email) ?? (task.assigneeEmail ? [task.assigneeEmail] : [])); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">Edit</button> : null}
                        {canDeleteTasks ? <button type="button" disabled={deleteTaskMutation.isPending} onClick={() => deleteTaskMutation.mutate(task)} className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50">Delete</button> : null}
                      </div>
                    ) : null}
                  </div>
                )}
                {editingTaskId !== task.id && canUploadFiles ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
                    <span className="text-xs text-slate-500">
                      {selectedProject.files.filter((file) => file.taskId === task.id).length} file{selectedProject.files.filter((file) => file.taskId === task.id).length === 1 ? '' : 's'} in this task's folder
                    </span>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:bg-white/10 aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={uploadMutation.isPending}>
                      {uploadMutation.isPending ? 'Uploading...' : 'Upload file'}
                      <input
                        type="file"
                        disabled={uploadMutation.isPending}
                        accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.dwg,.ai"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          if (file) {
                            uploadMutation.mutate({ file, taskId: task.id });
                          }
                        }}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
              );
            }) : <p className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-slate-400">No open tasks.</p>}
          </div>
        </div>
      </section>

      <section className={activeProjectSection === 'journal' ? 'rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft' : 'hidden'}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Journal</h3>
            <p className="mt-1 text-sm text-slate-400">Every update, follow-up, question, and answer for this project lives in one place.</p>
          </div>
          {unreadAnswers.length > 0 ? <span className="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">{unreadAnswers.length} new answer{unreadAnswers.length === 1 ? '' : 's'}</span> : null}
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-sky-200">Add a task update</p>
          <label className="grid gap-2 text-sm text-slate-300">
            Related task
            <select value={journalTaskId} disabled={!canCreateAssignedUpdate} onChange={(event) => setJournalTaskId(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60">
              <option value="">General update (not tied to a task)</option>
              {selectedProject.tasks.map((item) => <option key={item.id} value={item.id}>{item.text}{item.stage ? ' · stage' : ''}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            Update
            <textarea value={commentMessage} disabled={!canCreateAssignedUpdate} onChange={(event) => setCommentMessage(event.target.value)} rows={3} placeholder={canCreateAssignedUpdate ? 'Example: Waiting for measurements.' : 'Project update tasks are restricted'} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-base leading-7 text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm sm:leading-6" />
          </label>
          <p className="text-xs text-slate-400">Pick the task this update is about, or leave it as a general update for a plain journal note.</p>
          <button type="button" disabled={!canCreateAssignedUpdate || taskUpdateMutation.isPending || !commentMessage.trim()} onClick={() => taskUpdateMutation.mutate()} className="w-fit rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
            {taskUpdateMutation.isPending ? 'Saving update...' : journalTaskId ? 'Save task update' : 'Save journal entry'}
          </button>
        </div>

        {canAskColourpix ? (
          <div className="mt-5 grid gap-3 rounded-2xl border border-sky-400/15 bg-sky-500/10 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <label className="grid gap-2 text-sm text-slate-300">
                Question or update request
                <textarea value={questionMessage} onChange={(event) => setQuestionMessage(event.target.value)} rows={3} placeholder="Please confirm whether artwork approval is still blocking this stage." className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50" />
              </label>
              <label className="grid content-start gap-2 text-sm text-slate-300">
                Related task
                <select value={questionTaskId} onChange={(event) => setQuestionTaskId(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
                  <option value="">General update (not tied to a task)</option>
                  {selectedProject.tasks.map((task) => <option key={task.id} value={task.id}>{task.text}</option>)}
                </select>
              </label>
            </div>
            <button type="button" disabled={questionMutation.isPending || !questionMessage.trim()} onClick={() => questionMutation.mutate()} className="w-fit rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
              {questionMutation.isPending ? 'Sending question...' : 'Send question'}
            </button>
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          {projectQuestions.length > 0 ? projectQuestions.map((question) => {
            const questionId = question.id ?? `${question.author}-${question.requestedAt ?? question.date}`;
            const isRequester = isQuestionRequester(question);
            const showAnswerForm = canAnswerColourpixQuestions && answeringQuestionId === question.id;

            return (
              <article key={questionId} className={`rounded-2xl border p-4 ${question.status === 'answered' ? 'border-emerald-400/20 bg-emerald-500/10' : 'border-amber-400/20 bg-amber-500/10'}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{question.author}</p>
                      <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs text-slate-200">{question.status === 'answered' ? 'Answered' : 'Awaiting workspace team'}</span>
                      {question.taskId ? (() => {
                        const linkedTask = selectedProject.tasks.find((task) => task.id === question.taskId);
                        return linkedTask ? <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-100">On: {linkedTask.text}</span> : null;
                      })() : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{question.message}</p>
                    <p className="mt-2 text-xs text-slate-500">Asked {question.date}</p>
                  </div>
                  {question.status === 'answered' && question.unreadForRequester && isRequester ? (
                    <button type="button" disabled={readQuestionMutation.isPending} onClick={() => readQuestionMutation.mutate(question)} className="rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50">
                      Mark answer read
                    </button>
                  ) : null}
                </div>

                {question.answer || question.relatedChanges?.length ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-semibold text-emerald-100">{question.answeredBy ?? 'Workspace team'}</span>
                      {question.answeredAt ? <span>{new Date(question.answeredAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}</span> : null}
                    </div>
                    {question.answer ? <p className="mt-2 text-sm leading-6 text-slate-200">{question.answer}</p> : null}
                    {question.relatedChanges?.length ? (
                      <ul className="mt-3 grid gap-1 text-xs text-emerald-100">
                        {question.relatedChanges.map((change) => <li key={change}>{change}</li>)}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                {canAnswerColourpixQuestions ? (
                  <div className="mt-4">
                    {showAnswerForm ? (
                      <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                        <label className="grid gap-2 text-sm text-slate-300">
                          Answer
                          <textarea value={answerMessage} onChange={(event) => setAnswerMessage(event.target.value)} rows={3} placeholder="Share the latest update for PSG." className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50" />
                        </label>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <label className="grid gap-2 text-sm text-slate-300">
                            Answer stage
                            <select value={answerStage} onChange={(event) => setAnswerStage(event.target.value as ProjectStage)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
                              {stagePlan.map((item) => <option key={item} value={item}>{item}</option>)}
                            </select>
                          </label>
                          <label className="grid gap-2 text-sm text-slate-300">
                            Answer status
                            <select value={answerStatus} onChange={(event) => setAnswerStatus(event.target.value as ProjectStatus)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
                              {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                            </select>
                          </label>
                          <label className="grid gap-2 text-sm text-slate-300">
                            Answer progress
                            <input type="number" min="0" max="100" value={answerProgress} onChange={(event) => setAnswerProgress(Number(event.target.value))} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50" />
                          </label>
                          <label className="grid gap-2 text-sm text-slate-300">
                            Target date
                            <input value={answerTargetDate} onChange={(event) => setAnswerTargetDate(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50" />
                          </label>
                          <label className="grid gap-2 text-sm text-slate-300">
                            Installation date
                            <input value={answerInstallationDate} onChange={(event) => setAnswerInstallationDate(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50" />
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={answerQuestionMutation.isPending || (!answerMessage.trim() && answerStage === selectedProject.currentStage && answerStatus === selectedProject.status && answerProgress === selectedProject.progress && answerTargetDate === selectedProject.targetDate && answerInstallationDate === selectedProject.installationDate)} onClick={() => answerQuestionMutation.mutate(question)} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                            {answerQuestionMutation.isPending ? 'Sending answer...' : 'Answer and update'}
                          </button>
                          <button type="button" onClick={() => setAnsweringQuestionId(null)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => startAnswer(question)} className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20">
                        {question.status === 'answered' ? 'Update answer' : 'Answer request'}
                      </button>
                    )}
                  </div>
                ) : null}
              </article>
            );
          }) : null}
        </div>

        <div className="mt-6 border-t border-white/10 pt-6">
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Follow-ups</h4>
          <div className="mt-4 space-y-3">
            {projectComments.length > 0 ? projectComments.map((comment) => (
              <div key={`${comment.date}-${comment.author}-${comment.message}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <p className="font-medium text-white">{comment.author}</p>
                  <p className="text-slate-500">{comment.date}</p>
                </div>
                {comment.taskId ? (() => {
                  const linkedTask = selectedProject.tasks.find((task) => task.id === comment.taskId);
                  return linkedTask ? <p className={`text-xs font-semibold ${linkedTask.completed ? 'text-emerald-200' : 'text-amber-200'}`}>Update on: {linkedTask.text}</p> : null;
                })() : null}
                <p className="mt-2 text-sm text-slate-300">{comment.message}</p>
              </div>
            )) : <p className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-slate-400">No follow-ups recorded yet.</p>}
          </div>
        </div>

        <div className="mt-6 border-t border-white/10 pt-6">
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Activity</h4>
          <div className="mt-4 space-y-3">
            {selectedProject.activity.length > 0 ? selectedProject.activity.map((item, index) => (
              <div key={`${item.date}-${item.title}-${item.detail}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="shrink-0 text-xs text-slate-500">{item.date}</p>
                </div>
                <p className="mt-2 text-sm text-slate-300">{item.detail}</p>
              </div>
            )) : <p className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-slate-400">No activity recorded yet.</p>}
          </div>
        </div>
      </section>

      <section className={activeProjectSection === 'files' ? '' : 'hidden'}>
        <FileGrid
          files={selectedProject.files}
          taskFolders={selectedProject.tasks.map((task) => ({ id: task.id, label: task.text }))}
          isUploading={uploadMutation.isPending || previewMutation.isPending || downloadMutation.isPending}
          uploadError={fileError instanceof Error ? fileError.message : null}
          canUpload={canUploadFiles}
          canDelete={canDeleteFiles}
          onUpload={(file, taskId) => uploadMutation.mutate({ file, taskId })}
          onPreview={(file: ProjectFile) => previewMutation.mutate(file)}
          onDownload={(file: ProjectFile) => downloadMutation.mutate(file)}
          onRename={(file: ProjectFile, nextName) => renameFileMutation.mutate({ file, nextName })}
          onDelete={(file: ProjectFile) => deleteFileMutation.mutate(file)}
          getThumbnailUrl={(file: ProjectFile) => getProjectFileUrl(file)}
        />
      </section>

      <section className={activeProjectSection === 'notes' ? 'rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft' : 'hidden'}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Notes</h3>
            <p className="mt-1 text-sm text-slate-400">Edit project notes here. Saved changes are written to the Project Journal.</p>
          </div>
          <button type="button" disabled={!canEditNotes || notesMutation.isPending || !hasNotesChange} onClick={() => notesMutation.mutate()} className="w-fit rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
            {notesMutation.isPending ? 'Saving notes...' : 'Save notes'}
          </button>
        </div>
        <textarea value={notesDraft} disabled={!canEditNotes || notesMutation.isPending} onChange={(event) => setNotesDraft(event.target.value)} rows={6} placeholder="Add project notes..." className="mt-5 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-base leading-7 text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm sm:leading-6" />
        {notesError instanceof Error ? <p className="mt-3 text-sm text-red-300">{notesError.message}</p> : null}
      </section>
    </div>
  );
}
