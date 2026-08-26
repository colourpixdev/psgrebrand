import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DatePickerInput } from '../components/DatePickerInput';
import { addProjectComment, addProjectTask, answerProjectQuestion, askProjectQuestion, deleteProject, deleteProjectActivity, deleteProjectComment, deleteProjectFile, deleteProjectTask, getProjectById, getProjectFileUrl, markProjectQuestionRead, renameProjectFile, reorderProjectTask, updateProjectActivity, updateProjectComment, updateProjectSummary, updateProjectTask, uploadProjectFile, upsertProjectStageTask } from '../services/portalService';
import { getBranchById, updateBranch } from '../services/branchService';
import { useAuth } from '../contexts/AuthContext';
import { followProjectForUser } from '../services/projectFollowService';
import { useSaveFeedback } from '../contexts/SaveFeedbackContext';
import { getUsers } from '../services/userService';
import { can, canViewProject, canAddTaskComments, canDeleteComment, canEditOwnComment, canRenameFiles, getRolePolicy } from '../utils/permissions';
import { getTaskStatus } from '../utils/taskStatus';
import type { CommentItem, ContactPerson, Division, Project, ProjectFile, ProjectStatus, ProjectStage, TaskItem } from '../types/domain';
import { normalizeRole } from '../types/domain';
import { isAccessControlAdmin, isPlatformOwnerEmail } from '../constants/workspaces';

const statusOptions: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'on_schedule', label: 'On Schedule' },
  { value: 'completed', label: 'Completed' },
  { value: 'delayed', label: 'Delayed' },
];

const statusLabels: Record<ProjectStatus, string> = {
  on_schedule: 'On Schedule',
  pending: 'Pending',
  open: 'Started',
  completed: 'Completed',
  busy: 'In progress',
  in_progress: 'In progress',
  awaiting_approval: 'Awaiting approval',
  delayed: 'Delayed',
  on_hold: 'On hold',
  cancelled: 'Cancelled',
};

const statusTones: Record<ProjectStatus, string> = {
  on_schedule: 'border-sky-300/40 bg-sky-400/15 text-sky-100',
  pending: 'border-slate-300/30 bg-slate-400/15 text-slate-100',
  open: 'border-sky-300/40 bg-sky-400/15 text-sky-100',
  completed: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100',
  busy: 'border-sky-300/40 bg-sky-400/15 text-sky-100',
  in_progress: 'border-sky-300/40 bg-sky-400/15 text-sky-100',
  awaiting_approval: 'border-amber-300/40 bg-amber-400/15 text-amber-100',
  delayed: 'border-red-300/40 bg-red-400/15 text-red-100',
  on_hold: 'border-slate-300/30 bg-slate-400/15 text-slate-100',
  cancelled: 'border-stone-300/30 bg-stone-400/15 text-stone-100',
};

const stageStatusLabels: Record<NonNullable<TaskItem['status']>, string> = {
  pending: 'Pending',
  open: 'Delayed',
  busy: 'Busy',
  done: 'Completed',
  waiting: 'Delayed',
  blocked: 'Delayed',
};

const stageStatusTones: Record<NonNullable<TaskItem['status']>, string> = {
  pending: 'border-slate-300/30 bg-slate-400/15 text-slate-100',
  open: 'border-sky-300/40 bg-sky-400/15 text-sky-100',
  busy: 'border-amber-300/40 bg-amber-400/15 text-amber-100',
  done: 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100',
  waiting: 'border-blue-300/40 bg-blue-400/15 text-blue-100',
  blocked: 'border-red-300/40 bg-red-400/15 text-red-100',
};

function findTaskById(tasks: TaskItem[], taskId: string) {
  return tasks.find((task) => task.id === taskId);
}

function formatWorkspaceDate(value: string) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isImageFile(file: ProjectFile) {
  const fileType = file.type ?? '';
  const fileName = file.name.toLowerCase();

  return fileType.startsWith('image/') || /\.(jpe?g|png|gif|webp|svg|bmp|tif|tiff)$/.test(fileName);
}

