import type { ProjectStage, Role } from '../types/domain';

export const roleLabels: Record<Role, string> = {
  colourpix_admin: 'Workspace Administrator',
  psg_head_office: 'Client Administrator',
  psg_branch_manager: 'Site Contact',
  sign_company: 'Delivery Partner',
};

export const timelineStages: readonly ProjectStage[] = [
  'New Project',
  'Awaiting Information',
  'Quotation Requested',
  'Awaiting Approval',
  'Production',
  'Installation Scheduled',
  'Installed',
  'Client Signoff',
  'Completed',
];

export const kanbanColumns = ['Awaiting Survey', 'Artwork', 'Approval', 'Production', 'Installation', 'Completed'] as const;