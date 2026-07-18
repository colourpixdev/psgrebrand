import type { Project, Role, UserRecord } from '../types/domain';

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

const rolePermissions: Record<Role, Permission[]> = {
  colourpix_admin: ['create_project', 'invite_users', 'manage_workflow', 'upload_files', 'add_comments', 'add_tasks', 'batch_voice_updates', 'export_reports', 'view_settings'],
  psg_head_office: ['manage_workflow', 'upload_files', 'add_comments', 'add_tasks', 'batch_voice_updates', 'export_reports', 'view_settings'],
  psg_branch_manager: ['upload_files', 'add_comments', 'export_reports'],
  sign_company: ['manage_workflow', 'upload_files', 'add_comments', 'add_tasks'],
};

export function can(user: UserRecord | null | undefined, permission: Permission) {
  return Boolean(user && rolePermissions[user.role].includes(permission));
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
    return can(user, 'batch_voice_updates');
  }

  if (path.startsWith('/settings')) {
    return can(user, 'view_settings');
  }

  return true;
}

export function canViewProject(user: UserRecord | null | undefined, project: Project) {
  if (!user) {
    return false;
  }

  if (user.role === 'colourpix_admin' || user.role === 'psg_head_office') {
    return true;
  }

  if (user.role === 'psg_branch_manager') {
    return !user.branch || project.branch.toLowerCase() === user.branch.toLowerCase();
  }

  return project.installer.toLowerCase() === user.name.toLowerCase() || project.installer.toLowerCase() === user.branch?.toLowerCase();
}

export function filterProjectsForUser(projects: Project[], user: UserRecord | null | undefined) {
  return projects.filter((project) => canViewProject(user, project));
}