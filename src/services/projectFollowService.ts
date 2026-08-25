import { supabase } from '../lib/supabase';

const followStoragePrefix = 'psg-rebrand:followed-projects:';
const followChangedEvent = 'psg-rebrand:followed-projects-changed';
let localChangeRevision = 0;

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
  if (data.session?.user.id) {
    return data.session.user.id;
  }

  const refreshed = await supabase.auth.refreshSession();
  return refreshed.data.session?.user.id ?? null;
}

async function readRemoteFollowedIds(userId: string) {
  const result = await supabase!.from('user_followed_items').select('item_id').eq('user_id', userId);
  if (!result.error) {
    return result.data ?? [];
  }

  const refreshed = await supabase!.auth.refreshSession();
  const refreshedUserId = refreshed.data.session?.user.id;
  if (!refreshedUserId) {
    throw result.error;
  }

  const retry = await supabase!.from('user_followed_items').select('item_id').eq('user_id', refreshedUserId);
  if (retry.error) {
    throw retry.error;
  }

  return retry.data ?? [];
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
  const revisionAtStart = localChangeRevision;
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return localIds;
  }

  try {
    const data = await readRemoteFollowedIds(userId);
    const remoteIds = data.map((row) => row.item_id).filter((id): id is string => typeof id === 'string');
    const shouldMigrateLocalIds = localStorage.getItem(syncMarkerKey(userEmail)) !== 'true';
    const mergedIds = shouldMigrateLocalIds && remoteIds.length === 0
      ? [...new Set([...remoteIds, ...localIds])]
      : remoteIds;

    if (revisionAtStart !== localChangeRevision) {
      return getFollowedProjectIds(userEmail);
    }

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
  } catch (error) {
    console.error('Failed to sync followed branches:', error);
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

  localChangeRevision += 1;
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
