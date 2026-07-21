import type { Project, Role, UserRecord } from '../types/domain';
import { isAccessControlAdmin, isPlatformOwnerEmail } from '../constants/workspaces';

export type Permission =
  | 'create_project'
  | 'invite_users'
  | 'manage_workflow'
  | 'upload_files'
  | 'add_comments'
  | 'add_tasks'
  | 'batch_voice_updates'
  | 'export_reports'
  | 'view_settings';

type ProjectAccessPolicy = {
  canViewAssignedProjects: boolean;
  canViewAllProjects: boolean;
  canCreateProjects: boolean;
  canArchiveProjects: boolean;
  canDeleteProjects: boolean;
  canExportProject: boolean;
  canDuplicateProject: boolean;
};

type WorkflowPolicy = {
  canChangeStage: boolean;
  canChangeStatus: boolean;
  canChangeProgress: boolean;
  canMarkCompleted: boolean;
  canReopenCompletedProjects: boolean;
  canChangeTargetDates: boolean;
};

type CommunicationPolicy = {
  canCreateComments: boolean;
  canReply: boolean;
  canEditOwnComments: boolean;
  canDeleteOwnComments: boolean;
  canDeleteOthersComments: boolean;
  canAskQuestions: boolean;
  canAnswerQuestions: boolean;
  canCloseQuestions: boolean;
  canMentionUsers: boolean;
  canCreateInternalNotes: boolean;
};

type FilePolicy = {
  canUploadFiles: boolean;
  canDownloadFiles: boolean;
  canDeleteFiles: boolean;
  canReplaceFiles: boolean;
  allowedFileTypes: string[];
};

type TaskPolicy = {
  canCreateTasks: boolean;
  canAssignTasks: boolean;
  canCompleteTasks: boolean;
  canDeleteTasks: boolean;
  canReassignTasks: boolean;
};

type ReportsPolicy = {
  canViewReports: boolean;
  canExportReports: boolean;
  canCreateCustomReports: boolean;
  canScheduleReports: boolean;
};

type UserManagementPolicy = {
  canInviteUsers: boolean;
  canDisableUsers: boolean;
  canEditUsers: boolean;
  canResetPasswords: boolean;
};

type NotificationsPolicy = {
  receiveEmail: boolean;
  receiveInApp: boolean;
  receiveSms: boolean;
  receiveWhatsApp: boolean;
  notifyOn: Array<'question' | 'task' | 'project_updated' | 'stage_changed' | 'file_uploaded'>;
};

export type RolePolicy = {
  projectAccess: ProjectAccessPolicy;
  workflow: WorkflowPolicy;
  communication: CommunicationPolicy;
  files: FilePolicy;
  tasks: TaskPolicy;
  reports: ReportsPolicy;
  userManagement: UserManagementPolicy;
  notifications: NotificationsPolicy;
};

export type AccessControlItem = {
  key: string;
  label: string;
  description: string;
};

export type AccessControlGroup = {
  id: keyof RolePolicy;
  label: string;
  items: AccessControlItem[];
};

const operationalFileTypes = ['PDF', 'DOCX', 'XLSX', 'JPG', 'PNG', 'DWG', 'AI'];

