import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Role, UserRecord } from '../types/domain';
import { roleLabels } from '../constants/portal';

export function sessionToUser(session: Session | null): UserRecord | null {
  if (!session) {
    return null;
  }

  const metadataRole = session.user.user_metadata?.role as Role | undefined;
  const metadataName = session.user.user_metadata?.name as string | undefined;
  const metadataBranch = session.user.user_metadata?.branch as string | undefined;

  return {
    name: metadataName ?? session.user.email ?? roleLabels[metadataRole ?? 'psg_head_office'],
    role: metadataRole ?? 'psg_head_office',
    branch: metadataBranch,
    email: session.user.email ?? '',
  };
}

export async function loadSessionUser() {
  if (!supabase) {
    return null;
  }

  const { data } = await supabase.auth.getSession();
  return sessionToUser(data.session);
}

export async function signOutSession() {
  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
}

export async function signInWithEmailPassword(email: string, password: string) {
  if (!supabase) {
    return {
      name: email.split('@')[0] || 'Signed in user',
      role: 'psg_head_office' as Role,
      email,
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return sessionToUser(data.session);
}