import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileGrid } from '../components/uploads/FileGrid';
import { Timeline } from '../components/timeline/Timeline';
import { roleLabels } from '../constants/portal';
import { addProjectComment, addProjectTask, answerProjectQuestion, askProjectQuestion, deleteProject, deleteProjectFile, deleteProjectTask, getProjectById, getProjectFileUrl, markProjectQuestionRead, renameProjectFile, reorderProjectTask, updateProjectNotes, updateProjectSummary, updateProjectTask, updateProjectWorkflow, uploadProjectFile, upsertProjectStageTask } from '../services/portalService';
import { getBranchById } from '../services/branchService';
import { getUsers } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import { filterActivityExcludingUser } from '../utils/activityFilter';
import { useSaveFeedback } from '../contexts/SaveFeedbackContext';
import { canViewProject, canAddTaskComments, getRolePolicy } from '../utils/permissions';
import { getTaskStatus } from '../utils/taskStatus';
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

type ProjectSectionId = 'timeline' | 'taskUpdates' | 'files' | 'notes';

const projectSections: Array<{ id: ProjectSectionId; number: string; label: string }> = [
  { id: 'timeline', number: '01', label: 'Project Tasks' },
  { id: 'taskUpdates', number: '02', label: 'Task Updates' },
  { id: 'files', number: '03', label: 'Files' },
  { id: 'notes', number: '04', label: 'Last note:' },
];

