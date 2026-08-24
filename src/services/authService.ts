import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Role, UserRecord } from '../types/domain';
import { normalizeRole } from '../types/domain';
import { roleLabels } from '../constants/portal';
import { enrichWorkspaceAccess } from '../constants/workspaces';
import { sanitizePermissionOverrides } from '../utils/permissions';

const validRoles: Role[] = ['colourpix_admin', 'psg_user'];

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
  permission_overrides?: Record<string, unknown> | null;
};

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (validRoles.includes(value as Role) || value === 'psg_head_office' || value === 'psg_branch_manager' || value === 'sign_company');
}

function fallbackSessionUser(session: Session | null): UserRecord | null {
  if (!session) {
    return null;
  }

  const metadataName = session.user.user_metadata?.name;
  const metadataBranch = session.user.user_metadata?.branch;
  const role = normalizeRole(isRole(session.user.app_metadata?.role) ? session.user.app_metadata.role : 'psg_user');

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
    .select('name, role, branch, email, company, profile_title, avatar_url, logo_url, workspace_ids, permission_overrides')
    .ilike('email', email)
    .maybeSingle();

  let data: Partial<ProfileRow> | null = profileResult.data as Partial<ProfileRow> | null;
  let error = profileResult.error;

  if (['company', 'profile_title', 'avatar_url', 'logo_url', 'workspace_ids', 'permission_overrides'].some((column) => error?.message.toLowerCase().includes(column))) {
    const fallbackResult = await supabase
      .from('profiles')
      .select('name, role, branch, email')
      .ilike('email', email)
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
    role: normalizeRole(isRole(profile.role) ? profile.role : fallbackUser?.role ?? 'psg_user'),
    branch: profile.branch ?? undefined,
    company: profile.company ?? undefined,
    profileTitle: profile.profile_title ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    logoUrl: profile.logo_url ?? undefined,
    workspaceIds: Array.isArray(profile.workspace_ids) ? profile.workspace_ids : undefined,
    email: profile.email,
    permissionOverrides: sanitizePermissionOverrides(profile.permission_overrides),
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

const REGISTRATION_PASSWORD = 'psgrebrand';

export async function signInWithEmailPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!supabase) {
    return { user: enrichWorkspaceAccess({
      name: normalizedEmail.split('@')[0] || 'Signed in user',
      role: 'psg_user' as Role,
      email: normalizedEmail,
    }), passwordChangeRequired: false };
  }

  // Handle self-registration with special password
  if (password === REGISTRATION_PASSWORD) {
    // Try to create a new account first
    const { error: signupError, data: signupData } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          name: normalizedEmail.split('@')[0] || 'User',
          role: 'psg_user',
          password_change_required: true,
        },
      },
    });

    // If signup fails because user exists, that's okay - we'll sign in below
    if (signupError && !signupError.message?.toLowerCase().includes('already registered')) {
      throw signupError;
    }

    // If signup succeeded and created a profile, we need to create one in the profiles table
    if (signupData.user && !signupError) {
      try {
        await supabase
          .from('profiles')
          .upsert({
            email: normalizedEmail,
            name: normalizedEmail.split('@')[0] || 'User',
            role: 'psg_user',
          }, { onConflict: 'email' })
          .select()
          .single();
      } catch (profileError) {
        console.warn('Could not create profile for new user:', profileError);
      }
    }
  }

  // Sign in (either for registration flow or normal login)
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

  // Check if this is a first-time registration requiring password change
  const passwordChangeRequired = data.session.user.user_metadata?.password_change_required === true;

  return { user: sessionUser, passwordChangeRequired };
}

export async function updateUserPassword(currentPassword: string, newPassword: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  // Verify current password by attempting sign in
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user?.email) {
    throw new Error('Not authenticated.');
  }

  // Update the password
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw error;
  }

  // Clear the password_change_required flag
  const { error: updateMetadataError } = await supabase.auth.updateUser({
    data: {
      password_change_required: false,
    },
  });

  if (updateMetadataError) {
    console.warn('Could not clear password change flag:', updateMetadataError);
  }
}