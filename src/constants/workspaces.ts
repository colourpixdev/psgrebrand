import type { UserRecord, Workspace } from '../types/domain';

export const defaultGraphicsPartner = 'Colourpix CC';
export const rolloutAppEmail = 'rollout@colourpix.co.za';
export const platformOwnerEmail = ['francois', 'colourpix.co.za'].join('@');
export const platformOwnerEmails = [platformOwnerEmail, 'bd@colourpix.co.za'];
export const accessControlAdminEmails = [platformOwnerEmail, 'bd@colourpix.co.za', 'beverley@colourpix.co.za'];
export const privateRolloutRequestInbox = rolloutAppEmail;
export const allWorkspaceAdminEmails = platformOwnerEmails;

export const workspaceAdminContact = {
  name: 'Workspace administrator',
  company: defaultGraphicsPartner,
  emails: [rolloutAppEmail],
} as const;

export const rolloutSupportContact = {
  name: 'PSG Rebrand support',
  company: 'PSG Rebrand',
  emails: [privateRolloutRequestInbox],
} as const;

export const defaultWorkspace: Workspace = {
  id: 'psg-national-signage-rollout',
  name: 'Colourpix / PSG Wealth Insure Workspace',
  clientCompany: 'PSG Wealth Insure',
  graphicsPartner: defaultGraphicsPartner,
  clientLogoUrl: '',
  servicePartnerLogoUrl: '',
  description: 'Custom operational workspace managed by Colourpix CC for PSG Wealth Insure project delivery.',
  status: 'active',
};

export const configuredWorkspaces: Workspace[] = [defaultWorkspace];

export function isAllWorkspaceAdmin(email: string | undefined) {
  return Boolean(email && allWorkspaceAdminEmails.includes(email.trim().toLowerCase()));
}

export function isAccessControlAdmin(email: string | undefined) {
  return Boolean(email && accessControlAdminEmails.includes(email.trim().toLowerCase()));
}

export function isPlatformOwnerEmail(email: string | undefined) {
  return Boolean(email && platformOwnerEmails.includes(email.trim().toLowerCase()));
}

export function enrichWorkspaceAccess(user: UserRecord): UserRecord {
  const normalizedEmail = user.email.trim().toLowerCase();
  const canAccessAllWorkspaces = isAllWorkspaceAdmin(normalizedEmail) || user.workspaceIds?.includes('*') === true;

  return {
    ...user,
    company: user.company ?? (user.role === 'sign_company' ? user.branch : undefined),
    workspaceIds: canAccessAllWorkspaces ? ['*'] : user.workspaceIds ?? [defaultWorkspace.id],
    canAccessAllWorkspaces,
    isPlatformOwner: isPlatformOwnerEmail(normalizedEmail),
  };
}