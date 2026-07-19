import type { UserRecord, Workspace } from '../types/domain';

export const defaultGraphicsPartner = 'Colourpix (Pty) Ltd';
export const platformOwnerEmail = ['francois', 'colourpix.co.za'].join('@');
const privateRolloutInboxUser = ['francois2', 'botha'].join('');
const privateRolloutInboxDomain = 'gmail.com';
export const privateRolloutRequestInbox = `${privateRolloutInboxUser}@${privateRolloutInboxDomain}`;
export const allWorkspaceAdminEmails = [platformOwnerEmail, 'beverley@colourpix.co.za'];

export const workspaceAdminContact = {
  name: 'Workspace administrator',
  company: defaultGraphicsPartner,
  emails: allWorkspaceAdminEmails,
} as const;

export const rolloutSupportContact = {
  name: 'RolloutHQ support',
  company: 'RolloutHQ',
  emails: [privateRolloutRequestInbox],
} as const;

export const defaultWorkspace: Workspace = {
  id: 'psg-national-signage-rollout',
  name: 'PSG National Signage Rollout',
  clientCompany: 'PSG',
  graphicsPartner: defaultGraphicsPartner,
  clientLogoUrl: '',
  servicePartnerLogoUrl: '',
  description: 'National signage rollout workspace managed in partnership with Colourpix (Pty) Ltd.',
  status: 'active',
};

export const configuredWorkspaces: Workspace[] = [defaultWorkspace];

export function isAllWorkspaceAdmin(email: string | undefined) {
  return Boolean(email && allWorkspaceAdminEmails.includes(email.trim().toLowerCase()));
}

export function enrichWorkspaceAccess(user: UserRecord): UserRecord {
  const normalizedEmail = user.email.trim().toLowerCase();
  const canAccessAllWorkspaces = isAllWorkspaceAdmin(normalizedEmail) || user.workspaceIds?.includes('*') === true;

  return {
    ...user,
    company: user.company ?? (user.role === 'sign_company' ? user.branch : undefined),
    workspaceIds: canAccessAllWorkspaces ? ['*'] : user.workspaceIds ?? [defaultWorkspace.id],
    canAccessAllWorkspaces,
    isPlatformOwner: normalizedEmail === platformOwnerEmail,
  };
}