export const rolePolicies: Record<Role, RolePolicy> = {
  colourpix_admin: {
    projectAccess: { canViewAssignedProjects: true, canViewAllProjects: true, canCreateProjects: true, canArchiveProjects: true, canDeleteProjects: true, canExportProject: true, canDuplicateProject: true },
    workflow: { canChangeStage: true, canChangeStatus: true, canChangeProgress: true, canMarkCompleted: true, canReopenCompletedProjects: true, canChangeTargetDates: true },
    communication: { canCreateComments: true, canReply: true, canEditOwnComments: true, canDeleteOwnComments: true, canDeleteOthersComments: true, canAskQuestions: true, canAnswerQuestions: true, canCloseQuestions: true, canMentionUsers: true, canCreateInternalNotes: true },
    files: { canUploadFiles: true, canDownloadFiles: true, canDeleteFiles: true, canReplaceFiles: true, allowedFileTypes: operationalFileTypes },
    tasks: { canCreateTasks: true, canAssignTasks: true, canCompleteTasks: true, canDeleteTasks: true, canReassignTasks: true },
    reports: { canViewReports: true, canExportReports: true, canCreateCustomReports: true, canScheduleReports: true },
    userManagement: { canInviteUsers: true, canDisableUsers: true, canEditUsers: true, canResetPasswords: true },
    notifications: { receiveEmail: true, receiveInApp: true, receiveSms: false, receiveWhatsApp: false, notifyOn: ['question', 'task', 'project_updated', 'stage_changed', 'file_uploaded'] },
  },
  psg_head_office: {
    projectAccess: { canViewAssignedProjects: true, canViewAllProjects: true, canCreateProjects: false, canArchiveProjects: false, canDeleteProjects: false, canExportProject: true, canDuplicateProject: false },
    workflow: { canChangeStage: true, canChangeStatus: true, canChangeProgress: true, canMarkCompleted: false, canReopenCompletedProjects: false, canChangeTargetDates: false },
    communication: { canCreateComments: true, canReply: true, canEditOwnComments: true, canDeleteOwnComments: false, canDeleteOthersComments: false, canAskQuestions: true, canAnswerQuestions: false, canCloseQuestions: false, canMentionUsers: true, canCreateInternalNotes: false },
    files: { canUploadFiles: true, canDownloadFiles: true, canDeleteFiles: false, canReplaceFiles: false, allowedFileTypes: operationalFileTypes },
    tasks: { canCreateTasks: true, canAssignTasks: false, canCompleteTasks: true, canDeleteTasks: false, canReassignTasks: false },
    reports: { canViewReports: true, canExportReports: true, canCreateCustomReports: false, canScheduleReports: false },
    userManagement: { canInviteUsers: false, canDisableUsers: false, canEditUsers: false, canResetPasswords: false },
    notifications: { receiveEmail: true, receiveInApp: true, receiveSms: false, receiveWhatsApp: false, notifyOn: ['question', 'task', 'project_updated', 'stage_changed', 'file_uploaded'] },
  },
  psg_branch_manager: {
    projectAccess: { canViewAssignedProjects: true, canViewAllProjects: false, canCreateProjects: false, canArchiveProjects: false, canDeleteProjects: false, canExportProject: true, canDuplicateProject: false },
    workflow: { canChangeStage: false, canChangeStatus: false, canChangeProgress: false, canMarkCompleted: false, canReopenCompletedProjects: false, canChangeTargetDates: false },
    communication: { canCreateComments: false, canReply: true, canEditOwnComments: true, canDeleteOwnComments: false, canDeleteOthersComments: false, canAskQuestions: true, canAnswerQuestions: false, canCloseQuestions: false, canMentionUsers: true, canCreateInternalNotes: false },
    files: { canUploadFiles: true, canDownloadFiles: true, canDeleteFiles: false, canReplaceFiles: false, allowedFileTypes: operationalFileTypes },
    tasks: { canCreateTasks: false, canAssignTasks: false, canCompleteTasks: false, canDeleteTasks: false, canReassignTasks: false },
    reports: { canViewReports: true, canExportReports: true, canCreateCustomReports: false, canScheduleReports: false },
    userManagement: { canInviteUsers: false, canDisableUsers: false, canEditUsers: false, canResetPasswords: false },
    notifications: { receiveEmail: true, receiveInApp: true, receiveSms: false, receiveWhatsApp: false, notifyOn: ['question', 'project_updated', 'stage_changed', 'file_uploaded'] },
  },
  sign_company: {
    projectAccess: { canViewAssignedProjects: true, canViewAllProjects: false, canCreateProjects: false, canArchiveProjects: false, canDeleteProjects: false, canExportProject: true, canDuplicateProject: false },
    workflow: { canChangeStage: true, canChangeStatus: false, canChangeProgress: true, canMarkCompleted: false, canReopenCompletedProjects: false, canChangeTargetDates: false },
    communication: { canCreateComments: true, canReply: true, canEditOwnComments: true, canDeleteOwnComments: false, canDeleteOthersComments: false, canAskQuestions: false, canAnswerQuestions: false, canCloseQuestions: false, canMentionUsers: true, canCreateInternalNotes: false },
    files: { canUploadFiles: true, canDownloadFiles: true, canDeleteFiles: false, canReplaceFiles: false, allowedFileTypes: operationalFileTypes },
    tasks: { canCreateTasks: true, canAssignTasks: false, canCompleteTasks: true, canDeleteTasks: false, canReassignTasks: false },
    reports: { canViewReports: false, canExportReports: false, canCreateCustomReports: false, canScheduleReports: false },
    userManagement: { canInviteUsers: false, canDisableUsers: false, canEditUsers: false, canResetPasswords: false },
    notifications: { receiveEmail: true, receiveInApp: true, receiveSms: false, receiveWhatsApp: false, notifyOn: ['task', 'project_updated', 'stage_changed', 'file_uploaded'] },
  },
};

