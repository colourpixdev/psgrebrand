export type Role = 'colourpix_admin' | 'psg_head_office' | 'psg_branch_manager' | 'sign_company';

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

export type ProjectStatus = 'completed' | 'in_progress' | 'awaiting_approval' | 'delayed' | 'on_hold' | 'cancelled';

export interface Project {
  id: string;
  province: string;
  town: string;
  branch: string;
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
  createdAt?: string;
  completedAt?: string;
}

export interface CommentItem {
  date: string;
  author: string;
  message: string;
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
}
