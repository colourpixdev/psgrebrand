import { supabase } from '../lib/supabase';

const followStoragePrefix = 'psg-rebrand:followed-projects:';
const followChangedEvent = 'psg-rebrand:followed-projects-changed';

function storageKey(userEmail?: string) {
  return `${followStoragePrefix}${userEmail?.trim().toLowerCase() || 'anonymous'}`;
}

function syncMarkerKey(userEmail?: string) {
  return `${storageKey(userEmail)}:synced`;
}

async function getAuthenticatedUserId() {
  if (!supabase) {
    return null;
  }

  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
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

export async function syncFollowedProjects(userEmail?: string): Promise<string[]> {
  const localIds = getFollowedProjectIds(userEmail);
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return localIds;
  }

  try {
    const { data, error } = await supabase!.from('user_followed_items').select('item_id').eq('user_id', userId);
    if (error) {
      throw error;
    }

    const remoteIds = (data ?? []).map((row) => row.item_id).filter((id): id is string => typeof id === 'string');
    const shouldMigrateLocalIds = localStorage.getItem(syncMarkerKey(userEmail)) !== 'true';
    const mergedIds = shouldMigrateLocalIds ? [...new Set([...remoteIds, ...localIds])] : remoteIds;

    if (shouldMigrateLocalIds && localIds.some((id) => !remoteIds.includes(id))) {
      const { error: upsertError } = await supabase!.from('user_followed_items').upsert(
        mergedIds.map((itemId) => ({ user_id: userId, item_id: itemId })),
        { onConflict: 'user_id,item_id' },
      );
      if (upsertError) {
        throw upsertError;
      }
    }

    localStorage.setItem(storageKey(userEmail), JSON.stringify(mergedIds));
  localStorage.setItem(syncMarkerKey(userEmail), 'true');
    window.dispatchEvent(new CustomEvent(followChangedEvent, { detail: { userEmail } }));
    return mergedIds;
  } catch {
    return localIds;
  }
}

async function persistFollowChange(userEmail: string | undefined, userId: string, projectId: string, followedIds: string[], isFollowed: boolean) {
  if (isFollowed) {
    const { error } = await supabase!.from('user_followed_items').upsert(
      { user_id: userId, item_id: projectId },
      { onConflict: 'user_id,item_id' },
    );
    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase!.from('user_followed_items').delete().eq('user_id', userId).in('item_id', followedIds);
    if (error) {
      throw error;
    }
  }

  window.dispatchEvent(new CustomEvent(followChangedEvent, { detail: { userEmail } }));
}

export function toggleFollowedProject(userEmail: string | undefined, projectId: string, legacyProjectIds: string[] = []): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }

  const followed = new Set(getFollowedProjectIds(userEmail));
  const followedIds = [projectId, ...legacyProjectIds];
  const isFollowed = followedIds.some((id) => followed.has(id));

  if (isFollowed) {
    followedIds.forEach((id) => followed.delete(id));
  } else {
    followed.add(projectId);
  }

  localStorage.setItem(storageKey(userEmail), JSON.stringify([...followed]));
  window.dispatchEvent(new CustomEvent(followChangedEvent, { detail: { userEmail } }));
  void getAuthenticatedUserId().then((userId) => {
    if (!userId || !supabase) {
      return;
    }

    return persistFollowChange(userEmail, userId, projectId, followedIds, !isFollowed).catch((error) => {
      console.error('Failed to sync followed item:', error);
    });
  });

  return !isFollowed;
}

export function followProjectForUser(userEmail: string | undefined, projectId: string): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }

  const followed = new Set(getFollowedProjectIds(userEmail));
  const wasFollowed = followed.has(projectId);
  followed.add(projectId);
  localStorage.setItem(storageKey(userEmail), JSON.stringify([...followed]));

  if (!wasFollowed) {
    window.dispatchEvent(new CustomEvent(followChangedEvent, { detail: { userEmail } }));
  }

  return !wasFollowed;
}

export function getFollowChangedEventName() {
  return followChangedEvent;
}
