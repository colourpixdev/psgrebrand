import type { ProjectStage, Role } from '../types/domain';

export const roleLabels: Record<Role, string> = {
  colourpix_admin: 'Admin',
  psg_user: 'PSG user',
  psg_head_office: 'PSG user',
  psg_branch_manager: 'PSG user',
  sign_company: 'PSG user',
};

export const roleOptions: Role[] = ['colourpix_admin', 'psg_user'];

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