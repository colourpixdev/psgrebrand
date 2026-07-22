export type Role = 'colourpix_admin' | 'psg_head_office' | 'psg_branch_manager' | 'sign_company';

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

export type ProjectStage =
  | 'New Project'
  | 'Awaiting Information'
  | 'Site Survey'
  | 'Measurements Received'
  | 'Artwork In Progress'
  | 'Artwork Sent'
  | 'Awaiting Approval'
  | 'Approved'
  | 'Quotation Requested'
  | 'Quotation Received'
  | 'PO Issued'
  | 'Production'
  | 'Installation Scheduled'
  | 'Installation In Progress'
  | 'Installed'
  | 'Photos Uploaded'
  | 'Client Signoff'
  | 'Completed'
  | 'On Hold'
  | 'Delayed'
  | 'Cancelled';

export type ProjectStatus = 'completed' | 'busy' | 'in_progress' | 'awaiting_approval' | 'delayed' | 'on_hold' | 'cancelled';

export type Division = 'Wealth' | 'Insure' | 'Wealth Insure' | 'Asset' | 'Trust';

export interface Branch {
  id: string;
  name: string;
  division: Division;
  province: string;
  town: string;
  physicalAddress: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  branchId: string;
  workspaceId: string;
  workspaceName: string;
  clientCompany: string;
  graphicsPartner: string;
  projectType: ProjectTemplateId;
  projectTypeName: string;
  siteLabel: string;
  deliveryPartnerLabel: string;
  manager: string;
  managerEmail: string;
  installer: string;
  designer: string;
  currentStage: ProjectStage;
  status: ProjectStatus;
  targetDate: string;
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
  name: string;
  path?: string;
  size?: number;
  type?: string;
  uploadedAt?: string;
}

export interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  stage?: ProjectStage;
  assigneeName?: string;
  assigneeEmail?: string;
  createdAt?: string;
  completedAt?: string;
}

export interface CommentItem {
  id?: string;
  kind?: 'comment' | 'question';
  date: string;
  author: string;
  message: string;
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
  company?: string;
  profileTitle?: string;
  avatarUrl?: string;
  logoUrl?: string;
  workspaceIds?: string[];
  canAccessAllWorkspaces?: boolean;
  isPlatformOwner?: boolean;
  permissionOverrides?: Record<string, boolean>;
}
