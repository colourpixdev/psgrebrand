export type Role = 'colourpix_admin' | 'psg_user' | 'psg_head_office' | 'psg_branch_manager' | 'sign_company';

export function normalizeRole(role: unknown): Role {
  const value = typeof role === 'string' ? role.trim().toLowerCase() : '';

  if (value === 'colourpix_admin' || value === 'admin') {
    return 'colourpix_admin';
  }

  if (value === 'psg_user' || value === 'psg' || value === 'psg_head_office' || value === 'psg_branch_manager' || value === 'sign_company') {
    return 'psg_user';
  }

  return 'psg_user';
}

export interface Workspace {
  id: string;
  name: string;
  clientCompany: string;
  graphicsPartner: string;
  clientLogoUrl?: string;
  servicePartnerLogoUrl?: string;
  description: string;
  status: 'active' | 'planning' | 'archived';
}

export type ProjectTemplateId = 'signage_rollout' | 'general_rollout' | 'service_delivery';

// Free text: projects can add/remove their own timeline stages, so this is no longer a fixed set.
export type ProjectStage = string;

export type ProjectStatus = 'on_schedule' | 'pending' | 'open' | 'completed' | 'busy' | 'in_progress' | 'awaiting_approval' | 'delayed' | 'on_hold' | 'cancelled';

export type Division = 'Wealth' | 'Insure' | 'Wealth Insure' | 'Asset' | 'Trust';

export interface ContactPerson {
  name: string;
  email?: string;
  phone?: string;
  designation: string;
}

export interface TaskAssignee {
  id?: string;
  name: string;
  email: string;
  designation: string;
}

export interface Branch {
  id: string;
  code?: string;
  name: string;
  division: Division;
  province: string;
  city?: string;
  town: string;
  physicalAddress: string;
  signageCompany?: string;
  signageContactName?: string;
  signageContactPhone?: string;
  signageContactEmail?: string;
  signageAddress?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contacts?: ContactPerson[];
  marketingCoordinatorName?: string;
  marketingCoordinatorEmail?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface Project {
  id: string;
  branchId: string;
  branchCode?: string;
  branch: string;
  workspaceId: string;
  workspaceName: string;
  clientCompany: string;
  graphicsPartner: string;
  projectType: ProjectTemplateId;
  projectTypeName: string;
  siteLabel: string;
  province: string;
  town: string;
  physicalAddress: string;
  latitude: number | null;
  longitude: number | null;
  manager: string;
  managerEmail: string;
  designer: string;
  currentStage: ProjectStage;
  status: ProjectStatus;
  projectStartDate?: string;
  targetDate: string;
  briefRequestedDate: string;
  installationDate: string;
  completionDate: string;
  updatedAt: string;
  progress: number;
  branchManagerViewOnly: boolean;
  notes: string;
  files: ProjectFile[];
  tasks: TaskItem[];
  comments: CommentItem[];
  activity: ActivityItem[];
}

export interface ProjectFile {
  id?: string;
  name: string;
  path?: string;
  size?: number;
  type?: string;
  uploadedAt?: string;
  taskId?: string;
}

export type TaskStatus = 'pending' | 'busy' | 'done';

export interface TaskItem {
  id: string;
  legacyTaskId?: string;
  text: string;
  completed: boolean;
  status?: TaskStatus;
  assigneeId?: string;
  stage?: ProjectStage;
  assigneeName?: string;
  assigneeEmail?: string;
  assignees?: TaskAssignee[];
  startedDate?: string;
  dueDate?: string;
  installationRequest?: string;
  createdAt?: string;
  completedAt?: string;
  completedByName?: string;
  completedByEmail?: string;
  sortOrder?: number;
}

export interface CommentItem {
  id?: string;
  taskId?: string;
  kind?: 'comment' | 'question';
  date: string;
  author: string;
  message: string;
  assignees?: TaskAssignee[];
  status?: 'open' | 'answered';
  requestStage?: ProjectStage;
  requesterEmail?: string;
  requestedAt?: string;
  answer?: string;
  answeredBy?: string;
  answeredAt?: string;
  unreadForRequester?: boolean;
  relatedChanges?: string[];
}

export interface ActivityItem {
  date: string;
  title: string;
  detail: string;
  type: 'success' | 'info' | 'warning';
}

export interface UserRecord {
  name: string;
  role: Role;
  branch?: string;
  email: string;
  themePreference?: 'dark' | 'light';
  company?: string;
  profileTitle?: string;
  avatarUrl?: string;
  logoUrl?: string;
  workspaceIds?: string[];
  canAccessAllWorkspaces?: boolean;
  isPlatformOwner?: boolean;
  permissionOverrides?: Record<string, boolean>;
}
