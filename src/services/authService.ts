import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Role, UserRecord } from '../types/domain';
import { roleLabels } from '../constants/portal';

const validRoles: Role[] = ['colourpix_admin', 'psg_head_office', 'psg_branch_manager', 'sign_company'];

type ProfileRow = {
  name: string;
  role: Role;
  branch: string | null;
  email: string;
};

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && validRoles.includes(value as Role);
}

function fallbackSessionUser(session: Session | null): UserRecord | null {
  if (!session) {
    return null;
  }

  const metadataName = session.user.user_metadata?.name;
  const metadataBranch = session.user.user_metadata?.branch;
  const role = isRole(session.user.app_metadata?.role) ? session.user.app_metadata.role : 'psg_head_office';

  return {
    name: typeof metadataName === 'string' ? metadataName : session.user.email ?? roleLabels[role],
    role,
    branch: typeof metadataBranch === 'string' ? metadataBranch : undefined,
    email: session.user.email ?? '',
  };
}

export async function sessionToUser(session: Session | null): Promise<UserRecord | null> {
  if (!session) {
    return null;
  }

  const fallbackUser = fallbackSessionUser(session);
  const email = session.user.email?.trim().toLowerCase();

  if (!supabase || !email) {
    return fallbackUser;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('name, role, branch, email')
    .eq('email', email)
    .maybeSingle();

  if (error || !data) {
    return fallbackUser;
  }

  const profile = data as ProfileRow;

  return {
    name: profile.name,
    role: isRole(profile.role) ? profile.role : fallbackUser?.role ?? 'psg_head_office',
    branch: profile.branch ?? undefined,
    email: profile.email,
  };
}

export async function loadSessionUser() {
  if (!supabase) {
    return null;
  }

  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    return null;
  }

  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) {
    return null;
  }

  return sessionToUser({ ...data.session, user: userData.user });
}

export async function signOutSession() {
  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
}

export async function signInWithEmailPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!supabase) {
    return {
      name: normalizedEmail.split('@')[0] || 'Signed in user',
      role: 'psg_head_office' as Role,
      email: normalizedEmail,
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    throw error;
  }

  const sessionUser = await sessionToUser(data.session);
  if (!sessionUser) {
    throw new Error('Sign-in succeeded, but no user profile could be loaded.');
  }

  return sessionUser;
}