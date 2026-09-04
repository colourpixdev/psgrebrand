import { supabase } from '../lib/supabase';
import type { ActivityItem, CommentItem, Project, ProjectFile, ProjectStatus, ProjectTemplateId, Role, TaskAssignee, TaskItem, TaskStatus, UserRecord } from '../types/domain';
import { defaultWorkspace, isPlatformOwnerEmail, rolloutAppEmail } from '../constants/workspaces';
import { canonicalizeProjectStageName, defaultProjectTemplate, getProjectTemplate, isHiddenLegacyProjectStage, mergeDefaultLifecycleTasks } from '../constants/projectTemplates';
import { createTaskFromPool } from '../constants/taskPool';
import { createNextProjectId } from '../utils/branchProjectIds';
import { taskStatusFromDatabase, taskStatusToDatabase } from '../utils/taskStatus';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeTaskTitle(value: string) {
  return value.trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function workflowStageKeyForTaskTitle(title: string) {
  const keyByTitle: Record<string, string> = {
    'site inspection': 'site_information',
    'layout brief': 'design_artwork',
    'signed brief': 'psg_approval',
    quote: 'quote',
    invoice: 'quote',
    'production and installation': 'production',
  };
  return keyByTitle[normalizeTaskTitle(title)] ?? 'site_information';
}

export interface PortalSummary {
  metrics: Array<{ label: string; value: number }>;
  recentActivity: ActivityItem[];
  todayTasks: string[];
}

type ProjectRow = {
  id: string;
  workspace_id?: string | null;
  rebrand_workspace_id?: string | null;
  workspace_name?: string | null;
  client_company?: string | null;
  graphics_partner?: string | null;
  project_type?: string | null;
  project_type_name?: string | null;
  site_label?: string | null;
  branch_id?: string | null;
  branch_code?: string | null;
  branch?: string | null;
  province?: string | null;
  town?: string | null;
  physical_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  manager: string;
  manager_email: string;
  designer: string;
  current_stage: string;
  report_stage_task_id?: string | null;
  status: Project['status'];
  project_start_date?: string | null;
  target_date: string;
  brief_requested_date?: string | null;
  installation_date: string;
  completion_date: string;
  updated_at: string;
  progress: number | null;
  branch_manager_view_only: boolean | null;
  notes: string | null;
  files: unknown[] | null;
  tasks: unknown[] | null;
  comments: CommentItem[] | null;
  activity: ActivityItem[] | null;
};

async function hydrateAuthSession() {
  await supabase?.auth.getSession();
}

type ProjectTaskRow = {
  id: string;
  workspace_id: string;
  stage_id?: string | null;
  title: string;
  description?: string | null;
  status: 'not_started' | 'in_progress' | 'complete' | 'waiting' | 'blocked';
  priority: 'normal' | 'important' | 'urgent';
  sort_order: number;
  started_date?: string | null;
  due_date?: string | null;
  responsible_group_id?: string | null;
  responsible_person_id?: string | null;
  responsible_person?: { name?: string | null; email?: string | null; profile_title?: string | null } | Array<{ name?: string | null; email?: string | null; profile_title?: string | null }> | null;
  required_action: string;
  waiting_reason?: string | null;
  blocker_reason?: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

type TaskAssigneeRow = {
  task_id: string;
  profile_id?: string | null;
  name?: string | null;
  email?: string | null;
  profile_title?: string | null;
};

function convertRelationalTaskToTaskItem(taskRow: ProjectTaskRow): TaskItem {
  const status = taskRow.status;
  const completed = status === 'complete';
  const isWaiting = status === 'waiting';
  const isBlocked = status === 'blocked';
  const responsiblePerson = Array.isArray(taskRow.responsible_person) ? taskRow.responsible_person[0] : taskRow.responsible_person;

  return {
    id: taskRow.id,
    text: taskRow.title || '<Untitled Task>',
    completed,
    status: taskStatusFromDatabase(status),
    stage: taskRow.title || undefined,
    dueDate: taskRow.due_date ?? undefined,
    assigneeId: taskRow.responsible_person_id ?? undefined,
    assigneeName: responsiblePerson?.name ?? undefined,
    assigneeEmail: responsiblePerson?.email ?? undefined,
    assignees: responsiblePerson?.name && responsiblePerson.email ? [{ id: taskRow.responsible_person_id ?? undefined, name: responsiblePerson.name, email: responsiblePerson.email, designation: responsiblePerson.profile_title ?? '' }] : undefined,
    startedDate: taskRow.started_date ?? undefined,
    installationRequest: isWaiting ? (taskRow.waiting_reason || 'Waiting for details') : isBlocked ? (taskRow.blocker_reason || 'Blocked') : undefined,
    createdAt: taskRow.created_at,
    completedAt: status === 'complete' ? taskRow.updated_at : undefined,
    completedByName: status === 'complete' ? 'System' : undefined,
    completedByEmail: status === 'complete' ? undefined : undefined,
    sortOrder: taskRow.sort_order ?? undefined,
  };
}

type RelationalReadResult<T> = {
  data: T;
  available: boolean;
};

async function getWorkspaceTasks(workspaceId: string): Promise<RelationalReadResult<TaskItem[]>> {
  const client = supabase;

  if (!client) {
    return { data: [], available: false };
  }

  await hydrateAuthSession();

  const { data, error } = await client
    .from('project_tasks')
    .select('*, responsible_person:profiles!project_tasks_responsible_person_id_fkey(name, email, profile_title)')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });

  if (error || !data) {
    return { data: [], available: false };
  }

  const { data: assignees } = await client.rpc('get_rebrand_task_assignees', { workspace_uuid: workspaceId });
  const assigneeByTaskId = new Map(((assignees ?? []) as TaskAssigneeRow[]).map((assignee) => [assignee.task_id, assignee]));

  return { data: (data as ProjectTaskRow[]).map((taskRow) => convertRelationalTaskToTaskItem({
    ...taskRow,
    responsible_person: assigneeByTaskId.get(taskRow.id) ?? taskRow.responsible_person ?? null,
  })), available: true };
}

const projectFilesBucket = 'project-files';
const voiceUpdatesBucket = 'voice-updates';
const projectsStorageKey = 'psg-rebrand:projects';
const maxProjectFileSize = 25 * 1024 * 1024;
const maxVoiceUpdateSize = 50 * 1024 * 1024;
const allowedProjectFileTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'application/postscript',
  'application/illustrator',
  'application/dwg',
  'application/x-dwg',
  'application/acad',
  'application/x-acad',
  'application/autocad_dwg',
  'drawing/x-dwg',
  'image/vnd.dwg',
  'image/x-dwg',
]);
const allowedProjectFileExtensions = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'webp', 'dwg', 'ai']);
const allowedVoiceUpdateTypes = new Set([
  'audio/aac',
  'audio/m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'video/mp4',
]);

type RelationalProjectFileRow = {
  id: string;
  workspace_id: string;
  task_id?: string | null;
  display_name: string;
  current_version_id?: string | null;
  created_at: string;
  file_version?: {
    id: string;
    storage_path: string;
    mime_type?: string | null;
    size_bytes?: number | null;
    uploaded_at: string;
  } | null;
};

function convertRelationalFileToProjectFile(fileRow: RelationalProjectFileRow, version?: RelationalProjectFileRow['file_version']): ProjectFile {
  return {
    id: fileRow.id,
    name: fileRow.display_name,
    path: version?.storage_path,
    size: typeof version?.size_bytes === 'number' ? version.size_bytes : undefined,
    type: version?.mime_type ?? undefined,
    uploadedAt: version?.uploaded_at ?? fileRow.created_at,
    taskId: fileRow.task_id ?? undefined,
  };
}

async function getCurrentProfileId() {
  const client = supabase;
  if (!client) return null;

  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data: profile } = await client.from('profiles').select('id').eq('user_id', userId).maybeSingle();
  return profile?.id ?? null;
}

async function getProfileIdByEmail(email?: string) {
  if (!email) return null;
  const { data: profile } = await supabase?.from('profiles').select('id').ilike('email', email.trim().toLowerCase()).maybeSingle() ?? { data: null };
  return profile?.id ?? null;
}

