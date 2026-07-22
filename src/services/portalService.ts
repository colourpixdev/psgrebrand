import { supabase } from '../lib/supabase';
import type { ActivityItem, CommentItem, Project, ProjectFile, ProjectTemplateId, Role, TaskItem, UserRecord } from '../types/domain';
import { defaultWorkspace, rolloutAppEmail } from '../constants/workspaces';
import { defaultProjectTemplate, getProjectTemplate } from '../constants/projectTemplates';
import { timelineStages } from '../constants/portal';

export interface PortalSummary {
  metrics: Array<{ label: string; value: number }>;
  recentActivity: ActivityItem[];
  todayTasks: string[];
}

type ProjectRow = {
  id: string;
  workspace_id?: string | null;
  workspace_name?: string | null;
  client_company?: string | null;
  graphics_partner?: string | null;
  project_type?: string | null;
  project_type_name?: string | null;
  site_label?: string | null;
  delivery_partner_label?: string | null;
  branch_id?: string | null;
  branch?: string | null;
  province?: string | null;
  town?: string | null;
  physical_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  manager: string;
  manager_email: string;
  installer: string;
  designer: string;
  current_stage: string;
  status: Project['status'];
  target_date: string;
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

const projectFilesBucket = 'project-files';
const voiceUpdatesBucket = 'voice-updates';
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

function normalizeProjectFiles(files: unknown[] | null): ProjectFile[] {
  if (!Array.isArray(files)) {
    return [];
  }

  return files
    .map((file) => {
      if (typeof file === 'string') {
        return { name: file };
      }

      if (file && typeof file === 'object' && 'name' in file && typeof file.name === 'string') {
        return file as ProjectFile;
      }

      return null;
    })
    .filter((file): file is ProjectFile => Boolean(file));
}

function createTaskId() {
  return globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createQuestionId() {
  return globalThis.crypto?.randomUUID?.() ?? `question-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function taskSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'task';
}

function isTimelineStage(value: unknown): value is Project['currentStage'] {
  return typeof value === 'string' && timelineStages.includes(value as Project['currentStage']);
}

function normalizeProjectTasks(tasks: unknown[] | null): TaskItem[] {
  if (!Array.isArray(tasks)) {
    return [];
  }

  return tasks
    .map((task, index): TaskItem | null => {
      if (typeof task === 'string') {
        return {
          id: `legacy-${index}-${taskSlug(task)}`,
          text: task,
          completed: false,
        };
      }

      if (task && typeof task === 'object' && 'text' in task && typeof task.text === 'string') {
        const candidate = task as Partial<TaskItem>;
        const candidateText = candidate.text ?? '';
        return {
          id: typeof candidate.id === 'string' ? candidate.id : `legacy-${index}-${taskSlug(candidateText)}`,
          text: candidateText,
          completed: Boolean(candidate.completed),
          stage: isTimelineStage(candidate.stage) ? candidate.stage : undefined,
          assigneeName: typeof candidate.assigneeName === 'string' ? candidate.assigneeName : undefined,
          assigneeEmail: typeof candidate.assigneeEmail === 'string' ? candidate.assigneeEmail : undefined,
          createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : undefined,
          completedAt: typeof candidate.completedAt === 'string' ? candidate.completedAt : undefined,
        };
      }

      return null;
    })
    .filter((task): task is TaskItem => Boolean(task));
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

  if (file.type && !allowedProjectFileTypes.has(file.type)) {
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
  id: string;
  workspaceName?: string;
  clientCompany?: string;
  graphicsPartner?: string;
  projectType?: ProjectTemplateId;
  branchId?: string;
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
  installationDate?: string;
  completionDate?: string;
  progress: number;
  notes?: string;
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

async function notifyProjectChange(input: ProjectChangeNotificationInput) {
  const client = supabase;

  if (!client) {
    return;
  }

  try {
    const { error } = await client.functions.invoke('notify-project-change', {
      body: {
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
      },
    });

    if (error) {
      console.warn('Project notification email could not be sent.', error.message);
    }
  } catch (error) {
    console.warn('Project notification email could not be sent.', error);
  }
}

export type UpdateProjectWorkflowInput = {
  projectId: string;
  currentStage: Project['currentStage'];
  status: Project['status'];
  progress: number;
  actor: string;
};

export type AddProjectCommentInput = {
  projectId: string;
  author: string;
  message: string;
};

export type UpdateProjectNotesInput = {
  projectId: string;
  actor: string;
  notes: string;
};

export type AskProjectQuestionInput = {
  projectId: string;
  author: string;
  authorEmail: string;
  message: string;
  requestStage?: Project['currentStage'];
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
};

export type UpdateProjectTaskInput = {
  projectId: string;
  taskId: string;
  text?: string;
  completed?: boolean;
  stage?: Project['currentStage'];
  assigneeName?: string;
  assigneeEmail?: string;
  actor: string;
};

export type UpsertProjectStageTaskInput = {
  projectId: string;
  stage: Project['currentStage'];
  actor: string;
  completed?: boolean;
  assigneeName?: string;
  assigneeEmail?: string;
};

export type RenameProjectFileInput = {
  projectId: string;
  filePath?: string;
  currentName: string;
  nextName: string;
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
  return new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
}

function createActivity(title: string, detail: string, type: ActivityItem['type'] = 'info'): ActivityItem {
  return {
    date: 'Today',
    title,
    detail,
    type,
  };
}

function mapProjectRow(row: ProjectRow): Project {
  const template = getProjectTemplate(row.project_type);
  const mappedBranchId = row.branch_id ?? row.branch ?? 'unassigned';
  const mappedBranch = row.branch ?? row.branch_id ?? 'Unassigned';

  return {
    id: row.id,
    branchId: mappedBranchId,
    branch: mappedBranch,
    workspaceId: row.workspace_id ?? defaultWorkspace.id,
    workspaceName: row.workspace_name ?? defaultWorkspace.name,
    clientCompany: row.client_company ?? defaultWorkspace.clientCompany,
    graphicsPartner: row.graphics_partner ?? defaultWorkspace.graphicsPartner,
    projectType: template.id,
    projectTypeName: row.project_type_name ?? template.name,
    siteLabel: row.site_label ?? template.siteLabel,
    deliveryPartnerLabel: row.delivery_partner_label ?? template.deliveryPartnerLabel,
    province: row.province ?? 'Not captured',
    town: row.town ?? 'Not captured',
    physicalAddress: row.physical_address ?? '',
    latitude: typeof row.latitude === 'number' ? row.latitude : null,
    longitude: typeof row.longitude === 'number' ? row.longitude : null,
    manager: row.manager,
    managerEmail: row.manager_email,
    installer: row.installer,
    designer: row.designer,
    currentStage: row.current_stage as Project['currentStage'],
    status: row.status,
    targetDate: row.target_date,
    installationDate: row.installation_date,
    completionDate: row.completion_date,
    updatedAt: row.updated_at,
    progress: row.progress ?? 0,
    branchManagerViewOnly: Boolean(row.branch_manager_view_only),
    notes: row.notes ?? '',
    files: normalizeProjectFiles(row.files),
    tasks: normalizeProjectTasks(row.tasks),
    comments: row.comments ?? [],
    activity: row.activity ?? [],
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

  const { data, error } = await client.from('projects').select('status, tasks, activity');

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
  const todayTasks = [...new Set(data.flatMap((row) => normalizeProjectTasks(row.tasks ?? []).filter((task) => !task.completed).map((task) => task.text)))].slice(0, 3);

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

export async function getProjects(): Promise<Project[]> {
  const client = supabase;

  if (!client) {
    return [];
  }

  await hydrateAuthSession();

  const { data, error } = await client.from('projects').select('*').order('updated_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as ProjectRow[]).map(mapProjectRow);
}

export async function getProjectById(projectId: string): Promise<Project | undefined> {
  const client = supabase;

  if (!client) {
    return undefined;
  }

  await hydrateAuthSession();

  const { data, error } = await client.from('projects').select('*').eq('id', projectId).maybeSingle();

  if (error || !data) {
    return undefined;
  }

  return mapProjectRow(data as ProjectRow);
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const workspaceName = input.workspaceName?.trim() || defaultWorkspace.name;
  const clientCompany = input.clientCompany?.trim() || defaultWorkspace.clientCompany;
  const graphicsPartner = input.graphicsPartner?.trim() || defaultWorkspace.graphicsPartner;
  const template = input.projectType ? getProjectTemplate(input.projectType) : defaultProjectTemplate;
  const resolvedBranchId = input.branchId?.trim() || input.branch.trim();
  const basePayload = {
    id: input.id.trim(),
    branch_id: resolvedBranchId,
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
    current_stage: input.currentStage,
    status: input.status,
    target_date: input.targetDate?.trim() ?? '',
    installation_date: input.installationDate?.trim() ?? '',
    completion_date: input.completionDate?.trim() ?? '',
    progress: input.progress,
    branch_manager_view_only: false,
    notes: input.notes?.trim() ?? '',
    files: [],
    tasks: [],
    comments: [],
    activity: [createActivity('Project Created', `${input.id} was created in ${workspaceName} for ${clientCompany}.`, 'success')],
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
    delivery_partner_label: template.deliveryPartnerLabel,
  };

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
    error?.message.toLowerCase().includes('site_label') ||
    error?.message.toLowerCase().includes('delivery_partner_label')
  ) {
    const fallbackResult = await client
      .from('projects')
      .insert(basePayload)
      .select('*')
      .single();

    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error || !data) {
    throw error ?? new Error('Unable to create project.');
  }

  return mapProjectRow(data as ProjectRow);
}

export async function uploadProjectFile(projectId: string, file: File, currentFiles: ProjectFile[]): Promise<ProjectFile[]> {
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

  const nextFiles = [
    ...currentFiles,
    {
      name: file.name,
      path,
      size: file.size,
      type: file.type || undefined,
      uploadedAt: new Date().toISOString(),
    },
  ];

  const { error: updateError } = await client
    .from('projects')
    .update({ files: nextFiles, updated_at: new Date().toISOString() })
    .eq('id', projectId);

  if (updateError) {
    await client.storage.from(projectFilesBucket).remove([path]);
    throw updateError;
  }

  return nextFiles;
}

export async function getProjectFileUrl(file: ProjectFile, options: { download?: boolean } = {}) {
  const client = supabase;

  if (!client || !file.path) {
    return null;
  }

  await hydrateAuthSession();

  const { data, error } = await client.storage
    .from(projectFilesBucket)
    .createSignedUrl(file.path, 60 * 60, options.download ? { download: file.name } : undefined);

  if (error) {
    throw error;
  }

  return data.signedUrl;
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

  const comments = [
    {
      date: todayLabel(),
      author: input.author,
      message,
    },
    ...existingProject.comments,
  ];
  const activity = [createActivity('Comment added', `${input.author} added a project comment.`), ...existingProject.activity];

  const { data, error } = await client
    .from('projects')
    .update({ comments, activity, updated_at: new Date().toISOString() })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to add project comment.');
  }

  const updatedProject = mapProjectRow(data as ProjectRow);

  await notifyProjectChange({
    project: updatedProject,
    actor: input.author,
    message,
    changeType: isVoiceNoteMessage(message) ? 'voice_note' : 'note',
  });

  return updatedProject;
}

export async function updateProjectNotes(input: UpdateProjectNotesInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const notes = input.notes.trim();
  const activity = [createActivity('Notes updated', `${input.actor} updated project notes.`), ...existingProject.activity];

  const { data, error } = await client
    .from('projects')
    .update({ notes, activity, updated_at: new Date().toISOString() })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to update project notes.');
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
  const comments: CommentItem[] = [
    {
      id: createQuestionId(),
      kind: 'question',
      date: todayLabel(),
      author: input.author,
      message,
      status: 'open',
      requestStage: input.requestStage,
      requesterEmail: input.authorEmail,
      requestedAt: now,
      unreadForRequester: false,
    },
    ...existingProject.comments,
  ];
  const activity = [createActivity('Question raised', `${input.author} asked Colourpix for an update${input.requestStage ? ` on ${input.requestStage}` : ''}.`), ...existingProject.activity];

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
    throw new Error('Task cannot be empty.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const tasks: TaskItem[] = [{ id: createTaskId(), text: task, completed: false, stage: input.stage, assigneeName: input.assigneeName, assigneeEmail: input.assigneeEmail, createdAt: new Date().toISOString() }, ...existingProject.tasks];
  const activity = [createActivity('Task added', `${input.actor} added task: ${task}${input.assigneeName ? ` for ${input.assigneeName}` : ''}`), ...existingProject.activity];

  const { data, error } = await client
    .from('projects')
    .update({ tasks, activity, updated_at: new Date().toISOString() })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to add project task.');
  }

  return mapProjectRow(data as ProjectRow);
}

export async function updateProjectTask(input: UpdateProjectTaskInput): Promise<Project> {
  const client = supabase;

  if (!client) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const existingTask = existingProject.tasks.find((task) => task.id === input.taskId);
  if (!existingTask) {
    throw new Error('Task not found.');
  }

  const text = input.text?.trim();
  if (input.text !== undefined && !text) {
    throw new Error('Task cannot be empty.');
  }

  const tasks = existingProject.tasks.map((task) => {
    if (task.id !== input.taskId) {
      return task;
    }

    const completed = input.completed ?? task.completed;
    return {
      ...task,
      text: text ?? task.text,
      completed,
      stage: input.stage ?? task.stage,
      assigneeName: input.assigneeName !== undefined ? input.assigneeName || undefined : task.assigneeName,
      assigneeEmail: input.assigneeEmail !== undefined ? input.assigneeEmail || undefined : task.assigneeEmail,
      completedAt: completed ? task.completedAt ?? new Date().toISOString() : undefined,
    };
  });
  const action = input.completed === undefined ? 'updated' : input.completed ? 'completed' : 'reopened';
  const activity = [
    createActivity(
      input.completed === undefined ? 'Task updated' : input.completed ? 'Task completed' : 'Task reopened',
      `${input.actor} ${action} task: ${text ?? existingTask.text}`,
      input.completed ? 'success' : 'info',
    ),
    ...existingProject.activity,
  ];

  const { data, error } = await client
    .from('projects')
    .update({ tasks, activity, updated_at: new Date().toISOString() })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to update project task.');
  }

  return mapProjectRow(data as ProjectRow);
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
  const existingTask = existingProject.tasks.find((task) => task.stage === input.stage);
  const completed = input.completed ?? existingTask?.completed ?? false;

  const nextTask: TaskItem = {
    id: existingTask?.id ?? createTaskId(),
    text: existingTask?.text ?? input.stage,
    completed,
    stage: input.stage,
    assigneeName: input.assigneeName !== undefined ? input.assigneeName || undefined : existingTask?.assigneeName,
    assigneeEmail: input.assigneeEmail !== undefined ? input.assigneeEmail || undefined : existingTask?.assigneeEmail,
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

  const existingProject = await getProjectById(input.projectId);
  if (!existingProject) {
    throw new Error('Project not found.');
  }

  const existingTask = existingProject.tasks.find((task) => task.id === input.taskId);
  if (!existingTask) {
    throw new Error('Task not found.');
  }

  const tasks = existingProject.tasks.filter((task) => task.id !== input.taskId);
  const activity = [createActivity('Task deleted', `${input.actor} deleted task: ${existingTask.text}`, 'warning'), ...existingProject.activity];

  const { data, error } = await client
    .from('projects')
    .update({ tasks, activity, updated_at: new Date().toISOString() })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to delete project task.');
  }

  return mapProjectRow(data as ProjectRow);
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

  const files = existingProject.files.map((file) => {
    const matches = input.filePath ? file.path === input.filePath : file.name === input.currentName;
    return matches ? { ...file, name: nextName } : file;
  });
  const activity = [createActivity('File renamed', `${input.actor} renamed ${input.currentName} to ${nextName}.`), ...existingProject.activity];

  const { data, error } = await client
    .from('projects')
    .update({ files, activity, updated_at: new Date().toISOString() })
    .eq('id', input.projectId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to rename project file.');
  }

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