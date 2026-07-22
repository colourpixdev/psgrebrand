import type { UserRecord } from '../types/domain';

export type EditableProfileIdentity = {
  displayName: string;
  title: string;
  company: string;
  avatarUrl: string;
  logoUrl: string;
};

function storageKey(user: UserRecord | null | undefined) {
  return user?.email ? `psg-rebrand:profile-identity:${user.email.trim().toLowerCase()}` : null;
}

export function getInitials(value: string | undefined) {
  const words = (value || 'User').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('') || 'U';
}

export function getProfileIdentity(user: UserRecord | null | undefined): EditableProfileIdentity {
  const fallback: EditableProfileIdentity = {
    displayName: user?.name ?? 'Workspace user',
    title: user?.profileTitle ?? '',
    company: user?.company ?? user?.branch ?? '',
    avatarUrl: user?.avatarUrl ?? '',
    logoUrl: user?.logoUrl ?? '',
  };

  const key = storageKey(user);
  if (!key) {
    return fallback;
  }

  try {
    const stored = localStorage.getItem(key);
    if (!stored) {
      return fallback;
    }

    return { ...fallback, ...JSON.parse(stored) };
  } catch {
    return fallback;
  }
}

export function saveProfileIdentity(user: UserRecord | null | undefined, identity: EditableProfileIdentity) {
  const key = storageKey(user);
  if (!key) {
    return;
  }

  localStorage.setItem(key, JSON.stringify(identity));
}