function getStagePlan(project: Project): ProjectStage[] {
  const mergedStages = project.tasks
    .map((task) => (task.stage ?? task.text).trim())
    .filter((stage): stage is ProjectStage => Boolean(stage));

  return mergedStages;
}

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { showError, showSuccess } = useSaveFeedback();
  const queryClient = useQueryClient();
  const [commentMessage, setCommentMessage] = useState('');
  const [journalTaskId, setJournalTaskId] = useState('');
  const [currentStageDraft, setCurrentStageDraft] = useState<ProjectStage>('New Project');
  const [viewedTaskId, setViewedTaskId] = useState('');
  const [statusDraft, setStatusDraft] = useState<ProjectStatus>('in_progress');
  const [targetDateDraft, setTargetDateDraft] = useState('');
  const [projectStartDateDraft, setProjectStartDateDraft] = useState('');
  const [marketingCoordinatorEmailDraft, setMarketingCoordinatorEmailDraft] = useState('');
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [branchDetailsDraft, setBranchDetailsDraft] = useState({
    name: '',
    code: '',
    division: 'Wealth' as Division,
    province: '',
    city: '',
    town: '',
    physicalAddress: '',
    signageCompany: '',
    signageContactName: '',
    signageContactPhone: '',
    signageContactEmail: '',
    signageAddress: '',
    contacts: [] as ContactPerson[],
  });
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  const [answerMessage, setAnswerMessage] = useState('');
  const [answerStage, setAnswerStage] = useState<ProjectStage>('New Project');
  const [answerStatus, setAnswerStatus] = useState<ProjectStatus>('in_progress');
  const [answerTargetDate, setAnswerTargetDate] = useState('');
  const [answerInstallationDate, setAnswerInstallationDate] = useState('');
  const [taskText, setTaskText] = useState('');
  const [expandedAccordionTaskIds, setExpandedAccordionTaskIds] = useState<string[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [taskDueDateDrafts, setTaskDueDateDrafts] = useState<Record<string, string>>({});
  const [taskStartedDateDrafts, setTaskStartedDateDrafts] = useState<Record<string, string>>({});
  const [taskDateSaveMessage, setTaskDateSaveMessage] = useState<string | null>(null);
  const [stageImageUrls, setStageImageUrls] = useState<Record<string, string>>({});
  const [taskCommentDrafts, setTaskCommentDrafts] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState('');
  const [editingActivityKey, setEditingActivityKey] = useState<string | null>(null);
  const [editingActivityDraft, setEditingActivityDraft] = useState('');
  const [deleteConfirmationArmed, setDeleteConfirmationArmed] = useState(false);
  const [isProjectHistoryExpanded, setIsProjectHistoryExpanded] = useState(false);
  const [draggingUploadTaskId, setDraggingUploadTaskId] = useState<string | null>(null);
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectById(projectId ?? ''),
    enabled: Boolean(projectId),
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
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

  useEffect(() => {
    if (project) {
      const matchingCurrentStageTask = project.tasks.find((task) => (task.stage ?? task.text).trim().toLowerCase() === project.currentStage.trim().toLowerCase());
      const requestedTaskId = searchParams.get('task');
      const requestedTask = requestedTaskId ? project.tasks.find((task) => task.id === requestedTaskId) : undefined;
      const nextViewedTaskId = requestedTask?.id ?? matchingCurrentStageTask?.id ?? project.tasks.find((task) => !task.completed)?.id ?? project.tasks[0]?.id ?? '';

      setCurrentStageDraft(project.currentStage);
      setViewedTaskId(nextViewedTaskId);
      if (requestedTask) {
        setExpandedAccordionTaskIds([requestedTask.id]);
      }
      setStatusDraft(project.status);
      setTargetDateDraft(project.targetDate);
      setProjectStartDateDraft(project.projectStartDate ?? '');
      setMarketingCoordinatorEmailDraft(project.managerEmail);
    }
  }, [project, searchParams]);

  useEffect(() => {
    if (!branch) {
      return;
    }

    const contacts = branch.contacts?.length
      ? branch.contacts
      : branch.contactName
        ? [{ name: branch.contactName, email: branch.contactEmail, phone: branch.contactPhone, designation: 'Contact Person' }]
        : [];
    setBranchDetailsDraft({
      name: branch.name,
      code: branch.code ?? '',
      division: branch.division,
      province: branch.province,
      city: branch.city ?? '',
      town: branch.town,
      physicalAddress: branch.physicalAddress,
      signageCompany: branch.signageCompany ?? '',
      signageContactName: branch.signageContactName ?? '',
      signageContactPhone: branch.signageContactPhone ?? '',
      signageContactEmail: branch.signageContactEmail ?? '',
      signageAddress: branch.signageAddress ?? '',
      contacts,
    });
  }, [branch]);

  useEffect(() => {
    // Reset accordion state when project ID changes to ensure accordions are collapsed by default
    setExpandedAccordionTaskIds([]);
  }, [projectId]);

  useEffect(() => {
    // Filter out accordion IDs for tasks that no longer exist
    if (project?.tasks) {
      setExpandedAccordionTaskIds((current) => current.filter((taskId) => project.tasks.some((task) => task.id === taskId)));
    }
  }, [project?.tasks]);

  useEffect(() => {
    if (!project?.files) {
      return;
    }

    project.files.forEach((file) => {
      if (!file.path || !isImageFile(file) || stageImageUrls[file.path]) {
        return;
      }

      void getProjectFileUrl(file).then((url) => {
        if (url) {
          setStageImageUrls((current) => ({ ...current, [file.path as string]: url }));
        }
      }).catch(() => undefined);
    });
  }, [project?.files, stageImageUrls]);

  const syncProject = (updatedProject: Project, successMessage?: string) => {
    queryClient.setQueryData(['project', projectId], updatedProject);

    if (successMessage) {
      showSuccess(successMessage);
    }

    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
      queryClient.invalidateQueries({ queryKey: ['portal-summary'] }),
    ]).catch(() => undefined);
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

  const detailsMutation = useMutation({
    mutationFn: async () => {
      if (!branch) {
        throw new Error('Branch details are unavailable.');
      }

      const contacts = branchDetailsDraft.contacts.filter((contact) => contact.name.trim());
      const [updatedBranch, updatedProject] = await Promise.all([
        updateBranch(branch.id, {
          name: branchDetailsDraft.name.trim(),
          code: branchDetailsDraft.code.trim() || null,
          division: branchDetailsDraft.division,
          province: branchDetailsDraft.province.trim(),
          city: branchDetailsDraft.city.trim() || null,
          town: branchDetailsDraft.town.trim(),
          physicalAddress: branchDetailsDraft.physicalAddress.trim(),
          signageCompany: branchDetailsDraft.signageCompany.trim() || null,
          signageContactName: branchDetailsDraft.signageContactName.trim() || null,
          signageContactPhone: branchDetailsDraft.signageContactPhone.trim() || null,
          signageContactEmail: branchDetailsDraft.signageContactEmail.trim() || null,
          signageAddress: branchDetailsDraft.signageAddress.trim() || null,
          contactName: contacts[0]?.name.trim() || null,
          contactEmail: contacts[0]?.email?.trim() || null,
          contactPhone: contacts[0]?.phone?.trim() || null,
          contacts,
          marketingCoordinatorName: users.find((item) => item.email.toLowerCase() === marketingCoordinatorEmailDraft.toLowerCase())?.name ?? null,
          marketingCoordinatorEmail: marketingCoordinatorEmailDraft.trim() || null,
        }),
        updateProjectSummary({
          projectId: projectId ?? '',
          actor: user?.name ?? 'Workspace user',
          currentStage: currentStageDraft,
          currentTaskId: viewedTaskId || undefined,
          status: statusDraft,
          projectStartDate: projectStartDateDraft,
          targetDate: targetDateDraft,
          briefRequestedDate: selectedProject.briefRequestedDate,
          installationDate: selectedProject.installationDate,
          manager: users.find((item) => item.email.toLowerCase() === marketingCoordinatorEmailDraft.toLowerCase())?.name ?? selectedProject.manager,
          managerEmail: marketingCoordinatorEmailDraft,
        }),
      ]);
      if (marketingCoordinatorEmailDraft.trim()) {
        followProjectForUser(marketingCoordinatorEmailDraft, updatedProject.id);
      }
      return { updatedBranch, updatedProject };
    },
    onSuccess: async ({ updatedBranch, updatedProject }) => {
      if (updatedBranch) {
        queryClient.setQueryData(['branch', updatedBranch.id], updatedBranch);
      }
      await queryClient.invalidateQueries({ queryKey: ['branch', branch?.id] });
      setIsEditingDetails(false);
      await syncProject(updatedProject, 'Project details saved.');
    },
    onError: (error) => showError(error instanceof Error ? error.message : 'Unable to save project details.'),
  });

  const currentStageMutation = useMutation({
    mutationFn: ({ taskId, currentStage }: { taskId: string; currentStage: ProjectStage }) => updateProjectSummary({
      projectId: projectId ?? '',
      actor: user?.name ?? 'Workspace user',
      currentStage,
      currentTaskId: taskId,
      status: selectedProject.status,
      projectStartDate: selectedProject.projectStartDate,
      targetDate: selectedProject.targetDate,
      briefRequestedDate: selectedProject.briefRequestedDate,
      installationDate: selectedProject.installationDate,
    }),
    onSuccess: async (updatedProject) => {
      await syncProject(updatedProject, 'Current stage saved.');
    },
    onError: (error) => showError(error instanceof Error ? error.message : 'Unable to save current stage.'),
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

  const taskCommentMutation = useMutation({
    mutationFn: ({ projectId: pid, taskId, message }: { projectId: string; taskId: string; message: string }) => addProjectComment({
      projectId: pid,
      author: user?.name ?? 'Workspace user',
      message,
      taskId: taskId || undefined,
    }),
    onSuccess: async (updatedProject, variables) => {
      setTaskCommentDrafts((current) => ({ ...current, [variables.taskId]: '' }));
      await syncProject(updatedProject, 'Comment added.');
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: ({ commentId, message }: { commentId: string; message: string }) => updateProjectComment({
      projectId: projectId ?? '',
      commentId,
      author: user?.name ?? 'Workspace user',
      actorRole: user?.role,
      actorEmail: user?.email,
      message,
    }),
    onSuccess: async (updatedProject) => {
      setEditingCommentId(null);
      setEditingCommentDraft('');
      await syncProject(updatedProject, 'Comment updated.');
    },
    onError: (error) => showError(error instanceof Error ? error.message : 'Unable to update comment.'),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => deleteProjectComment({
      projectId: projectId ?? '',
      commentId,
      author: user?.name ?? 'Workspace user',
      actorRole: user?.role,
      actorEmail: user?.email,
    }),
    onSuccess: async (updatedProject) => {
      setEditingCommentId(null);
      setEditingCommentDraft('');
      await syncProject(updatedProject, 'Comment deleted.');
    },
    onError: (error) => showError(error instanceof Error ? error.message : 'Unable to delete comment.'),
  });

  const updateActivityMutation = useMutation({
    mutationFn: ({ date, title, detail, message }: { date: string; title: string; detail: string; message: string }) => updateProjectActivity({
      projectId: projectId ?? '',
      actor: user?.name ?? 'Workspace user',
      date,
      title,
      detail,
      message,
    }),
    onSuccess: async (updatedProject) => {
      setEditingActivityKey(null);
      setEditingActivityDraft('');
      await syncProject(updatedProject, 'System update saved.');
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: ({ date, title, detail }: { date: string; title: string; detail: string }) => deleteProjectActivity({ projectId: projectId ?? '', date, title, detail }),
    onSuccess: async (updatedProject) => {
      await syncProject(updatedProject, 'System update deleted.');
    },
    onError: (error) => showError(error instanceof Error ? error.message : 'Unable to delete system update.'),
  });

  const taskMutation = useMutation({
    mutationFn: () => {
      const normalizedTaskText = taskText.trim();
      if (!normalizedTaskText) {
        throw new Error('Stage cannot be empty.');
      }
      const duplicateTask = selectedProject.tasks.some((existingTask) => {
        const existingKey = (existingTask.stage ?? existingTask.text).trim().toLowerCase();
        return existingKey === normalizedTaskText.toLowerCase();
      });
      if (duplicateTask) {
        throw new Error('This stage already exists. Use a unique name.');
      }

      return addProjectTask({
        projectId: projectId ?? '',
        task: normalizedTaskText,
        stage: normalizedTaskText,
        actor: user?.name ?? 'Workspace user',
      });
    },
    onSuccess: async (updatedProject) => {
      setTaskText('');
      await syncProject(updatedProject, 'Stage added.');
    },
    onError: (error) => showError(error instanceof Error ? error.message : 'Unable to add stage.'),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ task, text, completed, status, assignees, startedDate, dueDate }: { task: TaskItem; text?: string; completed?: boolean; status?: TaskItem['status']; assignees?: TaskItem['assignees']; startedDate?: string; dueDate?: string }) => {
      const nextText = text?.trim();
      return updateProjectTask({
        projectId: projectId ?? '',
        taskId: task.id,
        text: nextText,
        completed,
        status,
        assignees,
        startedDate,
        dueDate,
        stage: nextText || undefined,
        actor: user?.name ?? 'Workspace user',
        actorEmail: user?.email,
      });
    },
    onSuccess: async (updatedProject, variables) => {
      setEditingTaskId(null);
      setEditingTaskText('');
      setTaskDueDateDrafts((current) => {
        const next = { ...current };
        delete next[variables.task.id];
        return next;
      });
      setTaskStartedDateDrafts((current) => {
        const next = { ...current };
        delete next[variables.task.id];
        return next;
      });
      setTaskDateSaveMessage('Saved');
      const syncedProject = {
        ...updatedProject,
        tasks: updatedProject.tasks.map((task) => task.id === variables.task.id
          ? {
            ...task,
            completed: variables.status === 'done' ? true : variables.status === undefined ? task.completed : false,
            assigneeName: variables.assignees !== undefined ? variables.assignees[variables.assignees.length - 1]?.name : task.assigneeName,
            assigneeEmail: variables.assignees !== undefined ? variables.assignees[variables.assignees.length - 1]?.email : task.assigneeEmail,
            assignees: variables.assignees !== undefined ? variables.assignees : task.assignees,
            startedDate: variables.startedDate ?? task.startedDate,
            dueDate: variables.dueDate ?? task.dueDate,
          }
          : task),
      };
      await syncProject(syncedProject, 'Stage saved.');
    },
    onError: (error) => {
      setTaskDateSaveMessage(error instanceof Error ? error.message : 'Unable to save stage.');
      showError(error instanceof Error ? error.message : 'Unable to save stage.');
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
      await syncProject(updatedProject, 'Stage order saved.');
    },
  });

  async function ensureStagesMaterialized(currentProject: Project): Promise<Project> {
    return currentProject;
  }

  const deleteTaskMutation = useMutation({
    mutationFn: (task: TaskItem) => deleteProjectTask({
      projectId: projectId ?? '',
      taskId: task.id,
      actor: user?.name ?? 'Workspace user',
    }),
    onSuccess: async (updatedProject) => {
      setEditingTaskId(null);
      setEditingTaskText('');
      await syncProject(updatedProject, 'Stage deleted.');
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

  const uploadFiles = async (files: File[], taskId?: string) => {
    for (const file of files) {
      await uploadMutation.mutateAsync({ file, taskId });
    }
  };

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
  const workflowError = taskUpdateMutation.error ?? questionMutation.error ?? answerQuestionMutation.error ?? readQuestionMutation.error ?? taskMutation.error ?? updateTaskMutation.error ?? deleteTaskMutation.error ?? deleteProjectMutation.error;
  const rolePolicy = getRolePolicy(user);
  const canAdministerProjectDetails = Boolean(user && (
    user.isPlatformOwner
    || user.role === 'colourpix_admin'
    || user.role === 'psg_head_office'
    || can(user, 'manage_workflow')
  ));
  const canUploadFiles = canAdministerProjectDetails && Boolean(rolePolicy?.files.canUploadFiles);
  const canDeleteFiles = canAdministerProjectDetails && Boolean(rolePolicy?.files.canDeleteFiles);
  const canRenameProjectFiles = canAdministerProjectDetails && canRenameFiles(user);
  const canAddComments = canAddTaskComments(user);
  const canAskColourpix = Boolean(rolePolicy?.communication.canAskQuestions);
  const canAnswerColourpixQuestions = canAdministerProjectDetails && Boolean(rolePolicy?.communication.canAnswerQuestions);
  const canChangeStage = Boolean(rolePolicy?.workflow.canChangeStage);
  const canAssignStageTasks = Boolean(rolePolicy?.tasks.canAssignTasks);
  const canEditStageDates = Boolean(rolePolicy?.workflow.canChangeTargetDates || rolePolicy?.workflow.canChangeStage || canAdministerProjectDetails);
  const canAddTasks = Boolean(rolePolicy?.tasks.canCreateTasks);
  const canCompleteTasks = Boolean(rolePolicy?.tasks.canCompleteTasks);
  const isPsgUser = Boolean(user && normalizeRole(user.role) === 'psg_user');
  const isBranchContact = Boolean(branch && user && (
    (branch.contactEmail && user.email && branch.contactEmail.toLowerCase() === user.email.toLowerCase()) ||
    (branch.contacts && branch.contacts.some((c) => c.email && user.email && c.email.toLowerCase() === user.email.toLowerCase()))
  ));

  const canDeleteTasks = (canAdministerProjectDetails && Boolean(rolePolicy?.tasks.canDeleteTasks)) || isBranchContact;
  const canDeleteProject = Boolean(rolePolicy?.projectAccess.canDeleteProjects);
  const canCreateAssignedUpdate = canAddComments;
  const canUseConversationComposer = canCreateAssignedUpdate || canAskColourpix;
  const canEditDetails = canAdministerProjectDetails;
  const canEditProjectStatus = Boolean(user && (isPlatformOwnerEmail(user.email) || isAccessControlAdmin(user.email)));

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

  function startAnswer(question: CommentItem) {
    setAnsweringQuestionId(question.id ?? null);
    setAnswerMessage(question.answer ?? '');
    setAnswerStage(project?.currentStage ?? 'New Project');
    setAnswerStatus(project?.status ?? 'in_progress');
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
  const stagePlan = getStagePlan(selectedProject);
  const currentStageTask = findTaskById(selectedProject.tasks, viewedTaskId);
  const viewedStageValue = currentStageTask?.stage ?? currentStageTask?.text ?? selectedProject.currentStage;
  const currentStageTaskStatus = currentStageTask ? getTaskStatus(currentStageTask) : null;
  const displayedStatus = statusLabels[selectedProject.status];
  const displayedStatusTone = statusTones[selectedProject.status];
  const displayedStageStatus = currentStageTaskStatus ? stageStatusLabels[currentStageTaskStatus] : 'Pending';
  const displayedStageStatusTone = currentStageTaskStatus ? stageStatusTones[currentStageTaskStatus] : stageStatusTones.pending;
  const currentStageAssigneeNames = currentStageTask
    ? [...new Map([
      ...(currentStageTask.assignees ?? []).map((assignee) => [assignee.name.trim().toLowerCase(), assignee.name.trim()] as const),
      ...(currentStageTask.assigneeName?.trim() ? [[currentStageTask.assigneeName.trim().toLowerCase(), currentStageTask.assigneeName.trim()] as const] : []),
    ]).values()]
    : [];
  const currentStageAssigneeDisplay = currentStageAssigneeNames.length > 0
    ? currentStageAssigneeNames.join(', ')
    : currentStageTask?.assigneeName?.trim() || 'Unassigned';
  const currentStageFiles = currentStageTask
    ? selectedProject.files.filter((file) => !file.taskId || file.taskId === currentStageTask.id)
    : [];
  const currentStageComments = currentStageTask ? projectComments.filter((comment) => comment.taskId === currentStageTask.id) : [];
  const summaryStageOptions = Array.from(new Set([selectedProject.currentStage, ...stagePlan]));
  const isInternalUser = canAdministerProjectDetails;
  const projectHistory = [
    ...projectComments.map((comment, index) => ({
      id: `comment-${comment.id ?? index}`,
      commentId: comment.id,
      activityKey: undefined,
      date: comment.date,
      author: comment.author,
      title: comment.taskId ? 'Stage update' : 'Project update',
      detail: comment.message,
    })),
    ...selectedProject.activity
      .filter((item) => item.title !== 'Project Created')
      .map((item, index) => ({
      id: `activity-${item.date}-${index}`,
      commentId: undefined,
      activityKey: `${item.date}|${item.title}|${item.detail}`,
      date: item.date,
      author: '',
      title: item.title,
      detail: item.detail,
      })),
  ]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.date === item.date && candidate.title === item.title && candidate.author === item.author && candidate.detail === item.detail) === index)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 12);
  const completedStageCount = stagePlan.filter((stage) => selectedProject.tasks.some((task) => (task.stage ?? task.text).trim() === stage && task.completed)).length;
  const branchParticipants = branch?.contacts?.filter((contact) => contact.name?.trim() || contact.email?.trim() || contact.phone?.trim()).length
    ? branch.contacts.filter((contact) => contact.name?.trim() || contact.email?.trim() || contact.phone?.trim())
    : branch?.contactName
      ? [{ name: branch.contactName, email: branch.contactEmail, phone: branch.contactPhone, designation: 'Contact Person' }]
      : [];
  const hasSignageDetails = [branch?.signageCompany, branch?.signageAddress, branch?.signageContactName, branch?.signageContactPhone, branch?.signageContactEmail].some((value) => Boolean(value?.trim()));
  const marketingCoordinatorName = selectedProject.manager?.trim() && selectedProject.manager.trim().toLowerCase() !== 'not captured' ? selectedProject.manager.trim() : '';
  const marketingCoordinatorEmail = selectedProject.managerEmail?.trim() ?? '';
  const hasMarketingCoordinator = Boolean(marketingCoordinatorName || marketingCoordinatorEmail);

  return (
    <div className="relative space-y-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 rounded-[2.5rem] bg-[radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.25),transparent_55%),radial-gradient(circle_at_85%_20%,rgba(56,189,248,0.22),transparent_50%)]" />
      <Link to="/branches" className="inline-flex items-center text-sm font-semibold text-sky-200 transition hover:text-white">← Back to branches</Link>
      <section className="rounded-[2rem] border border-cyan-300/25 bg-[#0b1f3a] p-6 shadow-soft">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/75">Branch rebrand workspace</p>
            <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">{selectedProject.branch}</h1>
            <p className="mt-2 text-base text-slate-300">{branch?.town ?? selectedProject.town}, {branch?.province ?? selectedProject.province}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${displayedStatusTone}`}>{displayedStatus}</span>
          </div>
        </div>

        {branch ? (
          <div className="mt-6 border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {canEditDetails && !isEditingDetails ? (
                <button type="button" onClick={() => setIsEditingDetails(true)} className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20">Edit details</button>
              ) : null}
            </div>

            {isEditingDetails && canEditDetails ? (
              <div className="mt-4 grid gap-4 text-sm text-slate-200">
                <section className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Branch</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2">Branch<input value={branchDetailsDraft.name} onChange={(event) => setBranchDetailsDraft((current) => ({ ...current, name: event.target.value }))} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-cyan-300/50" /></label>
                    <label className="grid gap-2">Branch code<input value={branchDetailsDraft.code} onChange={(event) => setBranchDetailsDraft((current) => ({ ...current, code: event.target.value }))} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-cyan-300/50" /></label>
                    <label className="grid gap-2">Division<select value={branchDetailsDraft.division} onChange={(event) => setBranchDetailsDraft((current) => ({ ...current, division: event.target.value as Division }))} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-cyan-300/50"><option value="Wealth">Wealth</option><option value="Insure">Insure</option><option value="Wealth Insure">Wealth Insure</option></select></label>
                    <label className="grid gap-2">Province<input value={branchDetailsDraft.province} onChange={(event) => setBranchDetailsDraft((current) => ({ ...current, province: event.target.value }))} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-cyan-300/50" /></label>
                    <label className="grid gap-2">City<input value={branchDetailsDraft.city} onChange={(event) => setBranchDetailsDraft((current) => ({ ...current, city: event.target.value }))} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-cyan-300/50" /></label>
                    <label className="grid gap-2">Town<input value={branchDetailsDraft.town} onChange={(event) => setBranchDetailsDraft((current) => ({ ...current, town: event.target.value }))} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-cyan-300/50" /></label>
                  </div>
                  <label className="grid gap-2">Branch address<textarea value={branchDetailsDraft.physicalAddress} onChange={(event) => setBranchDetailsDraft((current) => ({ ...current, physicalAddress: event.target.value }))} rows={2} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-cyan-300/50" /></label>
                  <div className="grid gap-3 border-t border-white/10 pt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Branch contact persons</h4>
                    {branchDetailsDraft.contacts.map((contact, index) => (
                      <div key={`contact-${index}`} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3 md:grid-cols-2">
                        <label className="grid gap-2">Name<input value={contact.name} onChange={(event) => setBranchDetailsDraft((current) => ({ ...current, contacts: current.contacts.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) }))} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none" /></label>
                        <label className="grid gap-2">Designation<input value={contact.designation} onChange={(event) => setBranchDetailsDraft((current) => ({ ...current, contacts: current.contacts.map((item, itemIndex) => itemIndex === index ? { ...item, designation: event.target.value } : item) }))} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none" /></label>
                        <label className="grid gap-2">Email<input value={contact.email ?? ''} onChange={(event) => setBranchDetailsDraft((current) => ({ ...current, contacts: current.contacts.map((item, itemIndex) => itemIndex === index ? { ...item, email: event.target.value } : item) }))} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none" /></label>
                        <label className="grid gap-2">Phone<input value={contact.phone ?? ''} onChange={(event) => setBranchDetailsDraft((current) => ({ ...current, contacts: current.contacts.map((item, itemIndex) => itemIndex === index ? { ...item, phone: event.target.value } : item) }))} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none" /></label>
                        <button type="button" onClick={() => setBranchDetailsDraft((current) => ({ ...current, contacts: current.contacts.filter((_, itemIndex) => itemIndex !== index) }))} className="w-fit text-xs font-semibold text-red-200 hover:text-red-100">Remove contact</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setBranchDetailsDraft((current) => ({ ...current, contacts: [...current.contacts, { name: '', designation: 'Contact Person', email: '', phone: '' }] }))} className="w-fit rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">Add contact person</button>
                    <label className="grid gap-2 border-t border-white/10 pt-4">Marketing coordinator<select value={marketingCoordinatorEmailDraft} onChange={(event) => setMarketingCoordinatorEmailDraft(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none"><option value="">Unassigned</option>{users.filter((item) => item.role === 'psg_user').map((item) => <option key={item.email} value={item.email}>{item.name} · {item.email}</option>)}</select></label>
                  </div>
                </section>
                <section className="grid gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Signage supplier</h3>
                  <label className="grid gap-2">Company<input value={branchDetailsDraft.signageCompany} onChange={(event) => setBranchDetailsDraft((current) => ({ ...current, signageCompany: event.target.value }))} placeholder="Company handling this branch rebrand" className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-cyan-300/50" /></label>
                  <label className="grid gap-2">Address<input value={branchDetailsDraft.signageAddress} onChange={(event) => setBranchDetailsDraft((current) => ({ ...current, signageAddress: event.target.value }))} placeholder="Supplier physical address" className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-cyan-300/50" /></label>
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="grid gap-2">Contact person<input value={branchDetailsDraft.signageContactName} onChange={(event) => setBranchDetailsDraft((current) => ({ ...current, signageContactName: event.target.value }))} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-cyan-300/50" /></label>
                    <label className="grid gap-2">Telephone<input value={branchDetailsDraft.signageContactPhone} onChange={(event) => setBranchDetailsDraft((current) => ({ ...current, signageContactPhone: event.target.value }))} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-cyan-300/50" /></label>
                    <label className="grid gap-2">Email<input type="email" value={branchDetailsDraft.signageContactEmail} onChange={(event) => setBranchDetailsDraft((current) => ({ ...current, signageContactEmail: event.target.value }))} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-cyan-300/50" /></label>
                  </div>
                </section>
                <section className="grid gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Project schedule</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <DatePickerInput label="Project start date" value={projectStartDateDraft} onChange={setProjectStartDateDraft} placeholder="Select project start date" />
                    <DatePickerInput label="Project target completion" value={targetDateDraft} onChange={setTargetDateDraft} placeholder="Select project target completion" />
                    {canEditProjectStatus ? <label className="grid gap-2">Project status<select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as ProjectStatus)} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none focus:border-cyan-300/50">{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : null}
                  </div>
                </section>
                <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  <button type="button" disabled={detailsMutation.isPending} onClick={() => detailsMutation.mutate()} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">{detailsMutation.isPending ? 'Saving...' : 'Save details'}</button>
                  <button type="button" disabled={detailsMutation.isPending || deleteProjectMutation.isPending} onClick={() => { setDeleteConfirmationArmed(false); setIsEditingDetails(false); }} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10">Cancel</button>
                  <button type="button" onClick={() => navigate('/branches')} className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20">Back to branches</button>
                  {canDeleteProject ? <button type="button" onClick={() => { if (deleteConfirmationArmed) { deleteProjectMutation.mutate(); return; } setDeleteConfirmationArmed(true); }} disabled={detailsMutation.isPending || deleteProjectMutation.isPending} className="rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                    {deleteProjectMutation.isPending ? 'Deleting...' : deleteConfirmationArmed ? 'Confirm delete' : 'Delete project'}
                  </button> : null}
                  {deleteConfirmationArmed ? <button type="button" onClick={() => setDeleteConfirmationArmed(false)} disabled={deleteProjectMutation.isPending} className="px-2 py-2 text-xs font-semibold text-slate-300 hover:text-white">Cancel delete</button> : null}
                </div>
                {detailsMutation.error instanceof Error ? <p className="text-sm text-red-300">{detailsMutation.error.message}</p> : null}
              </div>
            ) : (
              <div className="mt-4 grid gap-4 text-sm text-white lg:grid-cols-2">
                <section className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Branch</h3>
                  <div><span className="text-cyan-200">Name:</span> {branch.name}</div>
                  <div><span className="text-cyan-200">Division:</span> {branch.division}</div>
                  <div><span className="text-cyan-200">Town/Province:</span> {branch.town}, {branch.province}</div>
                  <div><span className="text-cyan-200">Address:</span> {branch.physicalAddress || 'Not captured'}</div>
                  {hasMarketingCoordinator ? <div><span className="text-cyan-200">Marketing coordinator:</span> {marketingCoordinatorName}{marketingCoordinatorName && marketingCoordinatorEmail ? ` · ${marketingCoordinatorEmail}` : marketingCoordinatorEmail}</div> : null}
                  <div className="grid gap-3 border-t border-white/10 pt-3">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Contact persons</h4>
                    {branchParticipants.length > 0 ? branchParticipants.map((participant, index) => <div key={`${participant.email ?? participant.name}-${index}`} className="border-l-2 border-sky-400/50 pl-3"><p className="font-medium text-cyan-400">{participant.name}</p><p className="mt-1 text-xs text-slate-300">{participant.designation}</p>{participant.email ? <p className="mt-2 text-xs text-slate-300">{participant.email}</p> : null}{participant.phone ? <p className="mt-1 text-xs text-slate-300">{participant.phone}</p> : null}</div>) : <p className="text-xs text-slate-500">No contact persons added.</p>}
                  </div>
                </section>
                <section className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Project schedule</h3>
                  <div><span className="text-cyan-200">Project start date:</span> {formatWorkspaceDate(selectedProject.projectStartDate ?? '')}</div>
                  <div><span className="text-cyan-200">Project target completion:</span> {formatWorkspaceDate(selectedProject.targetDate)}</div>
                </section>
                {hasSignageDetails ? <section className="grid gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-4 lg:col-span-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Signage supplier</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {branch.signageCompany?.trim() ? <div><span className="text-cyan-200">Company:</span> {branch.signageCompany}</div> : null}
                    {branch.signageAddress?.trim() ? <div><span className="text-cyan-200">Address:</span> {branch.signageAddress}</div> : null}
                    {branch.signageContactName?.trim() ? <div><span className="text-cyan-200">Contact:</span> {branch.signageContactName}</div> : null}
                    {branch.signageContactPhone?.trim() ? <div><span className="text-cyan-200">Telephone:</span> {branch.signageContactPhone}</div> : null}
                    {branch.signageContactEmail?.trim() ? <div><span className="text-cyan-200">Email:</span> {branch.signageContactEmail}</div> : null}
                  </div>
                </section> : null}
              </div>
            )}
          </div>
        ) : null}

        {false && !isEditingDetails && currentStageTask ? <section className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Current stage</h2>
            {currentStageTask ? <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${displayedStageStatusTone}`}>{displayedStageStatus}</span> : null}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(120px,1fr)_minmax(150px,1fr)_minmax(170px,1fr)]">
            <label className="grid min-w-0 gap-1"><span className="text-xs uppercase tracking-[0.16em] text-slate-400">{canChangeStage ? 'Current stage' : 'View stage'}</span><select value={viewedTaskId} disabled={selectedProject.tasks.length === 0 || currentStageMutation.isPending} onChange={(event) => { const nextTaskId = event.target.value; const nextTask = findTaskById(selectedProject.tasks, nextTaskId); setViewedTaskId(nextTaskId); if (canChangeStage && nextTask) { currentStageMutation.mutate({ taskId: nextTask.id, currentStage: nextTask.stage ?? nextTask.text }); } }} className="mt-1 w-full min-w-0 max-w-full truncate rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-lg font-semibold text-white outline-none focus:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-60" aria-label={canChangeStage ? 'Current stage' : 'View stage'}><option value="" disabled>No stage set</option>{selectedProject.tasks.map((task) => <option key={task.id} value={task.id}>{task.stage ?? task.text}</option>)}</select></label>
            <div className="min-w-0"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Status</p><p className="mt-1 truncate text-lg font-semibold text-white">{displayedStageStatus}</p></div>
            <div className="min-w-0 overflow-hidden"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Assignee</p><p className="mt-1 truncate whitespace-nowrap text-sm font-semibold text-white" title={currentStageAssigneeDisplay}>{currentStageAssigneeDisplay}</p></div>
            <div className="min-w-0 overflow-hidden"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">Stage dates</p><p className="mt-1 truncate whitespace-nowrap text-sm font-semibold text-white" title={`Started: ${formatWorkspaceDate(currentStageTask?.startedDate ?? '')}`}>Started: {formatWorkspaceDate(currentStageTask?.startedDate ?? '')}</p><p className="mt-1 truncate whitespace-nowrap text-sm font-semibold text-white" title={`Target completion: ${formatWorkspaceDate(currentStageTask?.dueDate ?? '')}`}>Target completion: {formatWorkspaceDate(currentStageTask?.dueDate ?? '')}</p></div>
          </div>
          {currentStageTask ? <div className="mt-5 grid gap-4 border-t border-white/10 pt-4 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Files for this stage</p>
              {currentStageFiles.length > 0 ? <ul className="mt-3 space-y-2 text-sm text-slate-200">{currentStageFiles.map((file) => <li key={`${file.id ?? file.path ?? file.name}-${file.name}`} className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2">{file.path && stageImageUrls[file.path] ? <img src={stageImageUrls[file.path]} alt={file.name} className="mb-2 max-h-48 w-full rounded-lg object-contain" /> : null}<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span className="truncate font-medium text-white">{file.name}</span><div className="flex flex-wrap items-center gap-2">{file.path ? <button type="button" disabled={previewMutation.isPending} onClick={() => previewMutation.mutate(file)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-sky-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">Preview</button> : null}<button type="button" disabled={downloadMutation.isPending} onClick={() => downloadMutation.mutate(file)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-sky-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">Download</button>{canRenameProjectFiles ? <button type="button" onClick={() => { const nextName = window.prompt('Rename file', file.name)?.trim(); if (nextName && nextName !== file.name) renameFileMutation.mutate({ file, nextName }); }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-sky-200 transition hover:bg-white/10">Rename</button> : null}{canDeleteFiles ? <button type="button" disabled={deleteFileMutation.isPending} onClick={() => deleteFileMutation.mutate(file)} className="rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50">Delete</button> : null}</div></div></li>)}</ul> : <p className="mt-2 text-xs text-slate-500">No files attached to this stage.</p>}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Updates for this stage:</p>
              {currentStageComments.length > 0 ? <div className="mt-3 space-y-2">{currentStageComments.map((comment, index) => <div key={`${comment.id ?? comment.date}-${index}`} className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2"><div className="flex items-start justify-between gap-2"><p className="text-xs text-slate-500">{comment.author} · {comment.date}</p>{comment.id && canEditOwnComment(user, comment.author) && editingCommentId !== comment.id ? <button type="button" onClick={() => { setEditingCommentId(comment.id ?? null); setEditingCommentDraft(comment.message); }} className="rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20 hover:text-white">Edit</button> : null}</div>{editingCommentId === comment.id ? <div className="mt-2 grid gap-2"><textarea value={editingCommentDraft} onChange={(event) => setEditingCommentDraft(event.target.value)} rows={3} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/50" /><div className="flex gap-2"><button type="button" disabled={!editingCommentDraft.trim() || updateCommentMutation.isPending} onClick={() => updateCommentMutation.mutate({ commentId: comment.id ?? '', message: editingCommentDraft })} className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{updateCommentMutation.isPending ? 'Saving...' : 'Save'}</button><button type="button" onClick={() => { setEditingCommentId(null); setEditingCommentDraft(''); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">Cancel</button></div></div> : <p className="mt-1 text-sm text-slate-200">{comment.message}</p>}</div>)}</div> : <p className="mt-3 text-sm text-slate-500">No stage updates.</p>}
            </div>
          </div> : null}
          {currentStageTask && canAddTaskComments(user) ? <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Leave an update on this stage</p>
            <div className="mt-3 grid gap-2">
              <textarea
                value={taskCommentDrafts[currentStageTask?.id ?? ''] ?? ''}
                onChange={(event) => setTaskCommentDrafts((current) => ({ ...current, [currentStageTask?.id ?? '']: event.target.value }))}
                rows={2}
                placeholder="Add an update for this stage"
                className="rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-300 focus:border-sky-400/50"
              />
              <button
                type="button"
                disabled={!taskCommentDrafts[currentStageTask?.id ?? '']?.trim() || taskCommentMutation.isPending}
                onClick={() => taskCommentMutation.mutate({ projectId: projectId ?? '', taskId: currentStageTask?.id ?? '', message: taskCommentDrafts[currentStageTask?.id ?? ''] ?? '' })}
                className="w-fit rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {taskCommentMutation.isPending ? 'Posting...' : 'Add stage update'}
              </button>
            </div>
          </div> : null}
        </section> : null}

        {false && user && projectHistory.length > 0 ? <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Project history</h4>
            <button type="button" onClick={() => setIsProjectHistoryExpanded((expanded) => !expanded)} className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20">{isProjectHistoryExpanded ? 'Hide' : 'Show'}</button>
          </div>
          {isProjectHistoryExpanded ? <div className="mt-4 space-y-3">
            {projectHistory.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="shrink-0 text-xs text-slate-500">{item.date}</p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  {item.author ? <p className="text-xs text-cyan-200">{item.author}</p> : <span />}
                  {item.commentId && (canEditOwnComment(user, item.author) || canAdministerProjectDetails || isPlatformOwnerEmail(user?.email)) && editingCommentId !== item.commentId ? <button type="button" onClick={() => { setEditingCommentId(item.commentId ?? null); setEditingCommentDraft(item.detail); }} className="rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20 hover:text-white">Edit</button> : null}
                  {item.commentId && canDeleteComment(user, item.author) ? <button type="button" disabled={deleteCommentMutation.isPending} onClick={() => { if (window.confirm('Delete this project comment?')) { deleteCommentMutation.mutate(item.commentId ?? ''); } }} className="rounded-xl border border-red-300/35 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50">Delete</button> : null}
                  {item.activityKey && canEditDetails && editingActivityKey !== item.activityKey ? <button type="button" onClick={() => { setEditingActivityKey(item.activityKey ?? null); setEditingActivityDraft(item.detail); }} className="rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20 hover:text-white">Edit</button> : null}
                  {item.activityKey && canEditDetails ? <button type="button" disabled={deleteActivityMutation.isPending} onClick={() => { if (window.confirm('Delete this project history entry?')) { deleteActivityMutation.mutate({ date: item.date, title: item.title, detail: item.detail }); } }} className="rounded-xl border border-red-300/35 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50">Delete</button> : null}
                </div>
                {editingCommentId === item.commentId ? <div className="mt-2 grid gap-2"><textarea value={editingCommentDraft} onChange={(event) => setEditingCommentDraft(event.target.value)} rows={3} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/50" /><div className="flex gap-2"><button type="button" disabled={!editingCommentDraft.trim() || updateCommentMutation.isPending} onClick={() => updateCommentMutation.mutate({ commentId: item.commentId ?? '', message: editingCommentDraft })} className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{updateCommentMutation.isPending ? 'Saving...' : 'Save'}</button><button type="button" onClick={() => { setEditingCommentId(null); setEditingCommentDraft(''); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">Cancel</button></div></div> : editingActivityKey === item.activityKey ? <div className="mt-2 grid gap-2"><textarea value={editingActivityDraft} onChange={(event) => setEditingActivityDraft(event.target.value)} rows={3} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/50" /><div className="flex gap-2"><button type="button" disabled={!editingActivityDraft.trim() || updateActivityMutation.isPending} onClick={() => updateActivityMutation.mutate({ date: item.date, title: item.title, detail: item.detail, message: editingActivityDraft })} className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{updateActivityMutation.isPending ? 'Saving...' : 'Save'}</button><button type="button" onClick={() => { setEditingActivityKey(null); setEditingActivityDraft(''); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">Cancel</button></div></div> : <p className="mt-2 text-sm text-slate-300">{item.detail}</p>}
              </div>
            ))}
          </div> : null}
        </div> : null}
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <h3 className="text-2xl font-semibold text-white">Stages</h3>
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
        <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/8 p-6 shadow-soft backdrop-blur-sm">
          {isInternalUser ? (
            <>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                <input value={taskText} disabled={!canAddTasks} onChange={(event) => setTaskText(event.target.value)} placeholder="Enter a stage name" aria-label="Stage name" className="min-w-0 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-300 focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60" />
                <button type="button" disabled={!canAddTasks || taskMutation.isPending || !taskText.trim()} onClick={() => taskMutation.mutate()} className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                  Add stage
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400">Add stages in the order the rebrand should progress. Update each stage status directly.</p>
            </>
          ) : <p className="mt-2 text-sm text-slate-400">The stages below show the current rebrand progress.</p>}
          <div className="mt-4 space-y-2">
            {mergedTasks.length > 0 ? mergedTasks.map((task, index) => {
              const taskStatus = getTaskStatus(task);
              const taskUpdates = projectComments
                .filter((comment) => comment.taskId === task.id)
                .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
              const taskFiles = selectedProject.files.filter((file) => file.taskId === task.id);
              const statusStyles: Record<NonNullable<TaskItem['status']>, string> = {
                pending: 'border-slate-400/20 bg-slate-700/20 text-slate-200 hover:bg-slate-700/30',
                open: 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10',
                busy: 'border-amber-400/30 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25',
                done: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25',
                waiting: 'border-blue-400/30 bg-blue-500/15 text-blue-100 hover:bg-blue-500/25',
                blocked: 'border-red-400/30 bg-red-500/15 text-red-100 hover:bg-red-500/25',
              };
              const statusLabels: Record<NonNullable<TaskItem['status']>, string> = { pending: 'Pending', open: 'Delayed', busy: 'Busy', done: 'Completed', waiting: 'Delayed', blocked: 'Delayed' };
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
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="shrink-0 text-slate-400">{isAccordionExpanded ? '▼' : '▶'}</span>
                      <span className={`min-w-0 break-words ${taskStatus === 'done' ? 'text-slate-500 line-through' : 'text-slate-200 font-medium'}`}>{task.text}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-start gap-2 text-xs text-slate-500 sm:shrink-0 sm:justify-end">
                      <span className="rounded-full bg-white/5 px-2 py-1">{statusLabels[taskStatus]}</span>
                      <span>Started: {task.startedDate || 'Not set'} · Target: {task.dueDate || 'Not set'}</span>
                    </div>
                  </div>
                </button>

                {isAccordionExpanded && <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
                  <select
                    value={taskStatus === 'open' || taskStatus === 'waiting' ? 'blocked' : taskStatus}
                    disabled={!canCurrentUserCompleteTask(task) || updateTaskMutation.isPending}
                    onChange={(event) => updateTaskMutation.mutate({ task, status: event.target.value as TaskItem['status'] })}
                    aria-label={`Status for ${task.text}`}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${statusStyles[taskStatus]}`}
                  >
                    {(['pending', 'busy', 'blocked', 'done'] as const).map((status) => (
                      <option key={status} value={status}>{statusLabels[status]}</option>
                    ))}
                  </select>
                  <select
                    value={task.assigneeEmail ?? ''}
                    disabled={!canAssignStageTasks || updateTaskMutation.isPending}
                    onChange={(event) => {
                      const selectedUser = users.find((item) => item.email === event.target.value);
                      updateTaskMutation.mutate({
                        task,
                        assignees: selectedUser ? [{ name: selectedUser.name, email: selectedUser.email, designation: selectedUser.profileTitle?.trim() || 'Assigned user' }] : [],
                      });
                    }}
                    aria-label={`Assign ${task.text}`}
                    className="max-w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Unassigned</option>
                    {users.map((item) => <option key={item.email} value={item.email}>{item.name} · {item.email}</option>)}
                  </select>
                  {canUploadFiles ? (
                    <label
                      className={`inline-flex min-w-[110px] cursor-pointer items-center justify-center rounded-xl border px-4 py-1.5 text-xs font-semibold uppercase transition aria-disabled:pointer-events-none aria-disabled:opacity-50 ${draggingUploadTaskId === task.id ? 'border-cyan-200 bg-cyan-400/30 text-white' : 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20'}`}
                      aria-disabled={uploadMutation.isPending}
                      onDragEnter={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (!uploadMutation.isPending) {
                          setDraggingUploadTaskId(task.id);
                        }
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = uploadMutation.isPending ? 'none' : 'copy';
                      }}
                      onDragLeave={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (event.currentTarget === event.target) {
                          setDraggingUploadTaskId(null);
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDraggingUploadTaskId(null);
                        if (!uploadMutation.isPending) {
                          const files = Array.from(event.dataTransfer.files);
                          if (files.length > 0) {
                            void uploadFiles(files, task.id);
                          }
                        }
                      }}
                    >
                      {uploadMutation.isPending && uploadMutation.variables?.taskId === task.id ? 'Uploading...' : 'Upload file'}
                      <input
                        type="file"
                        disabled={uploadMutation.isPending}
                        multiple
                        accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.dwg,.ai"
                        className="sr-only"
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? []);
                          event.target.value = '';
                          if (files.length > 0) {
                            void uploadFiles(files, task.id);
                          }
                        }}
                      />
                    </label>
                  ) : null}
                </div>}

                {/* Accordion Body */}
                {isAccordionExpanded && (
                  <div id={taskBodyId} className="border-t border-white/10 px-4 py-3 text-sm text-slate-200">
                {editingTaskId === task.id ? (
                  <div className="grid gap-3">
                    <input value={editingTaskText} onChange={(event) => setEditingTaskText(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/50" />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={updateTaskMutation.isPending || !editingTaskText.trim()} onClick={() => updateTaskMutation.mutate({ task, text: editingTaskText })} className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">Save</button>
                      <button type="button" onClick={() => { setEditingTaskId(null); setEditingTaskText(''); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-end">
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {!isPsgUser ? (
                        <>
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
                        </>
                      ) : null}
                      {canAddTasks ? <button type="button" onClick={() => { setEditingTaskId(task.id); setEditingTaskText(task.text); }} className="rounded-xl border border-slate-700 bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-600">Edit stage name</button> : null}
                      {canDeleteTasks ? <button type="button" disabled={deleteTaskMutation.isPending} onClick={() => deleteTaskMutation.mutate(task)} className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50">Delete</button> : null}
                    </div>
                  </div>
                )}
                {editingTaskId !== task.id ? (
                  <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DatePickerInput
                        label="Started date"
                        value={taskStartedDateDrafts[task.id] ?? task.startedDate ?? ''}
                        onChange={(value) => setTaskStartedDateDrafts((current) => ({ ...current, [task.id]: value }))}
                        placeholder="Select started date"
                        disabled={!canEditStageDates || updateTaskMutation.isPending}
                      />
                      <DatePickerInput
                        label="Target completion"
                        value={taskDueDateDrafts[task.id] ?? task.dueDate ?? ''}
                        onChange={(value) => setTaskDueDateDrafts((current) => ({ ...current, [task.id]: value }))}
                        placeholder="Select target date"
                        disabled={!canEditStageDates || updateTaskMutation.isPending}
                      />
                    </div>
                    {canEditStageDates ? <>
                      <button
                        type="button"
                        disabled={updateTaskMutation.isPending || ((taskStartedDateDrafts[task.id] ?? task.startedDate ?? '') === (task.startedDate ?? '') && (taskDueDateDrafts[task.id] ?? task.dueDate ?? '') === (task.dueDate ?? ''))}
                        onClick={() => {
                          setTaskDateSaveMessage(null);
                          const nextStartedDate = taskStartedDateDrafts[task.id];
                          const nextDueDate = taskDueDateDrafts[task.id];
                          updateTaskMutation.mutate({
                            task,
                            startedDate: nextStartedDate !== undefined && nextStartedDate !== task.startedDate ? nextStartedDate : undefined,
                            dueDate: nextDueDate !== undefined && nextDueDate !== task.dueDate ? nextDueDate : undefined,
                          });
                        }}
                        className="w-fit rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {updateTaskMutation.isPending ? 'Saving...' : 'Save date'}
                      </button>
                      {taskDateSaveMessage ? <p className={taskDateSaveMessage === 'Saved' ? 'text-xs font-medium text-emerald-300' : 'text-xs font-medium text-red-300'}>{taskDateSaveMessage}</p> : null}
                    </> : null}
                    {taskFiles.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Attached files</p>
                        <ul className="space-y-2 text-sm text-slate-300">
                          {taskFiles.map((file) => (
                            <li key={`${task.id}-${file.path ?? file.name}`} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                              {file.path && stageImageUrls[file.path] ? <img src={stageImageUrls[file.path]} alt={file.name} className="mb-2 max-h-48 w-full rounded-lg object-contain sm:mb-0 sm:w-40" /> : null}
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
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">Stage updates</p>
                    <div className="mt-2 space-y-2">
                      {taskUpdates.length > 0 ? taskUpdates.map((c, i) => (
                        <div key={`${task.id}-comment-${c.id ?? i}`} className="rounded-2xl bg-slate-950/80 p-3">
                          <p className="text-xs text-slate-400">{c.date}</p>
                          <div className="mt-1 flex items-start justify-between gap-2">
                            <p className="font-medium text-white">{c.author}</p>
                            {c.id && (canEditOwnComment(user, c.author) || canAdministerProjectDetails) && editingCommentId !== c.id ? (
                              <button type="button" onClick={() => { setEditingCommentId(c.id ?? null); setEditingCommentDraft(c.message); }} className="text-xs font-semibold text-cyan-200 hover:text-white">Edit</button>
                            ) : null}
                          </div>
                          {editingCommentId === c.id ? (
                            <div className="mt-2 grid gap-2">
                              <textarea value={editingCommentDraft} onChange={(event) => setEditingCommentDraft(event.target.value)} rows={3} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/50" />
                              <div className="flex gap-2">
                                <button type="button" disabled={!editingCommentDraft.trim() || updateCommentMutation.isPending} onClick={() => updateCommentMutation.mutate({ commentId: c.id ?? '', message: editingCommentDraft })} className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{updateCommentMutation.isPending ? 'Saving...' : 'Save'}</button>
                                <button type="button" onClick={() => { setEditingCommentId(null); setEditingCommentDraft(''); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">Cancel</button>
                              </div>
                            </div>
                          ) : <p className="mt-1 text-slate-300">{c.message}</p>}
                        </div>
                      )) : null}
                    </div>

                    {/* Add stage update */}
                    {canAddTaskComments(user) ? (
                      <div className="mt-3 grid gap-2">
                        <textarea
                          value={taskCommentDrafts[task.id] ?? ''}
                          onChange={(e) => setTaskCommentDrafts((cur) => ({ ...cur, [task.id]: e.target.value }))}
                          rows={2}
                          placeholder="Add an update for this stage"
                          className="rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-300 focus:border-sky-400/50"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={!taskCommentDrafts[task.id]?.trim() || taskCommentMutation.isPending}
                            onClick={() => taskCommentMutation.mutate({ projectId: projectId ?? '', taskId: task.id, message: taskCommentDrafts[task.id] ?? '' })}
                            className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {taskCommentMutation.isPending ? 'Posting...' : 'Add stage update'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                </div>
                  </div>
                )}
              </div>
              );
            }) : <p className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-slate-400">No stages yet. Add the first stage to start the workflow.</p>}
          </div>

        </div>
      </section>

      <div className="mt-6 border-t border-white/10 pt-5">
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Stage checklist</p><span className="text-xs text-slate-400">{completedStageCount} of {stagePlan.length} stages</span></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedProject.tasks.length > 0 ? selectedProject.tasks.map((stageTask) => {
              const stage = stageTask.stage ?? stageTask.text;
              const taskStatus = getTaskStatus(stageTask);
              const current = stageTask.id === currentStageTask?.id;
              return (
                <div key={stageTask.id} className={`flex flex-wrap items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${taskStatus === 'done' ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100' : current ? 'border-cyan-300/50 bg-cyan-400/20 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300'}`}>
                  <button type="button" onClick={() => setExpandedAccordionTaskIds((currentIds) => currentIds.includes(stageTask.id) ? currentIds.filter((id) => id !== stageTask.id) : [...currentIds, stageTask.id])} className="text-white hover:underline">{taskStatus === 'done' ? '✓ ' : current ? '● ' : '○ '}{stage}</button>
                  {canCurrentUserCompleteTask(stageTask) ? <select value={taskStatus === 'open' || taskStatus === 'waiting' ? 'blocked' : taskStatus} disabled={updateTaskMutation.isPending} onChange={(event) => updateTaskMutation.mutate({ task: stageTask, status: event.target.value as TaskItem['status'] })} aria-label={`Status for ${stage}`} className="rounded-lg border border-white/10 bg-slate-950/40 px-1.5 py-1 text-[11px] font-semibold text-white outline-none"><option value="pending">Pending</option><option value="busy">Busy</option><option value="blocked">Delayed</option><option value="done">Completed</option></select> : <span className="rounded-lg border border-white/10 bg-slate-950/40 px-1.5 py-1 text-[11px]">{stageStatusLabels[taskStatus]}</span>}
                </div>
              );
            }) : <p className="w-full rounded-xl border border-dashed border-white/15 bg-slate-950/40 p-3 text-xs text-slate-400">No stages yet. Add the first stage below to begin tracking this branch.</p>}
          </div>
        </div>
      </div>

      {false && <section>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Updates</h3>
            <p className="mt-1 text-sm text-slate-300">Recent updates and requests for this branch rebrand.</p>
          </div>
          {unreadAnswers.length > 0 ? <span className="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">{unreadAnswers.length} new answer{unreadAnswers.length === 1 ? '' : 's'}</span> : null}
        </div>

        {canUseConversationComposer ? (
          <div className="mt-5 grid gap-3 rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-4">
            <label className="grid gap-2 text-sm text-slate-200">
              Related stage
              <select value={journalTaskId} onChange={(event) => setJournalTaskId(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50">
                <option value="">General project update</option>
                {selectedProject.tasks.map((item) => <option key={item.id} value={item.id}>{item.text}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-slate-200">
              Message
              <textarea value={commentMessage} onChange={(event) => setCommentMessage(event.target.value)} rows={3} placeholder="Share a progress update or request." className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-base leading-7 text-white outline-none placeholder:text-slate-300 focus:border-cyan-300/50 sm:text-sm sm:leading-6" />
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
            <p className="text-xs text-slate-600">One composer, two actions: save an update or send a request. Both can be linked to the same task.</p>
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
                            Target date
                            <input value={answerTargetDate} onChange={(event) => setAnswerTargetDate(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50" />
                          </label>
                          <label className="grid gap-2 text-sm text-slate-300">
                            Installation date
                            <input value={answerInstallationDate} onChange={(event) => setAnswerInstallationDate(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50" />
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={answerQuestionMutation.isPending || (!answerMessage.trim() && answerStage === selectedProject.currentStage && answerStatus === selectedProject.status && answerTargetDate === selectedProject.targetDate && answerInstallationDate === selectedProject.installationDate)} onClick={() => answerQuestionMutation.mutate(question)} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
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

      </section>}

      {user && projectHistory.length > 0 ? <section className="rounded-3xl border border-cyan-300/20 bg-cyan-500/8 p-6 shadow-soft backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Project history</h3>
          <button type="button" onClick={() => setIsProjectHistoryExpanded((expanded) => !expanded)} className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20">{isProjectHistoryExpanded ? 'Hide' : 'Show'}</button>
        </div>
        {isProjectHistoryExpanded ? <div className="mt-4 space-y-3">
          {projectHistory.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-white">{item.title}</p>
                <p className="shrink-0 text-xs text-slate-500">{item.date}</p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                {item.author ? <p className="text-xs text-cyan-200">{item.author}</p> : <span />}
                <div className="flex flex-wrap gap-2">
                  {item.commentId && (canAdministerProjectDetails || canEditOwnComment(user, item.author)) && editingCommentId !== item.commentId ? <button type="button" onClick={() => { setEditingCommentId(item.commentId ?? null); setEditingCommentDraft(item.detail); }} className="rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100">Edit</button> : null}
                  {item.commentId && (canAdministerProjectDetails || canDeleteComment(user, item.author)) ? <button type="button" disabled={deleteCommentMutation.isPending} onClick={() => { if (window.confirm('Delete this project history entry?')) { deleteCommentMutation.mutate(item.commentId ?? ''); } }} className="rounded-xl border border-red-300/35 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100 disabled:opacity-50">Delete</button> : null}
                  {item.activityKey && canAdministerProjectDetails && editingActivityKey !== item.activityKey ? <button type="button" onClick={() => { setEditingActivityKey(item.activityKey ?? null); setEditingActivityDraft(item.detail); }} className="rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100">Edit</button> : null}
                  {item.activityKey && canAdministerProjectDetails ? <button type="button" disabled={deleteActivityMutation.isPending} onClick={() => { if (window.confirm('Delete this project history entry?')) { deleteActivityMutation.mutate({ date: item.date, title: item.title, detail: item.detail }); } }} className="rounded-xl border border-red-300/35 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100 disabled:opacity-50">Delete</button> : null}
                </div>
              </div>
              {editingCommentId === item.commentId ? <div className="mt-2 grid gap-2"><textarea value={editingCommentDraft} onChange={(event) => setEditingCommentDraft(event.target.value)} rows={3} className="rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none" /><div className="flex gap-2"><button type="button" disabled={!editingCommentDraft.trim() || updateCommentMutation.isPending} onClick={() => updateCommentMutation.mutate({ commentId: item.commentId ?? '', message: editingCommentDraft })} className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white">Save</button><button type="button" onClick={() => { setEditingCommentId(null); setEditingCommentDraft(''); }} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200">Cancel</button></div></div> : editingActivityKey === item.activityKey ? <div className="mt-2 grid gap-2"><textarea value={editingActivityDraft} onChange={(event) => setEditingActivityDraft(event.target.value)} rows={3} className="rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none" /><div className="flex gap-2"><button type="button" disabled={!editingActivityDraft.trim() || updateActivityMutation.isPending} onClick={() => updateActivityMutation.mutate({ date: item.date, title: item.title, detail: item.detail, message: editingActivityDraft })} className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white">Save</button><button type="button" onClick={() => { setEditingActivityKey(null); setEditingActivityDraft(''); }} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200">Cancel</button></div></div> : <p className="mt-2 text-sm text-slate-200">{item.detail}</p>}
            </div>
          ))}
        </div> : null}
      </section> : null}

    </div>
  );
}
