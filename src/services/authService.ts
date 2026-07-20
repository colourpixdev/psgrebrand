import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Role, UserRecord } from '../types/domain';
import { roleLabels } from '../constants/portal';
import { enrichWorkspaceAccess } from '../constants/workspaces';

const validRoles: Role[] = ['colourpix_admin', 'psg_head_office', 'psg_branch_manager', 'sign_company'];

type ProfileRow = {
  name: string;
  role: Role;
  branch: string | null;
  email: string;
  company?: string | null;
  profile_title?: string | null;
  avatar_url?: string | null;
  logo_url?: string | null;
  workspace_ids?: string[] | null;
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

  return enrichWorkspaceAccess({
    name: typeof metadataName === 'string' ? metadataName : session.user.email ?? roleLabels[role],
    role,
    branch: typeof metadataBranch === 'string' ? metadataBranch : undefined,
    email: session.user.email ?? '',
  });
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

  const profileResult = await supabase
    .from('profiles')
    .select('name, role, branch, email, company, profile_title, avatar_url, logo_url, workspace_ids')
    .eq('email', email)
    .maybeSingle();

  let data: Partial<ProfileRow> | null = profileResult.data as Partial<ProfileRow> | null;
  let error = profileResult.error;

  if (['company', 'profile_title', 'avatar_url', 'logo_url', 'workspace_ids'].some((column) => error?.message.toLowerCase().includes(column))) {
    const fallbackResult = await supabase
      .from('profiles')
      .select('name, role, branch, email')
      .eq('email', email)
      .maybeSingle();

    data = fallbackResult.data as Partial<ProfileRow> | null;
    error = fallbackResult.error;
  }

  if (error || !data) {
    return fallbackUser;
  }

  const profile = data as ProfileRow;

  return enrichWorkspaceAccess({
    name: profile.name,
    role: isRole(profile.role) ? profile.role : fallbackUser?.role ?? 'psg_head_office',
    branch: profile.branch ?? undefined,
    company: profile.company ?? undefined,
    profileTitle: profile.profile_title ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    logoUrl: profile.logo_url ?? undefined,
    workspaceIds: Array.isArray(profile.workspace_ids) ? profile.workspace_ids : undefined,
    email: profile.email,
  });
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

  await supabase.auth.signOut({ scope: 'local' });
}

export async function signInWithEmailPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!supabase) {
    return enrichWorkspaceAccess({
      name: normalizedEmail.split('@')[0] || 'Signed in user',
      role: 'psg_head_office' as Role,
      email: normalizedEmail,
    });
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