export const accessControlGroups: AccessControlGroup[] = [
  {
    id: 'projectAccess',
    label: 'Project Access',
    items: [
      { key: 'projectAccess.canViewAssignedProjects', label: 'View assigned projects', description: 'Can see projects assigned by site, workspace, branch, or delivery partner scope.' },
      { key: 'projectAccess.canViewAllProjects', label: 'View all projects', description: 'Can see every project in accessible workspaces.' },
      { key: 'projectAccess.canCreateProjects', label: 'Create projects', description: 'Can create new project records.' },
      { key: 'projectAccess.canArchiveProjects', label: 'Archive projects', description: 'Can archive completed or inactive project records.' },
      { key: 'projectAccess.canDeleteProjects', label: 'Delete projects', description: 'Can remove project records where backend policy allows it.' },
      { key: 'projectAccess.canExportProject', label: 'Export project', description: 'Can export project-level data.' },
      { key: 'projectAccess.canDuplicateProject', label: 'Duplicate project', description: 'Can duplicate an existing project setup.' },
    ],
  },
  {
    id: 'workflow',
    label: 'Workflow',
    items: [
      { key: 'workflow.canChangeStage', label: 'Change stage', description: 'Can change the project stage from workflow controls.' },
      { key: 'workflow.canChangeStatus', label: 'Change status', description: 'Can set project status such as Busy, Delayed, or Completed.' },
      { key: 'workflow.canChangeProgress', label: 'Change progress', description: 'Can adjust project progress percentage.' },
      { key: 'workflow.canMarkCompleted', label: 'Mark completed', description: 'Can move projects into the Completed stage.' },
      { key: 'workflow.canReopenCompletedProjects', label: 'Reopen completed projects', description: 'Can move completed projects back into active workflow.' },
      { key: 'workflow.canChangeTargetDates', label: 'Change target dates', description: 'Can alter target, delivery, or completion dates where exposed.' },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    items: [
      { key: 'communication.canCreateComments', label: 'Create comments', description: 'Can add project journal text updates.' },
      { key: 'communication.canReply', label: 'Reply', description: 'Can reply in project communication surfaces.' },
      { key: 'communication.canEditOwnComments', label: 'Edit own comments', description: 'Can edit comments they created.' },
      { key: 'communication.canDeleteOwnComments', label: 'Delete own comments', description: 'Can delete comments they created.' },
      { key: 'communication.canDeleteOthersComments', label: 'Delete others comments', description: 'Can moderate comments created by other users.' },
      { key: 'communication.canAskQuestions', label: 'Ask questions', description: 'Can open project questions or update requests.' },
      { key: 'communication.canAnswerQuestions', label: 'Answer questions', description: 'Can answer and resolve project questions.' },
      { key: 'communication.canCloseQuestions', label: 'Close questions', description: 'Can close question threads.' },
      { key: 'communication.canMentionUsers', label: 'Mention users', description: 'Can mention other users in communication flows.' },
      { key: 'communication.canCreateInternalNotes', label: 'Create internal notes', description: 'Can create private operational notes and batch update inputs.' },
    ],
  },
  {
    id: 'files',
    label: 'Files',
    items: [
      { key: 'files.canUploadFiles', label: 'Upload files', description: 'Can upload approved project documents or images.' },
      { key: 'files.canDownloadFiles', label: 'Download files', description: 'Can download project files.' },
      { key: 'files.canDeleteFiles', label: 'Delete files', description: 'Can delete project files.' },
      { key: 'files.canReplaceFiles', label: 'Replace files', description: 'Can replace existing project files.' },
    ],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    items: [
      { key: 'tasks.canCreateTasks', label: 'Create tasks', description: 'Can add project or timeline tasks.' },
      { key: 'tasks.canAssignTasks', label: 'Assign tasks', description: 'Can assign work to other users.' },
      { key: 'tasks.canCompleteTasks', label: 'Complete tasks', description: 'Can tick or untick task and timeline completion.' },
      { key: 'tasks.canDeleteTasks', label: 'Delete tasks', description: 'Can delete project tasks.' },
      { key: 'tasks.canReassignTasks', label: 'Reassign tasks', description: 'Can change task assignees.' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    items: [
      { key: 'reports.canViewReports', label: 'View reports', description: 'Can open reporting pages and summary views.' },
      { key: 'reports.canExportReports', label: 'Export reports', description: 'Can export report data.' },
      { key: 'reports.canCreateCustomReports', label: 'Create custom reports', description: 'Can define custom reporting outputs.' },
      { key: 'reports.canScheduleReports', label: 'Schedule reports', description: 'Can configure recurring reports.' },
    ],
  },
  {
    id: 'userManagement',
    label: 'User Management',
    items: [
      { key: 'userManagement.canInviteUsers', label: 'Invite users', description: 'Can invite or create user profiles.' },
      { key: 'userManagement.canDisableUsers', label: 'Disable users', description: 'Can disable user access where supported by backend tools.' },
      { key: 'userManagement.canEditUsers', label: 'Edit users', description: 'Can edit user profile and access settings.' },
      { key: 'userManagement.canResetPasswords', label: 'Reset passwords', description: 'Can initiate password reset workflows.' },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    items: [
      { key: 'notifications.receiveEmail', label: 'Receive email', description: 'Receives email notifications.' },
      { key: 'notifications.receiveInApp', label: 'Receive in-app', description: 'Receives in-app notifications when available.' },
      { key: 'notifications.receiveSms', label: 'Receive SMS', description: 'Receives SMS notifications when configured.' },
      { key: 'notifications.receiveWhatsApp', label: 'Receive WhatsApp', description: 'Receives WhatsApp notifications when configured.' },
    ],
  },
];

const knownAccessControlKeys = new Set(accessControlGroups.flatMap((group) => group.items.map((item) => item.key)));

function cloneRolePolicy(policy: RolePolicy): RolePolicy {
  return {
    projectAccess: { ...policy.projectAccess },
    workflow: { ...policy.workflow },
    communication: { ...policy.communication },
    files: { ...policy.files, allowedFileTypes: [...policy.files.allowedFileTypes] },
    tasks: { ...policy.tasks },
    reports: { ...policy.reports },
    userManagement: { ...policy.userManagement },
    notifications: { ...policy.notifications, notifyOn: [...policy.notifications.notifyOn] },
  };
}

export function sanitizePermissionOverrides(overrides: unknown): Record<string, boolean> | undefined {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return undefined;
  }

  const sanitized = Object.entries(overrides).reduce<Record<string, boolean>>((result, [key, value]) => {
    if (knownAccessControlKeys.has(key) && typeof value === 'boolean') {
      result[key] = value;
    }
    return result;
  }, {});

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function getPolicyValue(policy: RolePolicy, key: string) {
  const [groupKey, propertyKey] = key.split('.');
  const group = policy[groupKey as keyof RolePolicy] as Record<string, unknown> | undefined;
  const value = group?.[propertyKey];
  return typeof value === 'boolean' ? value : false;
}

export function applyPolicyOverrides(policy: RolePolicy, overrides: Record<string, boolean> | undefined): RolePolicy {
  const nextPolicy = cloneRolePolicy(policy);

  Object.entries(sanitizePermissionOverrides(overrides) ?? {}).forEach(([key, value]) => {
    const [groupKey, propertyKey] = key.split('.');
    const group = nextPolicy[groupKey as keyof RolePolicy] as Record<string, unknown> | undefined;
    if (group && typeof group[propertyKey] === 'boolean') {
      group[propertyKey] = value;
    }
  });

  return nextPolicy;
}

const permissionCapabilities: Record<Permission, (policy: RolePolicy) => boolean> = {
  create_project: (policy) => policy.projectAccess.canCreateProjects,
  invite_users: (policy) => policy.userManagement.canInviteUsers,
  manage_workflow: (policy) => policy.workflow.canChangeStage || policy.workflow.canChangeStatus || policy.workflow.canChangeProgress,
  upload_files: (policy) => policy.files.canUploadFiles,
  add_comments: (policy) => policy.communication.canCreateComments,
  add_tasks: (policy) => policy.tasks.canCreateTasks,
  batch_voice_updates: (policy) => policy.communication.canCreateInternalNotes && policy.workflow.canChangeStage,
  export_reports: (policy) => policy.reports.canViewReports,
  view_settings: (policy) => policy.userManagement.canEditUsers || policy.userManagement.canInviteUsers,
};

export function getBaseRolePolicy(role: Role) {
  return rolePolicies[role];
}

export function getRolePolicy(user: UserRecord | null | undefined) {
  return user ? applyPolicyOverrides(rolePolicies[user.role], user.permissionOverrides) : null;
}

export function can(user: UserRecord | null | undefined, permission: Permission) {
  const policy = getRolePolicy(user);
  return Boolean(policy && permissionCapabilities[permission](policy));
}

export function canManageAccessControls(user: UserRecord | null | undefined) {
  return isAccessControlAdmin(user?.email);
}

export function canViewSettings(user: UserRecord | null | undefined) {
  return isPlatformOwnerEmail(user?.email);
}

export function canAccessRoute(user: UserRecord | null | undefined, path: string) {
  if (!user) {
    return false;
  }

  if (path.startsWith('/users')) {
    return can(user, 'invite_users');
  }

  if (path.startsWith('/reports')) {
    return can(user, 'export_reports');
  }

  if (path.startsWith('/voice-updates')) {
    return false;
  }

  if (path.startsWith('/settings')) {
    return canViewSettings(user);
  }

  if (path.startsWith('/access-controls')) {
    return canManageAccessControls(user);
  }

  return true;
}

export function canViewProject(user: UserRecord | null | undefined, project: Project) {
  if (!user) {
    return false;
  }

  if (!user.canAccessAllWorkspaces && !user.workspaceIds?.includes('*') && !user.workspaceIds?.includes(project.workspaceId)) {
    return false;
  }

  const policy = getRolePolicy(user)?.projectAccess;

  if (!policy) {
    return false;
  }

  if (policy.canViewAllProjects) {
    return true;
  }

  if (!policy.canViewAssignedProjects) {
    return false;
  }

  if (user.role === 'psg_branch_manager') {
    return Boolean(user.branch && project.branch.toLowerCase() === user.branch.toLowerCase());
  }

  return project.installer.toLowerCase() === user.name.toLowerCase() || project.installer.toLowerCase() === user.branch?.toLowerCase();
}

export function filterProjectsForUser(projects: Project[], user: UserRecord | null | undefined) {
  return projects.filter((project) => canViewProject(user, project));
}

export function canChangeProjectStage(user: UserRecord | null | undefined, project: Project, nextStage: Project['currentStage']) {
  const policy = getRolePolicy(user);
  if (!user || !policy?.workflow.canChangeStage || !canViewProject(user, project)) {
    return false;
  }

  if (nextStage === project.currentStage) {
    return true;
  }

  if (project.currentStage === 'Completed' && !policy.workflow.canReopenCompletedProjects) {
    return false;
  }

  if (nextStage === 'Completed' && !policy.workflow.canMarkCompleted) {
    return false;
  }

  if (user.role === 'sign_company') {
    const installerTransitions: Partial<Record<Project['currentStage'], Project['currentStage'][]>> = {
      Production: ['Installation Scheduled'],
      'Installation Scheduled': ['Installation In Progress'],
      'Installation In Progress': ['Installed'],
    };

    return installerTransitions[project.currentStage]?.includes(nextStage) ?? false;
  }

  if (user.role === 'psg_head_office') {
    const psgApprovalStages: Project['currentStage'][] = ['Artwork Sent', 'Awaiting Approval', 'Approved', 'Artwork In Progress'];
    return psgApprovalStages.includes(project.currentStage) && psgApprovalStages.includes(nextStage);
  }

  return true;
}

export function getAllowedStageOptions(user: UserRecord | null | undefined, project: Project, stages: readonly Project['currentStage'][]) {
  return stages.filter((stage) => stage === project.currentStage || canChangeProjectStage(user, project, stage));
}

export function getWorkflowDenialReason(user: UserRecord | null | undefined, project: Project, next: { currentStage: Project['currentStage']; status: Project['status']; progress: number }) {
  const policy = getRolePolicy(user);

  if (!user || !policy) {
    return 'Sign in before changing workflow details.';
  }

  if (!canViewProject(user, project)) {
    return 'Your role can only update projects assigned to you.';
  }

  if (next.currentStage !== project.currentStage && !canChangeProjectStage(user, project, next.currentStage)) {
    if (user.role === 'sign_company') {
      return 'Installers may only move projects from Production to Installation Scheduled, then Installation In Progress, then Installed.';
    }

    if (user.role === 'psg_head_office') {
      return 'PSG Head Office may only move artwork approval stages. Colourpix can perform broader workflow changes.';
    }

    return 'Your role cannot change this project stage. Colourpix administrators can override workflow rules.';
  }

  if (next.status !== project.status && !policy.workflow.canChangeStatus) {
    return 'Your role cannot change project status. Ask Colourpix to update the status.';
  }

  if (next.progress !== project.progress && !policy.workflow.canChangeProgress) {
    return 'Your role cannot change project progress. Ask Colourpix to update progress.';
  }

  return null;
}

export function canApplyWorkflowChange(user: UserRecord | null | undefined, project: Project, next: { currentStage: Project['currentStage']; status: Project['status']; progress: number }) {
  return getWorkflowDenialReason(user, project, next) === null;
}