type ProjectActivityInput = {
  eventType: 'project_updated' | 'task_status_changed' | 'file_uploaded' | 'file_updated';
  entityType: string;
  entityId?: string;
  workspaceId: string;
  projectId: string;
  taskId?: string;
  actorId?: string | null;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

async function recordProjectActivity(input: ProjectActivityInput) {
  const client = supabase;
  if (!client) return;

  await client.from('project_activity').insert({
    workspace_id: input.workspaceId,
    actor_id: input.actorId ?? null,
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    source: 'user',
    old_values: input.oldValues ?? null,
    new_values: input.newValues ?? null,
    metadata: { ...input.metadata, project_id: input.projectId, ...(input.taskId ? { task_id: input.taskId } : {}) },
  });
}

async function recordProjectFileActivity(projectId: string, workspaceId: string, eventType: 'file_uploaded' | 'file_updated', fileId: string, taskId?: string, metadata: Record<string, unknown> = {}) {
  await recordProjectActivity({ eventType, entityType: 'project_file', entityId: fileId, workspaceId, projectId, taskId, metadata });
}

async function getWorkspaceFiles(workspaceId: string): Promise<ProjectFile[] | null> {
  const filesByWorkspace = await getWorkspaceFilesForWorkspaces([workspaceId]);
  return filesByWorkspace.has(workspaceId) ? filesByWorkspace.get(workspaceId) ?? null : null;
}

async function getWorkspaceFilesForWorkspaces(workspaceIds: string[]): Promise<Map<string, ProjectFile[] | null>> {
  const client = supabase;
  const filesByWorkspace = new Map<string, ProjectFile[] | null>();
  if (!client || workspaceIds.length === 0) return filesByWorkspace;

  const { data, error } = await client
    .from('project_files')
    .select('id, workspace_id, task_id, display_name, current_version_id, created_at')
    .in('workspace_id', workspaceIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error || !data) {
    workspaceIds.forEach((workspaceId) => filesByWorkspace.set(workspaceId, null));
    return filesByWorkspace;
  }

  const versionIds = data.map((file) => file.current_version_id).filter((id): id is string => Boolean(id));
  const { data: versions } = versionIds.length > 0
    ? await client.from('file_versions').select('id, storage_path, mime_type, size_bytes, uploaded_at').in('id', versionIds)
    : { data: [] };
  const versionsById = new Map((versions ?? []).map((version) => [version.id, version]));

  workspaceIds.forEach((workspaceId) => filesByWorkspace.set(workspaceId, []));
  (data as RelationalProjectFileRow[]).forEach((file) => {
    const workspaceFiles = filesByWorkspace.get(file.workspace_id) ?? [];
    workspaceFiles.push(convertRelationalFileToProjectFile(file, file.current_version_id ? versionsById.get(file.current_version_id) : undefined));
    filesByWorkspace.set(file.workspace_id, workspaceFiles);
  });

  return filesByWorkspace;
}

async function resolveProjectWorkspaceId(projectRow: ProjectRow): Promise<string | null> {
  const client = supabase;
  if (!client) return projectRow.rebrand_workspace_id ?? null;
  if (projectRow.rebrand_workspace_id) return projectRow.rebrand_workspace_id;
  if (!projectRow.branch_id) return null;

  const { data, error } = await client
    .from('rebrand_workspaces')
    .select('id')
    .eq('branch_id', projectRow.branch_id)
    .eq('is_primary', true)
    .maybeSingle();

  if (error || !data?.id) return null;
  return data.id;
}

async function hydrateProjectFiles(projects: Project[]): Promise<Project[]> {
  const client = supabase;
  if (!client || projects.length === 0) return projects;

  const workspaceIds = [...new Set(projects
    .map((project) => project.workspaceId)
    .filter((workspaceId): workspaceId is string => Boolean(workspaceId) && workspaceId !== defaultWorkspace.id))];
  const filesByWorkspace = await getWorkspaceFilesForWorkspaces(workspaceIds);

  return projects.map((project) => {
    if (!project.workspaceId || project.workspaceId === defaultWorkspace.id) return project;

    const files = filesByWorkspace.get(project.workspaceId) ?? null;
    return applyRelationalProjectData(project, {
      workspaceId: project.workspaceId,
      files,
      filesAvailable: files !== null && (files.length > 0 || project.files.length === 0),
    });
  });
}

function createTaskId() {
  return globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createQuestionId() {
  return globalThis.crypto?.randomUUID?.() ?? `question-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'upload';
}

function validateProjectFile(file: File) {
  if (file.size > maxProjectFileSize) {
    throw new Error('File is too large. Upload files up to 25 MB.');
  }

  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : undefined;
  if (!allowedProjectFileExtensions.has(extension ?? '') || file.type && !allowedProjectFileTypes.has(file.type) && file.type !== 'application/octet-stream') {
    throw new Error('Unsupported file type. Upload PDF, DOCX, XLSX, JPG, PNG, DWG, or AI files.');
  }
}

function validateVoiceUpdateFile(file: File) {
  if (file.size > maxVoiceUpdateSize) {
    throw new Error('Voice note is too large. Upload audio files up to 50 MB.');
  }

  if (file.type && !allowedVoiceUpdateTypes.has(file.type)) {
    throw new Error('Unsupported voice note type. Upload M4A, MP3, WAV, OGG, WebM, AAC, or MP4 audio.');
  }
}

export type CreateProjectInput = {
  id?: string;
  workspaceName?: string;
  clientCompany?: string;
  graphicsPartner?: string;
  projectType?: ProjectTemplateId;
  branchId?: string;
  branchCode?: string;
  branch: string;
  province?: string;
  town?: string;
  physicalAddress: string;
  manager?: string;
  managerEmail?: string;
  installer?: string;
  designer?: string;
  currentStage: Project['currentStage'];
  status: Project['status'];
  targetDate?: string;
  briefRequestedDate?: string;
  installationDate?: string;
  completionDate?: string;
  progress?: number;
  notes?: string;
  selectedTaskIds?: string[];
};

type ProjectChangeNotificationInput = {
  project: Project;
  actor: string;
  message: string;
  changeType: 'note' | 'voice_note' | 'voice_update';
};

function workspaceIdFromName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || defaultWorkspace.id;
}

function optionalProjectValue(value: string | undefined, fallback = 'Not captured') {
  return value?.trim() || fallback;
}

function readLocalProjects(): ProjectRow[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(projectsStorageKey);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as ProjectRow[]) : [];
  } catch {
    return [];
  }
}

function writeLocalProjects(projects: ProjectRow[]) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(projectsStorageKey, JSON.stringify(projects));
}

function shouldFallbackToLocal(errorMessage: string | undefined) {
  if (!errorMessage) {
    return false;
  }

  const normalizedMessage = errorMessage.toLowerCase();
  return [
    'row-level security',
    'permission denied',
    'jwt',
    'auth',
    'network',
    'fetch',
    'failed to fetch',
    'not configured',
    'does not exist',
    'could not find',
  ].some((token) => normalizedMessage.includes(token));
}

function isMissingProjectColumnError(errorMessage: string | undefined) {
  if (!errorMessage) {
    return false;
  }

  const normalizedMessage = errorMessage.toLowerCase();
  return [
    'branch',
    'branch_id',
    'province',
    'town',
    'physical_address',
    'latitude',
    'longitude',
    'workspace_id',
    'workspace_name',
    'client_company',
    'graphics_partner',
    'project_type',
    'project_type_name',
    'site_label',
    'branch_code',
    'brief_requested_date',
  ].some((column) => normalizedMessage.includes(column));
}

function stripProjectPresentationColumns<T extends Record<string, unknown>>(payload: T) {
  const {
    latitude,
    longitude,
    brief_requested_date,
    ...legacyPayload
  } = payload;

  return legacyPayload;
}

function stripLegacyProjectColumns<T extends Record<string, unknown>>(payload: T) {
  const {
    branch_id,
    branch_code,
    latitude,
    longitude,
    workspace_id,
    workspace_name,
    client_company,
    graphics_partner,
    project_type,
    project_type_name,
    site_label,
    brief_requested_date,
    ...legacyPayload
  } = payload;

  return legacyPayload;
}

async function geocodePhysicalAddress(input: CreateProjectInput) {
  const physicalAddress = input.physicalAddress.trim();
  if (!physicalAddress) {
    throw new Error('Exact physical address is required for map placement.');
  }

  const query = [physicalAddress, input.town, input.province]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ format: 'jsonv2', limit: '1', q: query }).toString()}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('The address lookup service is unavailable. Try again before saving the project.');
  }

  const results = await response.json() as Array<{ lat?: string; lon?: string }>;
  const latitude = Number(results[0]?.lat);
  const longitude = Number(results[0]?.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('The exact physical address could not be found on the map. Add a more complete street address, suburb, town, province, and country.');
  }

  return { physicalAddress, latitude, longitude };
}

function isVoiceNoteMessage(message: string) {
  return message.trim().toLowerCase().startsWith('voice note:');
}



// Local retry queue for failed function notifications. Stored as an array of payloads.
const notificationQueueKey = 'psg-rebrand:fn-notifications';

function enqueueFailedNotification(payload: unknown) {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(notificationQueueKey);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ payload, ts: Date.now() });
    localStorage.setItem(notificationQueueKey, JSON.stringify(queue));
  } catch (err) {
    console.warn('Failed to enqueue notification for retry.', err);
  }
}

// Email notifications are disabled by default. The app can still add comments and updates
// without attempting to send notification emails from the client.
let notificationDeliveryEnabled = false;
let notificationDeliveryDisabledReason: string | null = null;

function toErrorString(value: unknown) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === 'object' && value !== null && 'message' in value && typeof (value as any).message === 'string') {
    return (value as any).message;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function shouldDisableNotificationDelivery(error: unknown) {
  const message = toErrorString(error).toLowerCase();
  return [
    'not_found',
    'not found',
    '404',
    'function was not found',
    'deploy',
    'missing',
  ].some((term) => message.includes(term));
}

function disableNotificationDelivery(reason: string) {
  notificationDeliveryEnabled = false;
  notificationDeliveryDisabledReason = reason;
  console.warn('Project notification delivery disabled:', reason);
}

async function flushNotificationQueue(client: typeof supabase) {
  if (!client) return;
  if (typeof localStorage === 'undefined') return;

  try {
    const raw = localStorage.getItem(notificationQueueKey);
    const queue: Array<{ payload: unknown; ts: number }> = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(queue) || queue.length === 0) return;

    const remaining: Array<{ payload: unknown; ts: number }> = [];
    for (const item of queue) {
      try {
        const { error } = await client.functions.invoke('notify-project-change', { body: item.payload as any });
        if (error) {
          const errorMessage = toErrorString(error);
          if (shouldDisableNotificationDelivery(errorMessage)) {
            disableNotificationDelivery(errorMessage);
            break;
          }
          console.warn('Queued notification failed to send.', errorMessage);
          remaining.push(item);
        }
      } catch (err) {
        const errorMessage = toErrorString(err);
        if (shouldDisableNotificationDelivery(errorMessage)) {
          disableNotificationDelivery(errorMessage);
          break;
        }
        console.warn('Queued notification failed to send.', errorMessage);
        remaining.push(item);
      }
    }

    if (remaining.length === 0) {
      localStorage.removeItem(notificationQueueKey);
    } else {
      localStorage.setItem(notificationQueueKey, JSON.stringify(remaining));
    }
  } catch (err) {
    console.warn('Failed to flush notification queue.', err);
  }
}

// Replace notifyProjectChange with a non-blocking, resilient implementation that
// attempts the function call but never blocks the caller. Failed attempts are
// enqueued for retry and the queue is flushed after successful sends.
async function notifyProjectChange(input: ProjectChangeNotificationInput) {
  const client = supabase;

  if (!client || !notificationDeliveryEnabled) {
    return;
  }

  const payload = {
    to: rolloutAppEmail,
    changeType: input.changeType,
    actor: input.actor,
    message: input.message,
    project: {
      id: input.project.id,
      branchId: input.project.branchId,
      currentStage: input.project.currentStage,
      status: input.project.status,
    },
  } as const;

  // Fire-and-forget invocation so UI actions aren't blocked by network/CORS issues.
  (async () => {
    try {
      const { error } = await client.functions.invoke('notify-project-change', { body: payload });
      if (error) {
        const errorMessage = toErrorString(error);
        if (shouldDisableNotificationDelivery(errorMessage)) {
          disableNotificationDelivery(errorMessage);
          return;
        }
        console.warn('Project notification email could not be sent.', errorMessage);
        enqueueFailedNotification(payload);
        return;
      }

      // On success attempt to flush any previously queued notifications.
      await flushNotificationQueue(client);
    } catch (err) {
      const errorMessage = toErrorString(err);
      if (shouldDisableNotificationDelivery(errorMessage)) {
        disableNotificationDelivery(errorMessage);
        return;
      }
      console.warn('Project notification email could not be sent.', errorMessage);
      enqueueFailedNotification(payload);
    }
  })();

  return;
}

export type UpdateProjectWorkflowInput = {
  projectId: string;
  currentStage: Project['currentStage'];
  status: Project['status'];
  progress: number;
  actor: string;
};

export type UpdateProjectSummaryInput = {
  projectId: string;
  actor: string;
  currentStage: Project['currentStage'];
  reportStageTaskId?: string;
  currentTaskId?: string;
  status: Project['status'];
  progress?: number;
  projectStartDate?: string;
  targetDate?: string;
  briefRequestedDate: string;
  installationDate: string;
  completionDate?: string;
  manager?: string;
  managerEmail?: string;
};

export type AddProjectCommentInput = {
  projectId: string;
  author: string;
  message: string;
  taskId?: string;
};

export type UpdateProjectCommentInput = {
  projectId: string;
  commentId: string;
  author: string;
  actorRole?: Role;
  actorEmail?: string;
  message: string;
};

export type DeleteProjectCommentInput = {
  projectId: string;
  commentId: string;
  author: string;
  actorRole?: Role;
  actorEmail?: string;
};

export type UpdateProjectActivityInput = {
  projectId: string;
  actor: string;
  date: string;
  title: string;
  detail: string;
  message: string;
};

export type DeleteProjectActivityInput = {
  projectId: string;
  date: string;
  title: string;
  detail: string;
};

export type AskProjectQuestionInput = {
  projectId: string;
  author: string;
  authorEmail: string;
  message: string;
  taskId?: string;
};

export type AnswerProjectQuestionInput = {
  projectId: string;
  questionId: string;
  actor: string;
  answer?: string;
  currentStage?: Project['currentStage'];
  status?: Project['status'];
  progress?: number;
  targetDate?: string;
  briefRequestedDate?: string;
  installationDate?: string;
  completionDate?: string;
};

export type MarkProjectQuestionReadInput = {
  projectId: string;
  questionId: string;
};

export type AddProjectTaskInput = {
  projectId: string;
  task: string;
  actor: string;
  stage?: Project['currentStage'];
  assigneeName?: string;
  assigneeEmail?: string;
  assignees?: TaskAssignee[];
};

export type UpdateProjectTaskInput = {
  projectId: string;
  taskId: string;
  taskText?: string;
  text?: string;
  completed?: boolean;
  status?: TaskItem['status'];
  dueDate?: string;
  stage?: Project['currentStage'];
  assigneeName?: string;
  assigneeEmail?: string;
  assignees?: TaskAssignee[];
  startedDate?: string;
  installationRequest?: string;
  actor: string;
  actorEmail?: string;
  handoffAfterCompletion?: TaskAssignee;
};

export type ReorderProjectTaskInput = {
  projectId: string;
  taskId: string;
  direction: 'up' | 'down';
  actor: string;
};

export type UpsertProjectStageTaskInput = {
  projectId: string;
  taskId?: string;
  stage: Project['currentStage'];
  actor: string;
  completed?: boolean;
  assigneeName?: string;
  assigneeEmail?: string;
  assignees?: TaskAssignee[];
};

export type RenameProjectFileInput = {
  projectId: string;
  filePath?: string;
  currentName: string;
  nextName: string;
  actor: string;
};

export type DeleteProjectFileInput = {
  projectId: string;
  filePath?: string;
  fileName: string;
  actor: string;
};

export type DeleteProjectTaskInput = {
  projectId: string;
  taskId: string;
  actor: string;
};

export type ApplyProjectVoiceUpdateInput = {
  projectId: string;
  actor: string;
  currentStage?: Project['currentStage'];
  status?: Project['status'];
  progress?: number;
  targetDate?: string;
  installationDate?: string;
  completionDate?: string;
  comment?: string;
  tasks?: string[];
};

export type UploadVoiceUpdateAudioResult = {
  path: string;
  name: string;
};

function todayLabel() {
  const date = new Date();
  const formatter = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  const month = parts.find((part) => part.type === 'month')?.value ?? 'August';
  const year = parts.find((part) => part.type === 'year')?.value ?? '2026';
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '15';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '32';

  return `${day} ${month} ${year} • ${hour}:${minute} SAST`;
}

function createActivity(title: string, detail: string, type: ActivityItem['type'] = 'info'): ActivityItem {
  return {
    date: todayLabel(),
    title,
    detail,
    type,
  };
}

function createStructuredComment(project: Project, author: string, message: string, taskId?: string) {
  const linkedTask = taskId ? project.tasks.find((t) => t.id === taskId) : undefined;

  const trimmed = message.trim();

  const comment: CommentItem = {
    id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'comment',
    date: todayLabel(),
    author,
    message: trimmed,
    taskId: linkedTask?.id,
  };

  const activity = [
    createActivity(
      'Project update',
      linkedTask ? `${author} added an update on "${linkedTask.text}": ${trimmed}` : `${author} added a journal entry.`,
    ),
    ...project.activity,
  ];

  const changeType: ProjectChangeNotificationInput['changeType'] = isVoiceNoteMessage(trimmed) ? 'voice_note' : 'note';

  return { comment, comments: [comment, ...project.comments], activity, changeType } as const;
}

function summarizeAssignees(assignees?: TaskAssignee[]) {
  if (!assignees || assignees.length === 0) {
    return 'unassigned';
  }

  return assignees.map((assignee) => assignee.name).join(', ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function mapLegacyTasks(rows: unknown[] | null | undefined): TaskItem[] {
  const tasks: TaskItem[] = [];

  for (const row of rows ?? []) {
    if (!isRecord(row)) {
      continue;
    }

    const rawStatus = typeof row.status === 'string' ? row.status : undefined;
    const status: TaskStatus = rawStatus === 'pending' || rawStatus === 'busy' || rawStatus === 'done'
      ? rawStatus
      : rawStatus === 'open' || rawStatus === 'waiting' || rawStatus === 'blocked'
        ? 'busy'
        : row.completed === true
          ? 'done'
          : 'pending';

    const rawTaskText = typeof row.text === 'string' ? row.text : '';
    const rawStageName = typeof row.stage === 'string' ? row.stage : rawTaskText;
    const canonicalStage = canonicalizeProjectStageName(rawStageName);

    if (!rawTaskText.trim() || !canonicalStage || isHiddenLegacyProjectStage(canonicalStage) || isHiddenLegacyProjectStage(rawStageName)) {
      continue;
    }

    tasks.push({
      id: typeof row.id === 'string' ? row.id : `legacy-task-${tasks.length}`,
      text: rawTaskText,
      completed: row.completed === true,
      status,
      stage: canonicalStage,
      assigneeName: typeof row.assigneeName === 'string' ? row.assigneeName : undefined,
      assigneeEmail: typeof row.assigneeEmail === 'string' ? row.assigneeEmail : undefined,
      assignees: Array.isArray(row.assignees) ? row.assignees as TaskAssignee[] : undefined,
      startedDate: typeof row.startedDate === 'string' ? row.startedDate : undefined,
      dueDate: typeof row.dueDate === 'string' ? row.dueDate : undefined,
      completedAt: typeof row.completedAt === 'string' ? row.completedAt : undefined,
    });
  }

  return tasks;
}

function mapLegacyFiles(rows: unknown[] | null | undefined): ProjectFile[] {
  return (rows ?? []).filter(isRecord).map((row, index) => ({
    id: typeof row.id === 'string' ? row.id : `legacy-file-${index}`,
    name: typeof row.name === 'string' ? row.name : '',
    path: typeof row.path === 'string' ? row.path : undefined,
    size: typeof row.size === 'number' ? row.size : undefined,
    type: typeof row.type === 'string' ? row.type : undefined,
    uploadedAt: typeof row.uploadedAt === 'string' ? row.uploadedAt : undefined,
    taskId: typeof row.taskId === 'string' ? row.taskId : undefined,
  })).filter((file) => file.name.trim().length > 0);
}

function mapProjectRow(row: ProjectRow): Project {
  const template = getProjectTemplate(row.project_type ?? undefined);
  const mappedBranchId = typeof row.branch_id === 'string' && row.branch_id.trim().length > 0
    ? row.branch_id
    : typeof row.branch === 'string' && row.branch.trim().length > 0
      ? row.branch
      : 'unassigned';
  const mappedBranch = typeof row.branch === 'string' && row.branch.trim().length > 0
    ? row.branch
    : typeof row.branch_id === 'string' && row.branch_id.trim().length > 0
      ? row.branch_id
      : 'Unassigned';

  const status: ProjectStatus = row.status;

  const legacyTasks = mapLegacyTasks(row.tasks);
  const currentStage = typeof row.current_stage === 'string'
    ? canonicalizeProjectStageName(row.current_stage)
    : template.name;

  return {
    id: row.id ?? 'unknown-project',
    branchId: mappedBranchId,
    branchCode: typeof row.branch_code === 'string' ? row.branch_code : undefined,
    branch: mappedBranch,
    workspaceId: row.rebrand_workspace_id ?? defaultWorkspace.id,
    workspaceName: row.workspace_name ?? defaultWorkspace.name,
    clientCompany: row.client_company ?? defaultWorkspace.clientCompany,
    graphicsPartner: row.graphics_partner ?? defaultWorkspace.graphicsPartner,
    projectType: template.id,
    projectTypeName: row.project_type_name ?? template.name,
    siteLabel: row.site_label ?? template.siteLabel,
    province: row.province ?? 'Not captured',
    town: row.town ?? 'Not captured',
    physicalAddress: row.physical_address ?? '',
    latitude: typeof row.latitude === 'number' ? row.latitude : null,
    longitude: typeof row.longitude === 'number' ? row.longitude : null,
    manager: row.manager ?? 'Unknown manager',
    managerEmail: row.manager_email ?? '',
    designer: row.designer ?? '',
    currentStage: currentStage as Project['currentStage'],
    reportStageTaskId: row.report_stage_task_id ?? undefined,
    status,
    projectStartDate: row.project_start_date ?? '',
    targetDate: row.target_date ?? '',
    briefRequestedDate: row.brief_requested_date ?? '',
    installationDate: row.installation_date ?? '',
    completionDate: row.completion_date ?? '',
    updatedAt: row.updated_at ?? new Date().toISOString(),
    progress: typeof row.progress === 'number' ? row.progress : 0,
    branchManagerViewOnly: Boolean(row.branch_manager_view_only),
    notes: row.notes ?? '',
    files: mapLegacyFiles(row.files),
    tasks: legacyTasks,
    comments: Array.isArray(row.comments)
      ? row.comments.map((comment, index) => ({
        ...comment,
        id: comment.id ?? `legacy-comment-${index}`,
      }))
      : [],
    activity: Array.isArray(row.activity) ? row.activity : [],
  };
}

type RelationalProjectData = {
  workspaceId: string;
  tasks?: TaskItem[];
  tasksAvailable?: boolean;
  files?: ProjectFile[] | null;
  filesAvailable?: boolean;
};

function applyRelationalProjectData(project: Project, data: RelationalProjectData): Project {
  const relationalTasks = (data.tasksAvailable === false || data.tasks === undefined ? [] : data.tasks)
    .map((task) => ({
      ...task,
      stage: task.stage ? canonicalizeProjectStageName(task.stage) : task.stage,
      text: task.text.trim(),
    }))
    .filter((task) => Boolean(task.text))
    .filter((task, index, tasks) => tasks.findIndex((candidate) => normalizeTaskTitle(candidate.text) === normalizeTaskTitle(task.text)) === index);
  const relationalTaskNames = new Set(relationalTasks.map((task) => task.text.trim().toLowerCase()));
  const nextTasks = data.tasksAvailable === false || data.tasks === undefined
    ? project.tasks
    : [...relationalTasks, ...project.tasks.filter((task) => !relationalTaskNames.has(task.text.trim().toLowerCase()))];
  const legacyTaskIdToRelationalId = new Map<string, string>();
  const unmatchedTasks = [...nextTasks];

  project.tasks.forEach((legacyTask) => {
    const legacyTaskIndex = unmatchedTasks.findIndex((task) => normalizeTaskTitle(task.text) === normalizeTaskTitle(legacyTask.text));
    if (legacyTaskIndex >= 0) {
      const relationalTask = unmatchedTasks[legacyTaskIndex];
      legacyTaskIdToRelationalId.set(legacyTask.legacyTaskId ?? legacyTask.id, relationalTask.id);
      relationalTask.legacyTaskId = legacyTask.legacyTaskId ?? legacyTask.id;
      unmatchedTasks.splice(legacyTaskIndex, 1);
    }
  });

  nextTasks.forEach((task) => {
    if (task.legacyTaskId) {
      legacyTaskIdToRelationalId.set(task.legacyTaskId, task.id);
    }
  });

  const relationalFiles = data.filesAvailable === false || data.files === undefined || data.files === null ? null : data.files;
  const nextFiles = relationalFiles === null
    ? project.files
    : [
      ...relationalFiles.map((file) => {
        const legacyFile = project.files.find((candidate) => (
          file.id && candidate.id === file.id
          || file.path && candidate.path === file.path
        ));
        return file.taskId || !legacyFile?.taskId ? file : { ...file, taskId: legacyFile.taskId };
      }),
      ...project.files.filter((legacyFile) => !relationalFiles.some((file) => (
        file.path && legacyFile.path === file.path
        || file.id && legacyFile.id === file.id
      ))),
    ];
  const remapFileTaskIds = (files: ProjectFile[]) => files.map((file) => file.taskId && legacyTaskIdToRelationalId.has(file.taskId)
    ? { ...file, taskId: legacyTaskIdToRelationalId.get(file.taskId) }
    : file);

  return {
    ...project,
    workspaceId: data.workspaceId,
    tasks: nextTasks,
    comments: legacyTaskIdToRelationalId.size > 0
      ? project.comments.map((comment) => comment.taskId && legacyTaskIdToRelationalId.has(comment.taskId)
        ? { ...comment, taskId: legacyTaskIdToRelationalId.get(comment.taskId) }
        : comment)
      : project.comments,
    files: remapFileTaskIds(nextFiles),
  };
}

export async function getPortalSummary(): Promise<PortalSummary> {
  const client = supabase;

  if (!client) {
    return {
      metrics: [],
      recentActivity: [],
      todayTasks: [],
    };
  }

  await hydrateAuthSession();

  const { data, error } = await client.from('projects').select('status, activity, branch_id');

  if (error || !data) {
    return {
      metrics: [],
      recentActivity: [],
      todayTasks: [],
    };
  }

  const totalProjects = data.length;
  const completed = data.filter((row) => row.status === 'completed').length;
  const inProgress = data.filter((row) => ['busy', 'in_progress', 'awaiting_approval'].includes(row.status)).length;
  const delayed = data.filter((row) => row.status === 'delayed').length;
  const recentActivity = data.flatMap((row) => row.activity ?? []).slice(0, 4);

  // Fetch relational tasks for today's task calculation
  let todayTasks: string[] = [];
  try {
    const branchIds = [...new Set(
      data
        .filter((p) => p.branch_id && typeof p.branch_id === 'string')
        .map((p) => p.branch_id)
    )];

    if (branchIds.length > 0) {
      // Fetch workspaces for these branches
      const { data: workspaces } = await client
        .from('rebrand_workspaces')
        .select('id')
        .in('branch_id', branchIds)
        .eq('is_primary', true);

      if (workspaces && workspaces.length > 0) {
        const workspaceIds = workspaces.map((w) => w.id);
        
        // Fetch incomplete tasks (today's tasks)
        const { data: allTasks } = await client
          .from('project_tasks')
          .select('title')
          .in('workspace_id', workspaceIds)
          .in('status', ['not_started', 'in_progress', 'waiting'])
          .is('deleted_at', null);

        if (allTasks && allTasks.length > 0) {
          todayTasks = [...new Set(
            allTasks
              .map((t) => (t as any).title || '<Untitled Task>')
              .filter((t) => t.trim().length > 0)
          )].slice(0, 3);
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch relational tasks for today.', error);
  }

  return {
    metrics: [
      { label: 'Projects', value: totalProjects },
      { label: 'Completed', value: completed },
      { label: 'In Progress', value: inProgress },
      { label: 'Awaiting Approval', value: data.filter((row) => row.status === 'awaiting_approval').length },
      { label: 'Delayed', value: delayed },
    ],
    recentActivity,
    todayTasks,
  };
}

export async function getProjects(options: { includeFiles?: boolean } = {}): Promise<Project[]> {
  const client = supabase;
  const includeFiles = options.includeFiles ?? true;

  if (!client) {
    return readLocalProjects()
      .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
      .map(mapProjectRow);
  }

  await hydrateAuthSession();

  const projectSelect = includeFiles
    ? '*'
    : 'id, workspace_id, rebrand_workspace_id, workspace_name, client_company, graphics_partner, project_type, project_type_name, site_label, delivery_partner_label, branch_id, branch_code, branch, province, town, physical_address, latitude, longitude, manager, manager_email, designer, current_stage, report_stage_task_id, status, project_start_date, target_date, brief_requested_date, installation_date, completion_date, updated_at, progress, branch_manager_view_only';
  let { data, error } = await client.from('projects').select(projectSelect).order('updated_at', { ascending: false });

  if (error && !includeFiles && isMissingProjectColumnError(error.message) && projectSelect.includes('brief_requested_date')) {
    const legacyProjectSelect = projectSelect.replace(', brief_requested_date', '');
    const legacyResult = await client.from('projects').select(legacyProjectSelect).order('updated_at', { ascending: false });
    data = legacyResult.data as typeof data;
    error = legacyResult.error as typeof error;
  }

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Supabase returned no project data.');
  }

  // Fetch relational tasks for all projects in parallel
  const projects = (data as unknown as ProjectRow[]).map(mapProjectRow);
  
  if (client && projects.length > 0) {
    try {
      const workspaceIds = [...new Set(
        (data as unknown as ProjectRow[])
          .map((row) => row.rebrand_workspace_id)
          .filter((workspaceId): workspaceId is string => Boolean(workspaceId))
      )];

      if (workspaceIds.length > 0) {
        const { data: allTasks, error: allTasksError } = await client
          .from('project_tasks')
          .select('*, responsible_person:profiles!project_tasks_responsible_person_id_fkey(name, email, profile_title)')
          .in('workspace_id', workspaceIds)
          .is('deleted_at', null)
          .order('sort_order', { ascending: true });

        // Keep each project's relational tasks keyed by its explicit workspace ID.
        let assignees: TaskAssigneeRow[] = [];
        try {
          const batchAssigneeResult = await client.rpc('get_rebrand_task_assignees_batch', { workspace_uuids: workspaceIds });
          if (batchAssigneeResult.error) {
            throw batchAssigneeResult.error;
          }
          assignees = (batchAssigneeResult.data ?? []) as TaskAssigneeRow[];
        } catch (rpcError) {
          const rpcMessage = rpcError instanceof Error ? rpcError.message : String(rpcError ?? '');
          const isMissingAssigneeFunction = /does not exist|undefined function|42883|42703/i.test(rpcMessage);

          if (isMissingAssigneeFunction) {
            try {
              const fallbackResults = await Promise.all(
                workspaceIds.map(async (workspaceId) => {
                  const result = await client.rpc('get_rebrand_task_assignees', { workspace_uuid: workspaceId });
                  return result.data ?? [];
                })
              );
              assignees = fallbackResults.flat() as TaskAssigneeRow[];
            } catch (fallbackError) {
              const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError ?? '');
              console.warn('Task assignee enrichment unavailable; continuing without assignee metadata.', fallbackMessage);
              assignees = [];
            }
          } else {
            console.warn('Task assignee lookup failed; continuing without assignee metadata.', rpcMessage);
            assignees = [];
          }
        }

        const assigneeByTaskId = new Map(((assignees ?? []) as TaskAssigneeRow[]).map((assignee) => [assignee.task_id, assignee]));
        const tasksByWorkspace = new Map<string, TaskItem[]>();
        (allTasks ?? []).forEach((taskRow) => {
          const wsId = (taskRow as ProjectTaskRow).workspace_id;
          const tasks = tasksByWorkspace.get(wsId) ?? [];
          tasks.push(convertRelationalTaskToTaskItem({
            ...(taskRow as ProjectTaskRow),
            responsible_person: assigneeByTaskId.get((taskRow as ProjectTaskRow).id) ?? (taskRow as ProjectTaskRow).responsible_person ?? null,
          }));
          tasksByWorkspace.set(wsId, tasks);
        });

        const hydratedProjects = projects.map((project) => {
          const workspaceId = (data as unknown as ProjectRow[]).find((row) => row.id === project.id)?.rebrand_workspace_id;
          if (!workspaceId) return project;
          const relationalTasks = tasksByWorkspace.get(workspaceId) ?? [];
          return applyRelationalProjectData(project, {
            workspaceId,
            tasks: relationalTasks,
            tasksAvailable: !allTasksError && (relationalTasks.length > 0 || project.tasks.length === 0),
          });
        });
        return includeFiles ? hydrateProjectFiles(hydratedProjects) : hydratedProjects;
      }
    } catch (err) {
      console.error('Failed to fetch relational tasks.', err);
    }
  }

  return includeFiles ? hydrateProjectFiles(projects) : projects;
}

export async function getProjectById(projectId: string, options: { includeFiles?: boolean } = {}): Promise<Project | undefined> {
  const client = supabase;

  if (!client) {
    const project = readLocalProjects().find((row) => row.id === projectId);
    return project ? mapProjectRow(project) : undefined;
  }

  await hydrateAuthSession();

  const { data, error } = await client.from('projects').select('*').eq('id', projectId).maybeSingle();

  if (error || !data) {
    const project = readLocalProjects().find((row) => row.id === projectId);
    return project ? mapProjectRow(project) : undefined;
  }

  const projectRow = data as ProjectRow;
  let project = mapProjectRow(projectRow);

  const workspaceId = projectRow.rebrand_workspace_id ?? await resolveProjectWorkspaceId(projectRow);

  if (workspaceId) {
    if (!projectRow.rebrand_workspace_id) {
      await client
        .from('projects')
        .update({ rebrand_workspace_id: workspaceId, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .is('rebrand_workspace_id', null);
    }

      const relationalTasks = await getWorkspaceTasks(workspaceId);
      project = applyRelationalProjectData(project, {
        workspaceId,
        tasks: relationalTasks.data,
        tasksAvailable: relationalTasks.available && (relationalTasks.data.length > 0 || project.tasks.length === 0),
      });

    if (options.includeFiles === false) {
      return project;
    }

    const relationalFiles = await getWorkspaceFiles(workspaceId);
    project = applyRelationalProjectData(project, {
      workspaceId,
      files: relationalFiles,
      filesAvailable: relationalFiles !== null && (relationalFiles.length > 0 || project.files.length === 0),
    });
  }

  return project;
}

export async function deleteProject(projectId: string): Promise<void> {
  const client = supabase;
  const normalizedProjectId = projectId.trim();

  if (!normalizedProjectId) {
    throw new Error('Project ID is required.');
  }

  if (!client) {
    const localProjects = readLocalProjects();
    const remainingProjects = localProjects.filter((project) => project.id !== normalizedProjectId);

    if (remainingProjects.length === localProjects.length) {
      throw new Error('Project not found.');
    }

    writeLocalProjects(remainingProjects);
    return;
  }

  await hydrateAuthSession();

  const { data, error } = await client
    .from('projects')
    .delete()
    .eq('id', normalizedProjectId)
    .select('id');

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('The project was not removed. Your account may not have permission to delete this project.');
  }
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const client = supabase;

  const workspaceName = input.workspaceName?.trim() || defaultWorkspace.name;
  const clientCompany = input.clientCompany?.trim() || defaultWorkspace.clientCompany;
  const graphicsPartner = input.graphicsPartner?.trim() || defaultWorkspace.graphicsPartner;
  const template = input.projectType ? getProjectTemplate(input.projectType) : defaultProjectTemplate;
  const resolvedBranchId = input.branchId?.trim() || input.branch.trim();
  const normalizedProjectId = input.id?.trim()
    || createNextProjectId(input.branchCode?.trim() || 'PSG000', await getProjects({ includeFiles: false }));

  const selectedTasks = input.selectedTaskIds ? input.selectedTaskIds.map((taskId) => createTaskFromPool(taskId)) : [];
  const lifecycleTasks = mergeDefaultLifecycleTasks(selectedTasks, template.id);
  const basePayload = {
    id: normalizedProjectId,
    branch_id: resolvedBranchId,
    branch_code: input.branchCode?.trim() || null,
    branch: input.branch.trim(),
    province: optionalProjectValue(input.province),
    town: optionalProjectValue(input.town),
    physical_address: input.physicalAddress.trim(),
    latitude: null,
    longitude: null,
    manager: optionalProjectValue(input.manager),
    manager_email: optionalProjectValue(input.managerEmail, ''),
    installer: optionalProjectValue(input.installer),
    designer: optionalProjectValue(input.designer),
    current_stage: input.currentStage || template.defaultStages[0] || 'New Project',
    status: input.status,
    target_date: input.targetDate?.trim() ?? '',
    brief_requested_date: input.briefRequestedDate?.trim() ?? '',
    installation_date: input.installationDate?.trim() ?? '',
    completion_date: input.completionDate?.trim() ?? '',
    progress: input.progress ?? 0,
    branch_manager_view_only: false,
    notes: input.notes?.trim() ?? '',
    files: [],
    tasks: lifecycleTasks,
    comments: [],
    activity: [createActivity('Project Created', `${normalizedProjectId} was created in ${workspaceName} for ${clientCompany}.`, 'success')],
  };
  const workspacePayload = {
    ...basePayload,
    workspace_id: workspaceIdFromName(workspaceName),
    workspace_name: workspaceName,
    client_company: clientCompany,
    graphics_partner: graphicsPartner,
    project_type: template.id,
    project_type_name: template.name,
    site_label: template.siteLabel,
  };

  if (!client) {
    const localProjects = readLocalProjects();

    if (localProjects.some((project) => project.id === normalizedProjectId)) {
      throw new Error(`Project ${normalizedProjectId} already exists.`);
    }

    const now = new Date().toISOString();
    const localRow: ProjectRow = {
      ...workspacePayload,
      manager: basePayload.manager,
      manager_email: basePayload.manager_email,
      designer: basePayload.designer,
      current_stage: basePayload.current_stage,
      status: basePayload.status,
      target_date: basePayload.target_date,
      brief_requested_date: basePayload.brief_requested_date,
      installation_date: basePayload.installation_date,
      completion_date: basePayload.completion_date,
      updated_at: now,
      progress: basePayload.progress,
      branch_manager_view_only: basePayload.branch_manager_view_only,
      notes: basePayload.notes,
      files: basePayload.files,
      tasks: basePayload.tasks,
      comments: basePayload.comments,
      activity: basePayload.activity,
    };

    writeLocalProjects([localRow, ...localProjects]);
    return mapProjectRow(localRow);
  }

  await hydrateAuthSession();

  let { data, error } = await client
    .from('projects')
    .insert(workspacePayload)
    .select('*')
    .single();

  if (
    error?.message.toLowerCase().includes('workspace_') ||
    error?.message.toLowerCase().includes('client_company') ||
    error?.message.toLowerCase().includes('graphics_partner') ||
    error?.message.toLowerCase().includes('project_type') ||
    error?.message.toLowerCase().includes('site_label')
  ) {
    const fallbackResult = await client
      .from('projects')
      .insert(basePayload)
      .select('*')
      .single();

    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error && isMissingProjectColumnError(error.message)) {
    const compatibleResult = await client
      .from('projects')
      .insert(stripProjectPresentationColumns(basePayload))
      .select('*')
      .single();

    data = compatibleResult.data;
    error = compatibleResult.error;
  }

  if (error && isMissingProjectColumnError(error.message)) {
    const legacyResult = await client
      .from('projects')
      .insert(stripLegacyProjectColumns(basePayload))
      .select('*')
      .single();

    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error || !data) {
    if (!shouldFallbackToLocal(error?.message)) {
      throw error ?? new Error('Unable to create project.');
    }

    const localProjects = readLocalProjects();

    if (localProjects.some((project) => project.id === normalizedProjectId)) {
      throw new Error(`Project ${normalizedProjectId} already exists.`);
    }

    const now = new Date().toISOString();
    const localRow: ProjectRow = {
      ...workspacePayload,
      manager: basePayload.manager,
      manager_email: basePayload.manager_email,
      designer: basePayload.designer,
      current_stage: basePayload.current_stage,
      status: basePayload.status,
      target_date: basePayload.target_date,
      brief_requested_date: basePayload.brief_requested_date,
      installation_date: basePayload.installation_date,
      completion_date: basePayload.completion_date,
      updated_at: now,
      progress: basePayload.progress,
      branch_manager_view_only: basePayload.branch_manager_view_only,
      notes: basePayload.notes,
      files: basePayload.files,
      tasks: basePayload.tasks,
      comments: basePayload.comments,
      activity: basePayload.activity,
    };

    writeLocalProjects([localRow, ...localProjects]);
    return mapProjectRow(localRow);
  }

  return mapProjectRow(data as ProjectRow);
}

export async function uploadProjectFile(projectId: string, file: File, currentFiles: ProjectFile[], taskId?: string): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  validateProjectFile(file);
  await hydrateAuthSession();

  const path = `${projectId}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await client.storage
    .from(projectFilesBucket)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: projectRow, error: projectError } = await client
    .from('projects')
    .select('branch_id, rebrand_workspace_id, tasks, files')
    .eq('id', projectId)
    .single();

  if (projectError || !projectRow?.branch_id) {
    await client.storage.from(projectFilesBucket).remove([path]);
    throw projectError ?? new Error('Project branch is missing.');
  }

  const workspaceId = projectRow.rebrand_workspace_id ?? await resolveProjectWorkspaceId(projectRow as ProjectRow);
  const { data: workspace, error: workspaceError } = workspaceId
    ? await client
      .from('rebrand_workspaces')
      .select('id')
      .eq('id', workspaceId)
      .maybeSingle()
    : await client
      .from('rebrand_workspaces')
      .select('id')
      .eq('branch_id', projectRow.branch_id)
      .eq('is_primary', true)
      .maybeSingle();
  const uploadedBy = await getCurrentProfileId();
  if (workspaceError || !workspace?.id) {
    await client.storage.from(projectFilesBucket).remove([path]);
    throw workspaceError ?? new Error('No active workspace was found for this branch.');
  }
  if (!uploadedBy) {
    await client.storage.from(projectFilesBucket).remove([path]);
    throw new Error('Your authenticated account is not linked to a workspace profile. Sign out and back in, then try again.');
  }

  if (!projectRow.rebrand_workspace_id) {
    await client
      .from('projects')
      .update({ rebrand_workspace_id: workspace.id, updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .is('rebrand_workspace_id', null);
  }

  let relationalTaskId: string | null = null;
  if (taskId) {
    const { data: matchingTasks, error: taskLookupError } = await client
      .from('project_tasks')
      .select('id, title, sort_order')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null);
    if (taskLookupError) {
      await client.storage.from(projectFilesBucket).remove([path]);
      throw taskLookupError;
    }

    const legacyTask = mapLegacyTasks((projectRow as ProjectRow).tasks).find((task) => task.id === taskId);
    const taskTitle = legacyTask?.text ?? (await getProjectById(projectId))?.tasks.find((task) => task.id === taskId)?.text;
    relationalTaskId = (matchingTasks ?? []).find((task) => task.id === taskId
      || (taskTitle && normalizeTaskTitle(task.title) === normalizeTaskTitle(taskTitle)))?.id ?? null;

  }

  const { data: category } = await client.from('file_categories').select('id').eq('category_key', 'other').maybeSingle();
  if (!category?.id) {
    await client.storage.from(projectFilesBucket).remove([path]);
    throw new Error('Default file category is missing.');
  }

  const { data: projectFile, error: fileError } = await client
    .from('project_files')
    .insert({ workspace_id: workspace.id, task_id: relationalTaskId, category_id: category.id, display_name: file.name, uploaded_by: uploadedBy })
    .select('id')
    .single();
  if (fileError || !projectFile) {
    await client.storage.from(projectFilesBucket).remove([path]);
    throw fileError ?? new Error('Unable to create relational project file.');
  }

  const { data: version, error: versionError } = await client
    .from('file_versions')
    .insert({ file_id: projectFile.id, version_number: 1, storage_bucket: projectFilesBucket, storage_path: path, mime_type: file.type || null, size_bytes: file.size, uploaded_by: uploadedBy })
    .select('id')
    .single();
  if (versionError || !version) {
    await client.from('project_files').delete().eq('id', projectFile.id);
    await client.storage.from(projectFilesBucket).remove([path]);
    throw versionError ?? new Error('Unable to create file version.');
  }

  const { error: currentVersionError } = await client.from('project_files').update({ current_version_id: version.id, updated_at: new Date().toISOString() }).eq('id', projectFile.id);
  if (currentVersionError) {
    await client.from('project_files').delete().eq('id', projectFile.id);
    await client.storage.from(projectFilesBucket).remove([path]);
    throw currentVersionError;
  }

  const legacyFiles = mapLegacyFiles((projectRow as ProjectRow).files);
  const persistedTaskId = relationalTaskId ?? taskId;
  const legacyFile = { id: projectFile.id, name: file.name, path, size: file.size, type: file.type || undefined, uploadedAt: new Date().toISOString(), taskId: persistedTaskId };
  const { error: legacyFileError } = await client
    .from('projects')
    .update({ files: [...legacyFiles, legacyFile], updated_at: new Date().toISOString() })
    .eq('id', projectId);
  if (legacyFileError) {
    await client.from('project_files').delete().eq('id', projectFile.id);
    await client.storage.from(projectFilesBucket).remove([path]);
    throw legacyFileError;
  }

  await recordProjectFileActivity(projectId, workspace.id, 'file_uploaded', projectFile.id, relationalTaskId ?? undefined, { display_name: file.name, actor: 'upload' });
  const updatedProject = await getProjectById(projectId);
  if (!updatedProject) {
    throw new Error('The file was uploaded, but the project could not be refreshed. Reload the project before continuing.');
  }

  const uploadedFile = updatedProject.files.find((item) => item.id === projectFile.id)
    ?? { id: projectFile.id, name: file.name, path, size: file.size, type: file.type || undefined, uploadedAt: new Date().toISOString(), taskId: persistedTaskId };
  const taskByKey = new Map<string, TaskItem>();
  [...mapLegacyTasks((projectRow as ProjectRow).tasks), ...updatedProject.tasks].forEach((item) => {
    taskByKey.set(normalizeTaskTitle(item.stage ?? item.text), item);
  });
  const preservedTasks = [...taskByKey.values()];
  const nextFiles = legacyFiles.some((item) => item.id === uploadedFile.id)
    ? legacyFiles
    : [...legacyFiles, uploadedFile];
  const { data: persistedProject, error: projectSnapshotError } = await client
    .from('projects')
    .update({
      rebrand_workspace_id: workspace.id,
      files: nextFiles,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .select('id')
    .maybeSingle();

  if (projectSnapshotError || !persistedProject) {
    throw projectSnapshotError ?? new Error('The photo was uploaded, but the project stage list could not be preserved.');
  }

  return { ...updatedProject, tasks: preservedTasks };
}

export async function getProjectFileUrl(file: ProjectFile, options: { download?: boolean; thumbnail?: boolean } = {}) {
  const client = supabase;

  if (!client || !file.path) {
    return null;
  }

  await hydrateAuthSession();

  try {
    const { data, error } = await client.storage
      .from(projectFilesBucket)
      .createSignedUrl(file.path, 60 * 60, {
        ...(options.download ? { download: file.name } : {}),
        ...(options.thumbnail ? { transform: { width: 640, height: 480, resize: 'contain', quality: 70 } } : {}),
      });

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (err) {
    // fall through to public URL attempt
  }

  try {
    const { data: publicData } = await client.storage.from(projectFilesBucket).getPublicUrl(file.path);
    if (publicData && typeof publicData.publicUrl === 'string' && publicData.publicUrl) {
      return publicData.publicUrl;
    }
  } catch (err) {
    // ignore
  }

  return null;
}

export async function updateProjectWorkflow(input: UpdateProjectWorkflowInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const activity = [
    createActivity(
      'Workflow updated',
      `${input.actor} moved the project to ${input.currentStage} with ${input.progress}% progress.`,
      input.status === 'delayed' || input.status === 'on_hold' ? 'warning' : input.status === 'completed' ? 'success' : 'info',
    ),
    ...existingProject.activity,
  ];

  const { data, error } = await client
    .from('projects')
    .update({
      current_stage: input.currentStage,
      status: input.status,
      progress: input.progress,
      activity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to update project workflow.');
  }

  return mapProjectRow(data as ProjectRow);
}

export async function updateProjectSummary(input: UpdateProjectSummaryInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const currentStage = input.currentStage.trim();
  if (!currentStage) {
    throw new Error('Current status is required.');
  }

  const targetDate = input.targetDate?.trim() ?? existingProject.targetDate ?? '';
  const projectStartDate = input.projectStartDate?.trim() ?? existingProject.projectStartDate ?? '';
  const briefRequestedDate = input.briefRequestedDate.trim();
  const installationDate = input.installationDate.trim();
  const completionDate = input.completionDate?.trim() ?? '';
  const resolvedCompletionDate = input.status === 'completed'
    ? completionDate || existingProject.completionDate || new Date().toISOString().slice(0, 10)
    : '';
  const activity = [
    createActivity('Project summary updated', `${input.actor} updated stage, status, and schedule dates.`),
    ...existingProject.activity,
  ];
  const currentStageTask = input.currentTaskId
    ? existingProject.tasks.find((task) => task.id === input.currentTaskId)
    : undefined;
  const nextTaskStatus: TaskItem['status'] = input.status === 'completed' ? 'done' : 'busy';
  const completedBy = nextTaskStatus === 'done' ? await getCurrentProfileId() : null;
  if (nextTaskStatus === 'done' && !completedBy) {
    throw new Error('Unable to identify the user completing this stage.');
  }
  const summaryTasks = currentStageTask
    ? existingProject.tasks.map((task) => task.id === currentStageTask.id
      ? {
        ...task,
        status: nextTaskStatus,
        completed: nextTaskStatus === 'done',
        completedAt: nextTaskStatus === 'done' ? task.completedAt ?? new Date().toISOString() : undefined,
      }
      : task)
    : existingProject.tasks;

  const now = new Date().toISOString();
  const summaryPayload = {
    current_stage: currentStage,
    report_stage_task_id: input.reportStageTaskId?.trim() || null,
    status: input.status,
    project_start_date: projectStartDate || null,
    target_date: targetDate,
    brief_requested_date: briefRequestedDate,
    installation_date: installationDate,
    completion_date: resolvedCompletionDate,
    manager: input.manager?.trim() ?? existingProject.manager,
    manager_email: input.managerEmail?.trim() ?? existingProject.managerEmail,
    tasks: summaryTasks,
    activity,
    updated_at: now,
  };

  if (input.status !== 'completed' && existingProject.workspaceId && isUuid(existingProject.workspaceId)) {
    const { error: workspaceReactivationError } = await client
      .from('rebrand_workspaces')
      .update({
        lifecycle_state: 'active',
        archived_at: null,
        archived_by: null,
        updated_at: now,
      })
      .eq('id', existingProject.workspaceId)
      .eq('lifecycle_state', 'archived');

    if (workspaceReactivationError) {
      throw workspaceReactivationError;
    }
  }

  let { data, error } = await client
    .from('projects')
    .update(summaryPayload)
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error && isMissingProjectColumnError(error.message)) {
    const fallbackResult = await client
      .from('projects')
      .update(stripProjectPresentationColumns(summaryPayload))
      .eq('id', input.projectId)
      .select('*')
      .single();
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error || !data) {
    throw error ?? new Error('Unable to update project summary.');
  }

  if (currentStageTask && existingProject.workspaceId && isUuid(currentStageTask.id)) {
    const now = new Date().toISOString();
    const { error: taskError } = await client
      .from('project_tasks')
      .update({
        status: nextTaskStatus === 'done' ? 'complete' : 'in_progress',
        updated_at: now,
        completed_at: nextTaskStatus === 'done' ? now : null,
        completed_by: completedBy,
      })
      .eq('id', currentStageTask.id)
      .eq('workspace_id', existingProject.workspaceId);

    if (taskError) {
      throw taskError;
    }

    await recordProjectActivity({
      eventType: 'task_status_changed',
      entityType: 'project_task',
      entityId: currentStageTask.id,
      workspaceId: existingProject.workspaceId,
      projectId: input.projectId,
      taskId: currentStageTask.id,
      newValues: { status: nextTaskStatus },
      metadata: { actor: input.actor },
    });
  }

  if (existingProject.workspaceId) {
    await recordProjectActivity({
      eventType: 'project_updated',
      entityType: 'project',
      workspaceId: existingProject.workspaceId,
      projectId: input.projectId,
      newValues: { status: input.status, current_stage: currentStage },
      metadata: { actor: input.actor },
    });
  }

  return {
    ...existingProject,
    currentStage,
    reportStageTaskId: input.reportStageTaskId?.trim() || undefined,
    status: input.status,
    projectStartDate,
    targetDate,
    briefRequestedDate,
    installationDate,
    completionDate: resolvedCompletionDate,
    manager: input.manager?.trim() ?? existingProject.manager,
    managerEmail: input.managerEmail?.trim() ?? existingProject.managerEmail,
    tasks: summaryTasks,
    activity,
    updatedAt: now,
  };
}

export async function addProjectComment(input: AddProjectCommentInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  const message = input.message.trim();
  if (!message) {
    throw new Error('Comment cannot be empty.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }
  const structured = createStructuredComment(existingProject, input.author, message, input.taskId);

  const { data, error } = await client
    .from('projects')
    .update({ comments: structured.comments, activity: structured.activity, updated_at: new Date().toISOString() })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to add project comment.');
  }

  const updatedProject = mapProjectRow(data as ProjectRow);

  void notifyProjectChange({
    project: updatedProject,
    actor: input.author,
    message: structured.comment.message,
    changeType: structured.changeType,
  });

  return updatedProject;
}

export async function updateProjectComment(input: UpdateProjectCommentInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  const message = input.message.trim();
  if (!message) {
    throw new Error('Comment cannot be empty.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const commentIndex = existingProject.comments.findIndex((comment) => comment.id === input.commentId);
  const existingComment = commentIndex >= 0 ? existingProject.comments[commentIndex] : undefined;
  if (!existingComment) {
    throw new Error('Comment not found.');
  }
  const isOwnComment = existingComment.author.trim().toLowerCase() === input.author.trim().toLowerCase();
  const canEditAnotherUserComment = input.actorRole === 'colourpix_admin' || input.actorRole === 'psg_head_office' || isPlatformOwnerEmail(input.actorEmail);
  if (!isOwnComment && !canEditAnotherUserComment) {
    throw new Error('You can only edit comments you created.');
  }

  const comments = existingProject.comments.map((comment, index) => index === commentIndex ? { ...comment, message } : comment);
  const activity = existingProject.activity.map((item) => ({
    ...item,
    detail: item.detail.includes(existingComment.message) ? item.detail.replace(existingComment.message, message) : item.detail,
  }));
  const { data, error } = await client
    .from('projects')
    .update({ comments, activity, updated_at: new Date().toISOString() })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to update project comment.');
  }

  return mapProjectRow(data as ProjectRow);
}

export async function deleteProjectComment(input: DeleteProjectCommentInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const comment = existingProject.comments.find((item) => item.id === input.commentId);
  if (!comment) {
    throw new Error('Comment not found.');
  }
  const isOwnComment = comment.author.trim().toLowerCase() === input.author.trim().toLowerCase();
  const canDeleteAnotherUserComment = input.actorRole === 'colourpix_admin' || input.actorRole === 'psg_head_office' || isPlatformOwnerEmail(input.actorEmail);
  if (!isOwnComment && !canDeleteAnotherUserComment) {
    throw new Error('You can only delete comments you created.');
  }

  const comments = existingProject.comments.filter((item) => item.id !== input.commentId);
  const activity = existingProject.activity.filter((item) => !item.detail.includes(comment.message));
  const { data, error } = await client
    .from('projects')
    .update({ comments, activity, updated_at: new Date().toISOString() })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to delete project comment.');
  }

  return mapProjectRow(data as ProjectRow);
}

export async function updateProjectActivity(input: UpdateProjectActivityInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  const message = input.message.trim();
  if (!message) {
    throw new Error('Update cannot be empty.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const activityIndex = existingProject.activity.findIndex((item) => item.date === input.date && item.title === input.title && item.detail === input.detail);
  if (activityIndex < 0) {
    throw new Error('System update not found.');
  }

  const activity = existingProject.activity.map((item, index) => index === activityIndex ? { ...item, detail: message } : item);
  const { data, error } = await client
    .from('projects')
    .update({ activity, updated_at: new Date().toISOString() })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to update system update.');
  }

  return mapProjectRow(data as ProjectRow);
}

export async function deleteProjectActivity(input: DeleteProjectActivityInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const activityIndex = existingProject.activity.findIndex((item) => item.date === input.date && item.title === input.title && item.detail === input.detail);
  if (activityIndex < 0) {
    throw new Error('System update not found.');
  }

  const activity = existingProject.activity.filter((_, index) => index !== activityIndex);
  const { data, error } = await client
    .from('projects')
    .update({ activity, updated_at: new Date().toISOString() })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to delete system update.');
  }

  return mapProjectRow(data as ProjectRow);
}

export async function askProjectQuestion(input: AskProjectQuestionInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  const message = input.message.trim();
  if (!message) {
    throw new Error('Question cannot be empty.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const now = new Date().toISOString();
  const linkedTask = input.taskId ? existingProject.tasks.find((task) => task.id === input.taskId) : undefined;
  const comments: CommentItem[] = [
    {
      id: createQuestionId(),
      kind: 'question',
      date: todayLabel(),
      author: input.author,
      message,
      status: 'open',
      taskId: linkedTask?.id,
      requesterEmail: input.authorEmail,
      requestedAt: now,
      unreadForRequester: false,
    },
    ...existingProject.comments,
  ];
  const activity = [createActivity('Question raised', `${input.author} asked Colourpix for an update${linkedTask ? ` on "${linkedTask.text}"` : ''}.`), ...existingProject.activity];

  const { data, error } = await client
    .from('projects')
    .update({ comments, activity, updated_at: now })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to send question.');
  }

  return mapProjectRow(data as ProjectRow);
}

export async function answerProjectQuestion(input: AnswerProjectQuestionInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  const answer = input.answer?.trim();

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const question = existingProject.comments.find((comment) => comment.id === input.questionId && comment.kind === 'question');
  if (!question) {
    throw new Error('Question not found.');
  }

  const relatedChanges = [
    input.currentStage && input.currentStage !== existingProject.currentStage ? `Stage changed to ${input.currentStage}` : null,
    input.status && input.status !== existingProject.status ? `Status changed to ${input.status.replace(/_/g, ' ')}` : null,
    input.progress !== undefined && input.progress !== existingProject.progress ? `Progress changed to ${input.progress}%` : null,
    input.installationDate && input.installationDate !== existingProject.installationDate ? `Installation date changed to ${input.installationDate}` : null,
    input.targetDate && input.targetDate !== existingProject.targetDate ? `Target date changed to ${input.targetDate}` : null,
    input.briefRequestedDate && input.briefRequestedDate !== existingProject.briefRequestedDate ? `Brief requested date changed to ${input.briefRequestedDate}` : null,
    input.completionDate && input.completionDate !== existingProject.completionDate ? `Completion date changed to ${input.completionDate}` : null,
  ].filter((change): change is string => Boolean(change));

  if (!answer && relatedChanges.length === 0) {
    throw new Error('Add an answer or make a project change before responding.');
  }

  const now = new Date().toISOString();
  const comments = existingProject.comments.map((comment) => {
    if (comment.id !== input.questionId) {
      return comment;
    }

    return {
      ...comment,
      status: 'answered' as const,
      answer: answer || comment.answer,
      answeredBy: input.actor,
      answeredAt: now,
      unreadForRequester: true,
      relatedChanges,
    };
  });
  const activity = [
    createActivity(
      'Question answered',
      `${input.actor} answered ${question.author}'s project question${relatedChanges.length > 0 ? ` and updated ${relatedChanges.join(', ').toLowerCase()}` : ''}.`,
      relatedChanges.length > 0 ? 'success' : 'info',
    ),
    ...existingProject.activity,
  ];

  const { data, error } = await client
    .from('projects')
    .update({
      current_stage: input.currentStage ?? existingProject.currentStage,
      status: input.status ?? existingProject.status,
      progress: input.progress ?? existingProject.progress,
      target_date: input.targetDate ?? existingProject.targetDate,
      brief_requested_date: input.briefRequestedDate ?? existingProject.briefRequestedDate,
      installation_date: input.installationDate ?? existingProject.installationDate,
      completion_date: input.completionDate ?? existingProject.completionDate,
      comments,
      activity,
      updated_at: now,
    })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to answer question.');
  }

  return mapProjectRow(data as ProjectRow);
}

export async function markProjectQuestionRead(input: MarkProjectQuestionReadInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const comments = existingProject.comments.map((comment) => (comment.id === input.questionId && comment.kind === 'question' ? { ...comment, unreadForRequester: false } : comment));

  const { data, error } = await client
    .from('projects')
    .update({ comments, updated_at: new Date().toISOString() })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to mark question as read.');
  }

  return mapProjectRow(data as ProjectRow);
}

export async function addProjectTask(input: AddProjectTaskInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  const task = input.task.trim();
  if (!task) {
    throw new Error('Stage cannot be empty.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId, { includeFiles: false });
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const assignees = input.assignees?.length
    ? input.assignees
    : (input.assigneeName && input.assigneeEmail ? [{ name: input.assigneeName, email: input.assigneeEmail, designation: 'Participant' }] : undefined);
  if (!assignees?.length && !input.stage) {
    throw new Error('Assign every open task to at least one person.');
  }

  // Get or create workspace
  let workspaceId = existingProject.workspaceId;
  if (!workspaceId || workspaceId === defaultWorkspace.id) {
    // Create workspace if it doesn't exist
    const branchId = existingProject.branchId || existingProject.branch;
    const { data: workspaceData } = await client
      .from('rebrand_workspaces')
      .select('id, current_stage_id')
      .eq('branch_id', branchId)
      .eq('is_primary', true)
      .maybeSingle();

    if (workspaceData?.id) {
      workspaceId = workspaceData.id;
    } else {
      // Create new workspace if none exists
      const { data: newWorkspace, error: wsError } = await client
        .from('rebrand_workspaces')
        .insert({
          branch_id: branchId,
          workspace_reference: `WS-${existingProject.id}`,
          workspace_type: 'rebrand',
          is_primary: true,
          lifecycle_state: 'active',
        })
        .select('id')
        .single();

      if (wsError || !newWorkspace) {
        throw new Error('Failed to create workspace for task.');
      }
      workspaceId = newWorkspace.id;
    }
  }

  const { data: workspace, error: workspaceError } = await client
    .from('rebrand_workspaces')
    .select('id, current_stage_id, lifecycle_state')
    .eq('id', workspaceId)
    .single();
  if (workspaceError || !workspace) {
    throw new Error(workspaceError?.message ?? 'Workspace for task was not found.');
  }

  if (workspace.lifecycle_state === 'archived') {
    const { error: workspaceReactivationError } = await client
      .from('rebrand_workspaces')
      .update({
        lifecycle_state: 'active',
        archived_at: null,
        archived_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspaceId)
      .eq('lifecycle_state', 'archived');

    if (workspaceReactivationError) {
      throw workspaceReactivationError;
    }
  }

  const { data: fallbackStage, error: stageError } = workspace.current_stage_id
    ? { data: null, error: null }
    : await client
      .from('workflow_stages')
      .select('id')
      .eq('active', true)
      .order('stage_number', { ascending: true })
      .limit(1)
      .maybeSingle();
  const stageId = workspace.current_stage_id ?? fallbackStage?.id;
  if (stageError || !stageId) {
    throw new Error(stageError?.message ?? 'No active workflow stage is available for this task.');
  }

  const { data: responsibilityGroup, error: responsibilityGroupError } = await client
    .from('responsibility_groups')
    .select('id')
    .eq('group_key', 'colourpix')
    .eq('active', true)
    .maybeSingle();
  if (responsibilityGroupError || !responsibilityGroup?.id) {
    throw new Error(responsibilityGroupError?.message ?? 'Colourpix responsibility group is missing.');
  }

  const profileId = await getCurrentProfileId();
  if (!profileId) {
    throw new Error('Authenticated profile was not found.');
  }

  // Get next sort_order
  const { data: lastTask } = await client
    .from('project_tasks')
    .select('sort_order')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder = (lastTask?.sort_order ?? -1) + 1;

  // Insert new task into relational table
  const { data: newTask, error: taskError } = await client
    .from('project_tasks')
    .insert({
      workspace_id: workspaceId,
      stage_id: stageId,
      title: task,
      description: '',
      status: 'not_started',
      priority: 'normal',
      sort_order: nextSortOrder,
      responsible_group_id: responsibilityGroup.id,
      required_action: '',
      is_current: false,
      created_by: profileId,
    })
    .select('*')
    .single();

  if (taskError || !newTask) {
    throw new Error(taskError?.message ?? 'Failed to add project task.');
  }

  const newTaskItem = convertRelationalTaskToTaskItem(newTask as ProjectTaskRow);
  const legacyTasks = existingProject.tasks.some((existingTask) => existingTask.id === newTaskItem.id)
    ? existingProject.tasks
    : [...existingProject.tasks, newTaskItem];

  // Record activity
  const now = new Date().toISOString();
  const activity = [
    createActivity('Stage added', `${input.actor} added stage: ${task} (${summarizeAssignees(assignees)}).`),
    ...existingProject.activity,
  ];

  // Update project activity log
  const { data: updatedProjectRow, error: projectUpdateError } = await client
    .from('projects')
    .update({
      rebrand_workspace_id: workspaceId,
      tasks: legacyTasks,
      activity,
      updated_at: now,
    })
    .eq('id', input.projectId)
    .select('id')
    .maybeSingle();

  if (projectUpdateError) {
    throw projectUpdateError;
  }
  if (!updatedProjectRow) {
    throw new Error('The stage was created but the project task list could not be saved. Refresh and try again.');
  }

  return {
    ...existingProject,
    workspaceId,
    tasks: legacyTasks,
    activity,
    updatedAt: now,
  };
}

export async function reorderProjectTask(input: ReorderProjectTaskInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const taskToMove = existingProject.tasks.find((task) => task.id === input.taskId);
  if (!taskToMove) {
    throw new Error('Task not found.');
  }

  const now = new Date().toISOString();

  // Soft-delete the relational task when this project has a relational workspace.
  const { data: workspaceData } = await client
    .from('rebrand_workspaces')
    .select('id')
    .eq('id', existingProject.workspaceId)
    .maybeSingle();

  if (!workspaceData?.id) {
    throw new Error('Workspace not found for project.');
  }

  // Get all tasks in order
  const { data: tasksInOrder } = await client
    .from('project_tasks')
    .select('id, sort_order')
    .eq('workspace_id', workspaceData.id)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });

  if (!tasksInOrder) {
    throw new Error('Unable to fetch tasks for reordering.');
  }

  const currentIndex = tasksInOrder.findIndex((t) => t.id === input.taskId);
  if (currentIndex === -1) {
    throw new Error('Task not found in workspace.');
  }

  const nextIndex = input.direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= tasksInOrder.length) {
    return existingProject;
  }

  // Swap sort orders
  const currentTask = tasksInOrder[currentIndex];
  const nextTask = tasksInOrder[nextIndex];
  const tempSortOrder = currentTask.sort_order;
  const taskSortOrders = new Map(tasksInOrder.map((task) => [task.id, task.sort_order]));
  taskSortOrders.set(currentTask.id, nextTask.sort_order);
  taskSortOrders.set(nextTask.id, tempSortOrder);

  await client
    .from('project_tasks')
    .update({ sort_order: nextTask.sort_order })
    .eq('id', currentTask.id);

  await client
    .from('project_tasks')
    .update({ sort_order: tempSortOrder })
    .eq('id', nextTask.id);

  // Record activity
  const activity = [
    createActivity(
      'Task reordered',
      `${input.actor} moved task ${input.direction === 'up' ? 'up' : 'down'}: ${taskToMove.text}`,
      'info',
    ),
    ...existingProject.activity,
  ];

  await client
    .from('projects')
    .update({ activity, updated_at: now })
    .eq('id', input.projectId);

  return {
    ...existingProject,
    tasks: [...existingProject.tasks].sort((leftTask, rightTask) =>
      (taskSortOrders.get(leftTask.id) ?? Number.MAX_SAFE_INTEGER) -
      (taskSortOrders.get(rightTask.id) ?? Number.MAX_SAFE_INTEGER)),
    activity,
    updatedAt: now,
  };
}

export async function updateProjectTask(input: UpdateProjectTaskInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId, { includeFiles: false });
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  let existingTask = existingProject.tasks.find((task) => task.id === input.taskId)
    ?? (input.taskText
      ? existingProject.tasks.find((task) => normalizeTaskTitle(task.stage ?? task.text) === normalizeTaskTitle(input.taskText as string))
      : undefined);

  const workspaceId = existingProject.workspaceId;
  const { data: relationalTasks } = workspaceId && isUuid(workspaceId)
    ? await client
      .from('project_tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
    : { data: null };
  const relationalTask = (relationalTasks as ProjectTaskRow[] | null)?.find((task) => (
    task.id === input.taskId
      || (existingTask && normalizeTaskTitle(task.title) === normalizeTaskTitle(existingTask.stage ?? existingTask.text))
      || (input.taskText && normalizeTaskTitle(task.title) === normalizeTaskTitle(input.taskText))
  ));
  if (!existingTask && relationalTask) {
    existingTask = convertRelationalTaskToTaskItem(relationalTask);
  }
  if (!existingTask) {
    throw new Error('Task not found.');
  }
  const resolvedTaskId = relationalTask?.id ?? existingTask.id;

  const text = input.text?.trim();
  if (input.text !== undefined && !text) {
    throw new Error('Task cannot be empty.');
  }

  // Map status from frontend format to relational format
  const nextStatus = input.status ?? (input.completed !== undefined
    ? (input.completed ? 'done' : 'busy')
    : existingTask.status ?? (existingTask.completed ? 'done' : (existingTask.startedDate ? 'busy' : 'pending')));
  const startedDate = input.startedDate !== undefined
    ? input.startedDate
    : existingTask.startedDate ?? (nextStatus === 'busy' ? new Date().toISOString().slice(0, 10) : undefined);
  const nextCompleted = nextStatus === 'done';
  const assignees = input.assignees !== undefined
    ? (input.assignees.length > 0 ? input.assignees : undefined)
    : existingTask.assignees;
  const primaryAssignee = assignees?.[assignees.length - 1];
  const assignedProfileId = await getProfileIdByEmail(primaryAssignee?.email);
  const relationalStatus = taskStatusToDatabase(nextStatus);
  const relationalPriority = 'normal'; // Default priority for updates
  const completedBy = relationalStatus === 'complete' ? await getCurrentProfileId() : null;
  if (relationalStatus === 'complete' && !completedBy) {
    throw new Error('Unable to identify the user completing this stage.');
  }

  const now = new Date().toISOString();
  const tasks = existingProject.tasks.map((task) => task.id === resolvedTaskId
    ? {
      ...task,
      text: text ?? task.text,
      stage: text ?? task.stage,
      status: nextStatus ?? task.status,
      completed: nextCompleted,
      assigneeName: primaryAssignee?.name,
      assigneeEmail: primaryAssignee?.email,
      assignees,
      startedDate,
      dueDate: input.dueDate !== undefined ? (input.dueDate === '' ? '' : input.dueDate || existingTask.dueDate || undefined) : task.dueDate,
      completedAt: nextCompleted ? task.completedAt ?? now : undefined,
    }
    : task);
  const allTasksCompleted = tasks.length > 0 && tasks.every((task) => task.completed);
  const projectStatus = existingProject.status;
  const currentStage = text && (existingTask.stage ?? existingTask.text).trim() === existingProject.currentStage.trim()
    ? text
    : existingProject.currentStage;

  // Keep the legacy JSON task source in sync while relational workspaces are rolled out.
  const { data: workspaceData } = await client
    .from('rebrand_workspaces')
    .select('id')
    .eq('id', existingProject.workspaceId)
    .maybeSingle();

  if (workspaceData?.id && isUuid(resolvedTaskId)) {
    const taskUpdate = {
      title: text ?? existingTask.text,
      status: relationalStatus,
      priority: relationalPriority,
      started_date: startedDate === '' ? null : startedDate ?? null,
      due_date: input.dueDate !== undefined ? (input.dueDate === '' ? null : input.dueDate || null) : (existingTask.dueDate ?? null),
      updated_at: now,
      completed_at: relationalStatus === 'complete' ? now : null,
      completed_by: completedBy,
      responsible_person_id: assignedProfileId,
      waiting_reason: relationalStatus === 'waiting' ? (existingTask.installationRequest || 'Waiting for details') : null,
      blocker_reason: relationalStatus === 'blocked' ? (existingTask.installationRequest || 'Blocked') : null,
    };
    const { data: updatedTask, error: updateError } = await client
      .from('project_tasks')
      .update(taskUpdate)
      .eq('id', resolvedTaskId)
      .eq('workspace_id', workspaceData.id)
      .select('id')
      .maybeSingle();

    if (updateError || !updatedTask) {
      throw new Error(updateError?.message ?? 'Unable to update project task. The task may be read-only or no longer exists.');
    }

    await recordProjectActivity({
      eventType: 'task_status_changed',
      entityType: 'project_task',
      entityId: resolvedTaskId,
      workspaceId: workspaceData.id,
      projectId: input.projectId,
      taskId: resolvedTaskId,
      oldValues: { status: existingTask.status },
      newValues: { status: nextStatus, assignee_id: assignedProfileId },
      metadata: { actor: input.actor },
    });
  }

  // Record activity
  const assignmentChanged = input.assignees !== undefined && (existingTask.assigneeEmail ?? '') !== (primaryAssignee?.email ?? '');
  const activityTitle = input.handoffAfterCompletion ? 'Task completed' : assignmentChanged ? 'Stage assigned' : relationalStatus === 'complete' ? 'Task completed' : relationalStatus === 'in_progress' ? 'Task in progress' : relationalStatus === 'waiting' ? 'Task started' : relationalStatus === 'not_started' ? 'Task reopened' : 'Task updated';
  const activityVerb = relationalStatus === 'complete' ? 'completed' : relationalStatus === 'in_progress' ? 'marked in progress on' : relationalStatus === 'waiting' ? 'started' : relationalStatus === 'not_started' ? 'reopened' : 'updated';
  const activityDetail = input.handoffAfterCompletion
    ? `${input.actor} completed their assigned task: ${text ?? existingTask.text}. Stage reassigned to ${input.handoffAfterCompletion.name}.`
    : assignmentChanged
      ? `${input.actor} assigned stage: ${text ?? existingTask.text} to ${primaryAssignee?.name ?? 'unassigned'}.`
      : `${input.actor} ${activityVerb} stage: ${text ?? existingTask.text}`;
  const activity = [
    createActivity(
      activityTitle,
      activityDetail,
      relationalStatus === 'complete' ? 'success' : 'info',
    ),
    ...existingProject.activity,
  ];

  const projectUpdate: {
    current_stage: string;
    status: Project['status'];
    tasks: TaskItem[];
    activity: ActivityItem[];
    updated_at: string;
    completion_date?: string;
  } = { current_stage: currentStage, status: projectStatus, tasks, activity, updated_at: now };
  const { data: updatedProjectRow, error: projectUpdateError } = await client
    .from('projects')
    .update(projectUpdate)
    .eq('id', input.projectId)
    .select('id')
    .maybeSingle();

  if (projectUpdateError || !updatedProjectRow) {
    throw new Error(projectUpdateError?.message ?? 'Unable to update project task.');
  }

  return {
    ...existingProject,
    tasks,
    currentStage,
    status: projectStatus,
    activity,
    updatedAt: now,
    completionDate: existingProject.completionDate,
  };
}

export async function upsertProjectStageTask(input: UpsertProjectStageTaskInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const now = new Date().toISOString();
  const existingTask = input.taskId
    ? existingProject.tasks.find((task) => task.id === input.taskId)
    : undefined;
  const completed = input.completed ?? existingTask?.completed ?? false;
  const assignees = input.assignees !== undefined
    ? (input.assignees.length > 0 ? input.assignees : undefined)
    : existingTask?.assignees;
  const fallbackAssignee = input.assigneeEmail !== undefined
    ? (input.assigneeEmail && input.assigneeName ? [{ name: input.assigneeName, email: input.assigneeEmail, designation: 'Participant' }] : undefined)
    : undefined;
  const resolvedAssignees = assignees ?? fallbackAssignee;
  const primaryAssignee = resolvedAssignees?.[resolvedAssignees.length - 1];

  const nextTask: TaskItem = {
    id: existingTask?.id ?? createTaskId(),
    text: existingTask?.text ?? input.stage,
    completed,
    stage: input.stage,
    assigneeName: primaryAssignee?.name ?? (input.assigneeName !== undefined ? input.assigneeName || undefined : existingTask?.assigneeName),
    assigneeEmail: primaryAssignee?.email ?? (input.assigneeEmail !== undefined ? input.assigneeEmail || undefined : existingTask?.assigneeEmail),
    assignees: resolvedAssignees,
    createdAt: existingTask?.createdAt ?? now,
    completedAt: completed ? existingTask?.completedAt ?? now : undefined,
  };

  const tasks = existingTask
    ? existingProject.tasks.map((task) => (task.id === existingTask.id ? nextTask : task))
    : [nextTask, ...existingProject.tasks];

  const activityTitle = input.completed === undefined
    ? 'Timeline stage assigned'
    : input.completed
      ? 'Timeline stage completed'
      : 'Timeline stage reopened';
  const assignmentDetail = nextTask.assigneeName ? ` assigned to ${nextTask.assigneeName}` : '';
  const activity = [
    createActivity(activityTitle, `${input.actor} updated ${input.stage}${assignmentDetail}.`, input.completed ? 'success' : 'info'),
    ...existingProject.activity,
  ];

  const { data, error } = await client
    .from('projects')
    .update({ tasks, activity, updated_at: now })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to update timeline stage.');
  }

  return mapProjectRow(data as ProjectRow);
}

export async function deleteProjectTask(input: DeleteProjectTaskInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId, { includeFiles: false });
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const existingTask = existingProject.tasks.find((task) => task.id === input.taskId);
  if (!existingTask) {
    throw new Error('Task not found.');
  }

  const now = new Date().toISOString();
  const deletedStage = (existingTask.stage ?? existingTask.text).trim();
  const deletedStageKey = normalizeTaskTitle(deletedStage);
  const tasks = existingProject.tasks.filter((task) => normalizeTaskTitle(task.stage ?? task.text) !== deletedStageKey);
  const { data: legacyProjectRow, error: legacyProjectError } = await client
    .from('projects')
    .select('tasks')
    .eq('id', input.projectId)
    .single();
  if (legacyProjectError) {
    throw legacyProjectError;
  }
  const legacyTaskSnapshot = mapLegacyTasks((legacyProjectRow as ProjectRow).tasks);
  const legacyTasks = legacyTaskSnapshot.filter((task) => normalizeTaskTitle(task.stage ?? task.text) !== deletedStageKey);
  const nextStage = tasks.find((task) => (task.stage ?? task.text).trim()) as TaskItem | undefined;
  const currentStage = deletedStage === existingProject.currentStage.trim()
    ? nextStage ? (nextStage.stage ?? nextStage.text).trim() : 'New Project'
    : existingProject.currentStage;

  // Soft-delete the relational task when this project has a relational workspace.
  const branchId = existingProject.branchId || existingProject.branch;
  const { data: workspaceData } = await client
    .from('rebrand_workspaces')
    .select('id')
    .eq('branch_id', branchId)
    .eq('is_primary', true)
    .maybeSingle();

  if (workspaceData?.id) {
    const { data: relationalTasks, error: relationalTasksError } = await client
      .from('project_tasks')
      .select('id, title')
      .eq('workspace_id', workspaceData.id)
      .is('deleted_at', null);

    if (relationalTasksError) {
      throw relationalTasksError;
    }

    const matchingRelationalTaskIds = (relationalTasks ?? [])
      .filter((task) => normalizeTaskTitle(task.title) === deletedStageKey)
      .map((task) => task.id);

    const { error: deleteError } = matchingRelationalTaskIds.length > 0
      ? await client
        .from('project_tasks')
        .update({ deleted_at: now, is_current: false })
        .in('id', matchingRelationalTaskIds)
        .eq('workspace_id', workspaceData.id)
      : { error: null };

    if (deleteError) {
      throw new Error(deleteError?.message ?? 'Unable to delete project task. The task may be read-only or no longer exists.');
    }
  }

  // Record activity
  const activity = [
    createActivity('Stage deleted', `${input.actor} deleted stage: ${existingTask.text}`, 'warning'),
    ...existingProject.activity,
  ];

  const { data: updatedProjectRow, error: projectUpdateError } = await client
    .from('projects')
    .update({ tasks: legacyTasks, current_stage: currentStage, activity, updated_at: now })
    .eq('id', input.projectId)
    .select('id')
    .maybeSingle();

  if (projectUpdateError || !updatedProjectRow) {
    throw new Error(projectUpdateError?.message ?? 'Unable to delete project task.');
  }

  return {
    ...existingProject,
    tasks,
    currentStage,
    activity,
    updatedAt: now,
  };
}

export async function renameProjectFile(input: RenameProjectFileInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  const nextName = input.nextName.trim();
  if (!nextName) {
    throw new Error('File name cannot be empty.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const relationalFile = existingProject.files.find((file) => input.filePath ? file.path === input.filePath : file.name === input.currentName);
  if (relationalFile?.id && existingProject.workspaceId) {
    const { error } = await client.from('project_files').update({ display_name: nextName, updated_at: new Date().toISOString() }).eq('id', relationalFile.id).is('deleted_at', null);
    if (error) throw error;
    await recordProjectFileActivity(input.projectId, existingProject.workspaceId, 'file_updated', relationalFile.id, relationalFile.taskId, { action: 'renamed', actor: input.actor, from: input.currentName, to: nextName });
    return getProjectById(input.projectId) as Promise<Project>;
  }

  const files = existingProject.files.map((file) => input.filePath
    ? (file.path === input.filePath ? { ...file, name: nextName } : file)
    : (file.name === input.currentName ? { ...file, name: nextName } : file));
  const activity = [createActivity('File renamed', `${input.actor} renamed ${input.currentName} to ${nextName}.`), ...existingProject.activity];
  const { data, error } = await client.from('projects').update({ files, activity, updated_at: new Date().toISOString() }).eq('id', input.projectId).select('*').single();
  if (error || !data) throw error ?? new Error('Unable to rename project file.');
  return mapProjectRow(data as ProjectRow);
}

export async function deleteProjectFile(input: DeleteProjectFileInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const relationalFile = existingProject.files.find((file) => input.filePath ? file.path === input.filePath : file.name === input.fileName);
  if (relationalFile?.id && existingProject.workspaceId) {
    const deletedBy = await getCurrentProfileId();
    const { data: projectRow, error: projectRowError } = await client
      .from('projects')
      .select('files')
      .eq('id', input.projectId)
      .single();
    if (projectRowError) {
      throw projectRowError;
    }

    const legacyFiles = mapLegacyFiles((projectRow as ProjectRow).files);
    const remainingLegacyFiles = legacyFiles.filter((file) => file.id !== relationalFile.id && file.path !== relationalFile.path);
    const legacyFilesChanged = remainingLegacyFiles.length !== legacyFiles.length;
    if (legacyFilesChanged) {
      const { error: legacyFileError } = await client
        .from('projects')
        .update({ files: remainingLegacyFiles, updated_at: new Date().toISOString() })
        .eq('id', input.projectId);
      if (legacyFileError) {
        throw legacyFileError;
      }
    }

    const { error } = await client.from('project_files').update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy, updated_at: new Date().toISOString() }).eq('id', relationalFile.id).is('deleted_at', null);
    if (error) {
      throw error;
    }

    if (relationalFile.path) {
      await client.storage.from(projectFilesBucket).remove([relationalFile.path]);
    }

    await recordProjectFileActivity(input.projectId, existingProject.workspaceId, 'file_updated', relationalFile.id, relationalFile.taskId, { action: 'deleted', actor: input.actor, display_name: input.fileName });
    return getProjectById(input.projectId) as Promise<Project>;
  }

  const files = existingProject.files.filter((file) => input.filePath ? file.path !== input.filePath : file.name !== input.fileName);
  const activity = [createActivity('File deleted', `${input.actor} deleted ${input.fileName}.`), ...existingProject.activity];
  const { data, error } = await client.from('projects').update({ files, activity, updated_at: new Date().toISOString() }).eq('id', input.projectId).select('*').single();
  if (error || !data) throw error ?? new Error('Unable to delete project file.');
  if (input.filePath) await client.storage.from(projectFilesBucket).remove([input.filePath]);
  return mapProjectRow(data as ProjectRow);
}

export async function applyProjectVoiceUpdate(input: ApplyProjectVoiceUpdateInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const cleanTasks = (input.tasks ?? []).map((task) => task.trim()).filter(Boolean);
  const comment = input.comment?.trim();
  const now = new Date().toISOString();
  const nextTasks: TaskItem[] = [
    ...cleanTasks.map((task) => ({ id: createTaskId(), text: task, completed: false, createdAt: now })),
    ...existingProject.tasks,
  ];
  const nextComments = comment
    ? [{ date: todayLabel(), author: input.actor, message: comment }, ...existingProject.comments]
    : existingProject.comments;
  const changedFields = [
    input.currentStage && input.currentStage !== existingProject.currentStage ? `stage to ${input.currentStage}` : null,
    input.status && input.status !== existingProject.status ? `status to ${input.status.replace(/_/g, ' ')}` : null,
    input.installationDate && input.installationDate !== existingProject.installationDate ? `installation date to ${input.installationDate}` : null,
    input.targetDate && input.targetDate !== existingProject.targetDate ? `target date to ${input.targetDate}` : null,
    cleanTasks.length > 0 ? `${cleanTasks.length} task${cleanTasks.length === 1 ? '' : 's'}` : null,
    comment ? 'comment' : null,
  ].filter(Boolean);

  const activity = [
    createActivity(
      'Voice update applied',
      `${input.actor} applied a voice batch update${changedFields.length > 0 ? `: ${changedFields.join(', ')}` : '.'}`,
      input.status === 'delayed' || input.status === 'on_hold' ? 'warning' : input.status === 'completed' ? 'success' : 'info',
    ),
    ...existingProject.activity,
  ];

  const { data, error } = await client
    .from('projects')
    .update({
      current_stage: input.currentStage ?? existingProject.currentStage,
      status: input.status ?? existingProject.status,
      progress: input.progress ?? existingProject.progress,
      target_date: input.targetDate ?? existingProject.targetDate,
      installation_date: input.installationDate ?? existingProject.installationDate,
      completion_date: input.completionDate ?? existingProject.completionDate,
      tasks: nextTasks,
      comments: nextComments,
      activity,
      updated_at: now,
    })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to apply voice update.');
  }

  const updatedProject = mapProjectRow(data as ProjectRow);

  await notifyProjectChange({
    project: updatedProject,
    actor: input.actor,
    message: comment || changedFields.join(', ') || 'Voice update applied.',
    changeType: 'voice_update',
  });

  return updatedProject;
}

export async function uploadVoiceUpdateAudio(file: File): Promise<UploadVoiceUpdateAudioResult> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  validateVoiceUpdateFile(file);
  await hydrateAuthSession();

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const userId = sessionData.session?.user.id;

  if (sessionError || !userId) {
    throw new Error('A signed-in user is required to upload voice notes.');
  }

  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const { error } = await client.storage
    .from(voiceUpdatesBucket)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || undefined,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return { path, name: file.name };
}

export async function transcribeVoiceUpdateAudio(path: string): Promise<string> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const { data, error } = await client.functions.invoke('transcribe-voice-update', {
    body: { path },
  });

  if (error) {
    throw error;
  }

  const transcript = typeof data?.transcript === 'string' ? data.transcript.trim() : '';

  if (!transcript) {
    throw new Error('No transcript was returned for this voice note.');
  }

  return transcript;
}

export function getMockUsers() {
  return [] as UserRecord[];
}

export function getRoleUsers(role: Role) {
  return [] as UserRecord[];
}