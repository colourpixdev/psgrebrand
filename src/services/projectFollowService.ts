const followStoragePrefix = 'psg-rebrand:followed-projects:';
const followChangedEvent = 'psg-rebrand:followed-projects-changed';

function storageKey(userEmail?: string) {
  return `${followStoragePrefix}${userEmail?.trim().toLowerCase() || 'anonymous'}`;
}

export function getFollowedProjectIds(userEmail?: string): string[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const value = JSON.parse(localStorage.getItem(storageKey(userEmail)) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function toggleFollowedProject(userEmail: string | undefined, projectId: string): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }

  const followed = new Set(getFollowedProjectIds(userEmail));
  const isFollowed = followed.has(projectId);

  if (isFollowed) {
    followed.delete(projectId);
  } else {
    followed.add(projectId);
  }

  localStorage.setItem(storageKey(userEmail), JSON.stringify([...followed]));
  window.dispatchEvent(new CustomEvent(followChangedEvent, { detail: { userEmail } }));
  return !isFollowed;
}

export function getFollowChangedEventName() {
  return followChangedEvent;
}
