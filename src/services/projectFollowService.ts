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

  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
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

export async function toggleFollowedProject(userEmail: string | undefined, projectId: string, legacyProjectIds: string[] = []): Promise<boolean> {
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
  const userId = await getAuthenticatedUserId();

  if (userId) {
    try {
      if (isFollowed) {
        await supabase!.from('user_followed_items').delete().eq('user_id', userId).in('item_id', followedIds);
      } else {
        await supabase!.from('user_followed_items').upsert(
          { user_id: userId, item_id: projectId },
          { onConflict: 'user_id,item_id' },
        );
      }
    } catch {
      // Local storage remains the fallback when the follows table is unavailable.
    }
  }

  window.dispatchEvent(new CustomEvent(followChangedEvent, { detail: { userEmail } }));
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
