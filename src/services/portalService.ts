import { supabase } from '../lib/supabase';
import type { ActivityItem, CommentItem, Project, Role, UserRecord } from '../types/domain';

export interface PortalSummary {
  metrics: Array<{ label: string; value: number }>;
  recentActivity: ActivityItem[];
  todayTasks: string[];
}

type ProjectRow = {
  id: string;
  province: string;
  town: string;
  branch: string;
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
  files: string[] | null;
  tasks: string[] | null;
  comments: CommentItem[] | null;
  activity: ActivityItem[] | null;
};

async function hydrateAuthSession() {
  await supabase?.auth.getSession();
}

export type CreateProjectInput = {
  id: string;
  province: string;
  town: string;
  branch: string;
  manager: string;
  managerEmail: string;
  installer: string;
  designer: string;
  currentStage: Project['currentStage'];
  status: Project['status'];
  targetDate: string;
  installationDate: string;
  completionDate: string;
  progress: number;
  notes: string;
};

function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    province: row.province,
    town: row.town,
    branch: row.branch,
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
    files: row.files ?? [],
    tasks: row.tasks ?? [],
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
  const inProgress = data.filter((row) => ['in_progress', 'awaiting_approval'].includes(row.status)).length;
  const delayed = data.filter((row) => row.status === 'delayed').length;
  const recentActivity = data.flatMap((row) => row.activity ?? []).slice(0, 4);
  const todayTasks = [...new Set(data.flatMap((row) => row.tasks ?? []))].slice(0, 3);

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

  const { data, error } = await client
    .from('projects')
    .insert({
      id: input.id,
      province: input.province,
      town: input.town,
      branch: input.branch,
      manager: input.manager,
      manager_email: input.managerEmail,
      installer: input.installer,
      designer: input.designer,
      current_stage: input.currentStage,
      status: input.status,
      target_date: input.targetDate,
      installation_date: input.installationDate,
      completion_date: input.completionDate,
      progress: input.progress,
      branch_manager_view_only: false,
      notes: input.notes,
      files: [],
      tasks: [],
      comments: [],
      activity: [],
    })
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to create project.');
  }

  return mapProjectRow(data as ProjectRow);
}

export function getMockUsers() {
  return [] as UserRecord[];
}

export function getRoleUsers(role: Role) {
  return [] as UserRecord[];
}

export const reportCards = ['Completed Projects', 'Outstanding Quotes', 'Delayed Projects', 'Projects by Province', 'Projects by Installer', 'Projects This Week'];