function getStagePlan(project: Project): ProjectStage[] {
  const mergedStages = project.tasks
    .map((task) => (task.stage ?? task.text).trim())
    .filter((stage): stage is ProjectStage => Boolean(stage));

  return mergedStages.length > 0 ? mergedStages : [project.currentStage];
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
  const { showSuccess } = useSaveFeedback();
  const queryClient = useQueryClient();
  const [activeProjectSection, setActiveProjectSection] = useState<ProjectSectionId>('timeline');
  const [commentMessage, setCommentMessage] = useState('');
  const [journalTaskId, setJournalTaskId] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [currentStageDraft, setCurrentStageDraft] = useState<ProjectStage>('New Project');
  const [targetDateDraft, setTargetDateDraft] = useState('');
  const [installationDateDraft, setInstallationDateDraft] = useState('');
  const [completionDateDraft, setCompletionDateDraft] = useState('');
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  const [answerMessage, setAnswerMessage] = useState('');
  const [answerStage, setAnswerStage] = useState<ProjectStage>('New Project');
  const [answerStatus, setAnswerStatus] = useState<ProjectStatus>('in_progress');
  const [answerProgress, setAnswerProgress] = useState(0);
  const [answerTargetDate, setAnswerTargetDate] = useState('');
  const [answerInstallationDate, setAnswerInstallationDate] = useState('');
  const [taskText, setTaskText] = useState('');
  const [taskAssigneeEmails, setTaskAssigneeEmails] = useState<string[]>([]);
  const [expandedAccordionTaskIds, setExpandedAccordionTaskIds] = useState<string[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [editingTaskAssigneeEmails, setEditingTaskAssigneeEmails] = useState<string[]>([]);
  const [expandedTaskUpdateTaskIds, setExpandedTaskUpdateTaskIds] = useState<string[]>([]);
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
      setCurrentStageDraft(project.currentStage);
      setTargetDateDraft(project.targetDate);
      setInstallationDateDraft(project.installationDate);
      setCompletionDateDraft(project.completionDate);
    }
  }, [project]);

  const syncProject = async (updatedProject: Project, successMessage?: string) => {
    queryClient.setQueryData(['project', projectId], updatedProject);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
      queryClient.invalidateQueries({ queryKey: ['portal-summary'] }),
    ]);

    if (successMessage) {
      showSuccess(successMessage);
    }
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
      await syncProject(updatedProject, 'Update saved.');
    },
  });

  const notesMutation = useMutation({
    mutationFn: () => updateProjectNotes({
      projectId: projectId ?? '',
      actor: user?.name ?? 'Workspace user',
      notes: notesDraft,
    }),
    onSuccess: (updatedProject) => syncProject(updatedProject, 'Notes saved.'),
  });

  const projectSummaryMutation = useMutation({
    mutationFn: () => updateProjectSummary({
      projectId: projectId ?? '',
      actor: user?.name ?? 'Workspace user',
      currentStage: currentStageDraft,
      targetDate: targetDateDraft,
      installationDate: installationDateDraft,
      completionDate: completionDateDraft,
    }),
    onSuccess: (updatedProject) => syncProject(updatedProject, 'Project summary fields saved.'),
  });

  const questionMutation = useMutation({
    mutationFn: () => askProjectQuestion({
      projectId: projectId ?? '',
      author: user?.name ?? 'Workspace user',
      authorEmail: user?.email ?? '',
      message: commentMessage,
      taskId: journalTaskId || undefined,
    }),
    onSuccess: async (updatedProject) => {
      setCommentMessage('');
      setJournalTaskId('');
      await syncProject(updatedProject, 'Request sent.');
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
      await syncProject(updatedProject, 'Answer saved.');
    },
  });

  const readQuestionMutation = useMutation({
    mutationFn: (question: CommentItem) => markProjectQuestionRead({
      projectId: projectId ?? '',
      questionId: question.id ?? '',
    }),
    onSuccess: (updatedProject) => syncProject(updatedProject, 'Answer marked as read.'),
  });

  const taskMutation = useMutation({
    mutationFn: () => {
      const normalizedTaskText = taskText.trim();
      if (!normalizedTaskText) {
        throw new Error('Task cannot be empty.');
      }
      const duplicateTask = selectedProject.tasks.some((existingTask) => {
        const existingKey = (existingTask.stage ?? existingTask.text).trim().toLowerCase();
        return existingKey === normalizedTaskText.toLowerCase();
      });
      if (duplicateTask) {
        throw new Error('This task/stage already exists. Use a unique name.');
      }

      const assignees = buildTaskAssignees(taskAssigneeEmails);
      const primaryAssignee = assignees[assignees.length - 1];
      return addProjectTask({
        projectId: projectId ?? '',
        task: normalizedTaskText,
        stage: normalizedTaskText,
        actor: user?.name ?? 'Workspace user',
        assigneeName: primaryAssignee?.name,
        assigneeEmail: primaryAssignee?.email,
        assignees,
      });
    },
    onSuccess: async (updatedProject) => {
      setTaskText('');
      setTaskAssigneeEmails([]);
      await syncProject(updatedProject, 'Task added.');
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ task, text, completed, status, assigneeEmails }: { task: TaskItem; text?: string; completed?: boolean; status?: TaskItem['status']; assigneeEmails?: string[] }) => {
      const assignees = assigneeEmails !== undefined ? buildTaskAssignees(assigneeEmails) : undefined;
      const primaryAssignee = assignees?.[assignees.length - 1];
      const nextText = text?.trim();
      return updateProjectTask({
        projectId: projectId ?? '',
        taskId: task.id,
        text: nextText,
        completed,
        status,
        stage: nextText || undefined,
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
      await syncProject(updatedProject, 'Task saved.');
    },
  });

  const reorderTaskMutation = useMutation({
    mutationFn: ({ task, direction }: { task: TaskItem; direction: 'up' | 'down' }) => reorderProjectTask({
      projectId: projectId ?? '',
      taskId: task.id,
      direction,
      actor: user?.name ?? 'Workspace user',
    }),
    onSuccess: async (updatedProject) => {
      await syncProject(updatedProject, 'Task order saved.');
    },
  });

  async function ensureStagesMaterialized(currentProject: Project): Promise<Project> {
    return currentProject;
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
    onSuccess: (updatedProject) => syncProject(updatedProject, 'Project task updated.'),
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
    onSuccess: (updatedProject) => syncProject(updatedProject, 'Project stage added.'),
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
    onSuccess: (updatedProject) => syncProject(updatedProject, 'Project stage removed.'),
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
      await syncProject(updatedProject, 'Task deleted.');
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: () => deleteProject(projectId ?? ''),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['portal-summary'] }),
      ]);
      showSuccess('Project deleted.');
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
      showSuccess('File uploaded.');
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
    onSuccess: (updatedProject) => syncProject(updatedProject, 'File renamed.'),
  });

  const deleteFileMutation = useMutation({
    mutationFn: (file: ProjectFile) => deleteProjectFile({
      projectId: projectId ?? '',
      filePath: file.path,
      fileName: file.name,
      actor: user?.name ?? 'Workspace user',
    }),
    onSuccess: (updatedProject) => syncProject(updatedProject, 'File deleted.'),
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
  const canAddComments = canAddTaskComments(user);
  const canAskColourpix = Boolean(rolePolicy?.communication.canAskQuestions);
  const canAnswerColourpixQuestions = canAdministerProjectDetails && Boolean(rolePolicy?.communication.canAnswerQuestions);
  const canAddTasks = Boolean(rolePolicy?.tasks.canCreateTasks);
  const canCompleteTasks = Boolean(rolePolicy?.tasks.canCompleteTasks);
  const canAssignTasks = Boolean(rolePolicy?.tasks.canAssignTasks || rolePolicy?.tasks.canReassignTasks);
  const isBranchContact = Boolean(branch && user && (
    (branch.contactEmail && user.email && branch.contactEmail.toLowerCase() === user.email.toLowerCase()) ||
    (branch.contacts && branch.contacts.some((c) => c.email && user.email && c.email.toLowerCase() === user.email.toLowerCase()))
  ));

  const canDeleteTasks = (canAdministerProjectDetails && Boolean(rolePolicy?.tasks.canDeleteTasks)) || isBranchContact;
  const canDeleteProject = Boolean(rolePolicy?.projectAccess.canDeleteProjects);
  const canCreateAssignedUpdate = canAddComments;
  const canUseConversationComposer = canCreateAssignedUpdate || canAskColourpix;
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

  function nextTaskStatus(status: TaskItem['status'] | undefined): TaskItem['status'] {
    if (status === 'pending') return 'open';
    if (status === 'open') return 'busy';
    if (status === 'busy') return 'done';
    return 'pending';
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
  const mergedTasks = selectedProject.tasks;
  const canUpdateTimelineStages = canViewProject(user, selectedProject);
  const canManageStages = false;
  const stagePlan = getStagePlan(selectedProject);
  const summaryStageOptions = Array.from(new Set([selectedProject.currentStage, ...stagePlan]));
  const canEditNotes = canViewProject(user, selectedProject);
  const hasNotesChange = notesDraft.trim() !== selectedProject.notes.trim();
  const hasSummaryChange = currentStageDraft.trim() !== selectedProject.currentStage.trim()
    || targetDateDraft.trim() !== selectedProject.targetDate.trim()
    || installationDateDraft.trim() !== selectedProject.installationDate.trim()
    || completionDateDraft.trim() !== selectedProject.completionDate.trim();
  const branchParticipants = branch?.contacts?.length
    ? branch.contacts
    : branch?.contactName
      ? [{ name: branch.contactName, email: branch.contactEmail, phone: branch.contactPhone, designation: 'Contact Person' }]
      : [];

  return (
    <div className="relative space-y-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 rounded-[2.5rem] bg-[radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.25),transparent_55%),radial-gradient(circle_at_85%_20%,rgba(56,189,248,0.22),transparent_50%)]" />
      <section className="rounded-[2rem] border border-slate-700/50 bg-slate-900/80 p-6 shadow-soft backdrop-blur-sm">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Branch reference</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">{selectedProject.branch}</h2>
        <p className="mt-2 text-sm text-slate-400">
          {selectedProject.town}, {selectedProject.province} · Manager {selectedProject.manager}
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-2 text-sm text-slate-300">
          {canEditNotes ? (
            <label className="grid gap-2">
              <span className="text-slate-100">Current Status</span>
              <select value={currentStageDraft} onChange={(event) => setCurrentStageDraft(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/50">
                {summaryStageOptions.map((stageName) => <option key={stageName} value={stageName}>{stageName}</option>)}
              </select>
            </label>
          ) : <div className="text-slate-200">Current Status: <span className="text-white">{selectedProject.currentStage}</span></div>}

          {canEditNotes ? (
            <label className="grid gap-2">
              <span className="text-slate-100">Target Date</span>
              <input value={targetDateDraft} onChange={(event) => setTargetDateDraft(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-300 focus:border-cyan-300/50" />
            </label>
          ) : <div className="text-slate-200">Target Date: <span className="text-white">{selectedProject.targetDate}</span></div>}

          {canEditNotes ? (
            <label className="grid gap-2">
              <span className="text-slate-100">Installation Date</span>
              <input value={installationDateDraft} onChange={(event) => setInstallationDateDraft(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-300 focus:border-cyan-300/50" />
            </label>
          ) : <div className="text-slate-200">Installation Date: <span className="text-white">{selectedProject.installationDate}</span></div>}

          {canEditNotes ? (
            <label className="grid gap-2">
              <span className="text-slate-100">Completion Date</span>
              <input value={completionDateDraft} onChange={(event) => setCompletionDateDraft(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-300 focus:border-cyan-300/50" />
            </label>
          ) : <div className="text-slate-200">Completion Date: <span className="text-white">{selectedProject.completionDate}</span></div>}

          <div className="md:col-span-2 lg:col-span-2 text-slate-200">Physical Address: <span className="text-white">{selectedProject.physicalAddress || 'Not captured'}</span></div>
        </div>
        {canEditNotes ? (
          <div className="mt-3 flex">
            <button type="button" disabled={projectSummaryMutation.isPending} onClick={() => projectSummaryMutation.mutate()} className="rounded-2xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">
              {projectSummaryMutation.isPending ? 'Saving summary...' : 'Save summary fields'}
            </button>
          </div>
        ) : null}
        {projectSummaryMutation.error instanceof Error ? <p className="mt-2 text-sm text-red-300">{projectSummaryMutation.error.message}</p> : null}

        {selectedProject.notes.trim() ? (
          <div className="mt-5 border-t border-white/10 pt-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Last note:</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{selectedProject.notes}</p>
          </div>
        ) : null}

        {branch ? (
          <div className="mt-5 border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white">Branch and contact persons</h3>
              <Link to={`/branches/${branch.id}`} className="inline-flex items-center justify-center rounded-xl border border-sky-400/50 bg-slate-800/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sky-100 transition hover:bg-slate-700/60">View branch details</Link>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-4 text-sm text-white">
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
                    <p className="mt-1 text-sm text-white">{participant.designation}</p>
                    {participant.email ? <p className="mt-2 text-xs text-white">{participant.email}</p> : null}
                    {participant.phone ? <p className="mt-1 text-xs text-white">{participant.phone}</p> : null}
                  </div>
                ))}
              </div>
            ) : <p className="mt-4 text-sm text-white">No branch contact persons have been added yet.</p>}
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

      <section className="rounded-[2rem] border border-cyan-300/20 bg-slate-950/80 p-4 shadow-soft">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-teal-200/80">Project menu</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Choose a workspace block</h3>
          </div>
          <Link to="/branches" className="text-sm font-semibold text-sky-200 transition hover:text-sky-100">Back to branches</Link>
        </div>
        <nav className="mt-4 flex flex-wrap gap-2">
          {projectSections.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveProjectSection(item.id)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition sm:px-4 ${
                activeProjectSection === item.id
                  ? 'border-cyan-300/50 bg-cyan-400/20 text-cyan-100'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-white'
              }`}
            >
              <span className="text-xs text-cyan-200">#{item.number}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </section>

      <section className={activeProjectSection === 'timeline' ? 'rounded-3xl border border-cyan-300/20 bg-cyan-500/8 p-6 shadow-soft backdrop-blur-sm' : 'hidden'}>
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
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold text-white">Tasks</h3>
            {mergedTasks.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedAccordionTaskIds(mergedTasks.map((t) => t.id))}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedAccordionTaskIds([])}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_18rem_auto]">
            <input value={taskText} disabled={!canAddTasks} onChange={(event) => setTaskText(event.target.value)} placeholder={canAddTasks ? 'Add next action...' : 'Task updates restricted'} className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-300 focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60" />
            <select multiple value={taskAssigneeEmails} disabled={!canAddTasks} onChange={(event) => setTaskAssigneeEmails(Array.from(event.target.selectedOptions, (option) => option.value))} className="min-h-12 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60">
              {assignableUsers.map((item) => <option key={item.email} value={item.email}>{item.name} · {item.profileTitle?.trim() || roleLabels[item.role]}</option>)}
            </select>
            <button type="button" disabled={!canAddTasks || taskMutation.isPending || !taskText.trim() || taskAssigneeEmails.length === 0} onClick={() => taskMutation.mutate()} className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
              Add
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Every open task needs at least one assignee. Designations come from each user profile title or role label. Click the status button to move a task from Open to Busy to Done.</p>
          <div className="mt-4 space-y-2">
            {mergedTasks.length > 0 ? mergedTasks.map((task, index) => {
              const taskStatus = getTaskStatus(task);
              const taskUpdates = projectComments
                .filter((comment) => comment.taskId === task.id)
                .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
              const isTaskUpdatesOpen = expandedTaskUpdateTaskIds.includes(task.id);
              const taskFiles = selectedProject.files.filter((file) => file.taskId === task.id);
              const statusStyles: Record<'pending' | 'open' | 'busy' | 'done', string> = {
                pending: 'border-slate-400/20 bg-slate-700/20 text-slate-200 hover:bg-slate-700/30',
                open: 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10',
                busy: 'border-amber-400/30 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25',
                done: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25',
              };
              const statusLabels: Record<'pending' | 'open' | 'busy' | 'done', string> = { pending: 'Pending', open: 'Open', busy: 'Busy', done: 'Done' };
              const isAccordionExpanded = expandedAccordionTaskIds.includes(task.id);
              const taskBodyId = `task-body-${task.id}`;

              return (
              <div key={task.id} className="rounded-2xl border border-white/10 bg-slate-950/50 overflow-hidden">
                {/* Accordion Header */}
                <button
                  type="button"
                  aria-expanded={isAccordionExpanded}
                  aria-controls={taskBodyId}
                  onClick={(e) => { e.stopPropagation(); setExpandedAccordionTaskIds((current) =>
                    current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id]
                  ); }}
                  className="w-full px-4 py-3 text-sm text-slate-200 hover:bg-slate-900/40 transition text-left focus:outline-none focus:ring-2 focus:ring-sky-400/50 rounded-2xl"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="shrink-0 text-slate-400">{isAccordionExpanded ? '▼' : '▶'}</span>
                      <span className={`truncate ${taskStatus === 'done' ? 'text-slate-500 line-through' : 'text-slate-200 font-medium'}`}>{task.text}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-xs text-slate-500">
                      <span className="rounded-full bg-white/5 px-2 py-1">{statusLabels[taskStatus]}</span>
                      <span>·</span>
                      <span>{taskUpdates.length} comment{taskUpdates.length === 1 ? '' : 's'}</span>
                      <span>·</span>
                      <span>{taskFiles.length} file{taskFiles.length === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                </button>

                {/* Accordion Body */}
                {isAccordionExpanded && (
                  <div id={taskBodyId} className="border-t border-white/10 px-4 py-3 text-sm text-slate-200">
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
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={reorderTaskMutation.isPending || index === 0}
                        onClick={() => reorderTaskMutation.mutate({ task, direction: 'up' })}
                        className="rounded-xl border border-slate-700 bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        disabled={reorderTaskMutation.isPending || index === mergedTasks.length - 1}
                        onClick={() => reorderTaskMutation.mutate({ task, direction: 'down' })}
                        className="rounded-xl border border-slate-700 bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Move down
                      </button>
                      {canAddTasks ? <button type="button" onClick={() => { setEditingTaskId(task.id); setEditingTaskText(task.text); setEditingTaskAssigneeEmails(task.assignees?.map((assignee) => assignee.email) ?? (task.assigneeEmail ? [task.assigneeEmail] : [])); }} className="rounded-xl border border-slate-700 bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-600">Edit</button> : null}
                      {canDeleteTasks ? <button type="button" disabled={deleteTaskMutation.isPending} onClick={() => deleteTaskMutation.mutate(task)} className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50">Delete</button> : null}
                      <button
                        type="button"
                        onClick={() => setExpandedTaskUpdateTaskIds((current) => current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id])}
                        className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
                      >
                        {isTaskUpdatesOpen ? 'Hide updates' : 'View updates'}{taskUpdates.length > 0 ? ` (${taskUpdates.length})` : ''}
                      </button>
                    </div>
                  </div>
                )}
                {editingTaskId !== task.id ? (
                  <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs text-slate-500">
                        {taskFiles.length} file{taskFiles.length === 1 ? '' : 's'} attached to this task
                      </span>
                      {canUploadFiles ? (
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
                      ) : null}
                    </div>
                    {taskFiles.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Attached files</p>
                        <ul className="space-y-2 text-sm text-slate-300">
                          {taskFiles.map((file) => (
                            <li key={`${task.id}-${file.path ?? file.name}`} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                              <span className="truncate font-medium text-white">{file.name}</span>
                              <div className="flex flex-wrap items-center gap-2">
                                {file.path && canViewProject(user, selectedProject) ? (
                                  <button
                                    type="button"
                                    disabled={previewMutation.isPending}
                                    onClick={(e) => { e.stopPropagation(); previewMutation.mutate(file); }}
                                    className="rounded-xl border border-slate-700 bg-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Preview
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={downloadMutation.isPending}
                                  onClick={(e) => { e.stopPropagation(); downloadMutation.mutate(file); }}
                                  className="rounded-xl border border-slate-700 bg-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Download
                                </button>
                                {canDeleteFiles ? (
                                  <button
                                    type="button"
                                    disabled={renameFileMutation.isPending || deleteFileMutation.isPending}
                                    onClick={() => renameFileMutation.mutate({ file, nextName: file.name })}
                                    className="rounded-xl border border-slate-700 bg-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Rename
                                  </button>
                                ) : null}
                                {canDeleteFiles ? (
                                  <button
                                    type="button"
                                    disabled={deleteFileMutation.isPending}
                                    onClick={() => deleteFileMutation.mutate(file)}
                                    className="rounded-xl border border-red-400/20 bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Delete
                                  </button>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No files attached to this task yet.</p>
                    )}
                  </div>
                ) : null}
                {taskUpdates.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Recent comments</p>
                      <button
                        type="button"
                        onClick={() => {
                          setJournalTaskId(task.id);
                          setActiveProjectSection('taskUpdates');
                        }}
                        className="text-xs font-semibold text-sky-200 transition hover:text-sky-100"
                      >
                        Comment on this task
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {taskUpdates.slice(0, 2).map((update, commentIndex) => (
                        <div key={`${update.date}-${update.author}-${commentIndex}`} className="rounded-2xl border border-white/10 bg-slate-900/80 p-3">
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                            <span className="font-semibold text-white">{update.author}</span>
                            <span>{update.date}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-300">{update.message}</p>
                        </div>
                      ))}
                      {taskUpdates.length > 2 ? (
                        <p className="text-xs text-slate-500">{taskUpdates.length - 2} more update{taskUpdates.length - 2 === 1 ? '' : 's'}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {editingTaskId !== task.id && isTaskUpdatesOpen ? (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">Task updates</p>
                    {taskUpdates.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {taskUpdates.map((update, index) => (
                          <div key={`${update.date}-${update.author}-${index}`} className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <p className="font-semibold text-white">{update.author}</p>
                              <p className="text-slate-500">{update.date}</p>
                            </div>
                            <p className="mt-1 text-sm text-slate-300">{update.message}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">No updates have been added to this task yet.</p>
                    )}
                  </div>
                ) : null}
                  </div>
                )}
              </div>
              );
            }) : <p className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-slate-400">No tasks yet. Add a task to create the first timeline stage.</p>}
          </div>
        </div>
      </section>

      <section className={activeProjectSection === 'taskUpdates' ? 'rounded-3xl border border-cyan-300/20 bg-cyan-500/8 p-6 shadow-soft backdrop-blur-sm' : 'hidden'}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Task conversations</h3>
            <p className="mt-1 text-sm text-slate-300">Updates and requests are now merged into one task-linked stream.</p>
          </div>
          {unreadAnswers.length > 0 ? <span className="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">{unreadAnswers.length} new answer{unreadAnswers.length === 1 ? '' : 's'}</span> : null}
        </div>

        {canUseConversationComposer ? (
          <div className="mt-5 grid gap-3 rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-4">
            <label className="grid gap-2 text-sm text-slate-200">
              Related task
              <select value={journalTaskId} onChange={(event) => setJournalTaskId(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50">
                <option value="">General update (not tied to a task)</option>
                {selectedProject.tasks.map((item) => <option key={item.id} value={item.id}>{item.text}{item.stage ? ' · stage' : ''}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-slate-200">
              Message
              <textarea value={commentMessage} onChange={(event) => setCommentMessage(event.target.value)} rows={3} placeholder="Share an update or ask for action on this task." className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-base leading-7 text-white outline-none placeholder:text-slate-300 focus:border-cyan-300/50 sm:text-sm sm:leading-6" />
            </label>
            <div className="flex flex-wrap gap-2">
              {canCreateAssignedUpdate ? (
                <button type="button" disabled={taskUpdateMutation.isPending || !commentMessage.trim()} onClick={() => taskUpdateMutation.mutate()} className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">
                  {taskUpdateMutation.isPending ? 'Saving update...' : journalTaskId ? 'Save task update' : 'Save general update'}
                </button>
              ) : null}
              {canAskColourpix ? (
                <button type="button" disabled={questionMutation.isPending || !commentMessage.trim()} onClick={() => questionMutation.mutate()} className="rounded-2xl border border-cyan-300/35 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50">
                  {questionMutation.isPending ? 'Sending request...' : 'Send request'}
                </button>
              ) : null}
            </div>
            <p className="text-xs text-slate-300/80">One composer, two actions: save an update or send a request. Both can be linked to the same task.</p>
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
                          <textarea value={answerMessage} onChange={(event) => setAnswerMessage(event.target.value)} rows={3} placeholder="Share the latest update for PSG." className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-300 focus:border-sky-400/50" />
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
            {filterActivityExcludingUser(selectedProject.activity, user?.name).length > 0 ? filterActivityExcludingUser(selectedProject.activity, user?.name).map((item, index) => (
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

      <section className={activeProjectSection === 'notes' ? 'rounded-3xl border border-cyan-300/20 bg-cyan-500/8 p-6 shadow-soft backdrop-blur-sm' : 'hidden'}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Summary</h3>
            <p className="mt-1 text-sm text-slate-400">Edit the project summary here. Saved changes are written to the project activity log.</p>
          </div>
          <button type="button" disabled={!canEditNotes || notesMutation.isPending} onClick={() => notesMutation.mutate()} className="w-fit rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
            {notesMutation.isPending ? 'Saving summary...' : 'Save summary'}
          </button>
        </div>
        <textarea value={notesDraft} disabled={!canEditNotes || notesMutation.isPending} onChange={(event) => setNotesDraft(event.target.value)} rows={6} placeholder="Add project notes..." className="mt-5 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-base leading-7 text-white outline-none placeholder:text-slate-300 focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm sm:leading-6" />
        {notesError instanceof Error ? <p className="mt-3 text-sm text-red-300">{notesError.message}</p> : null}
      </section>
    </div>
  );
}
