import { supabase } from '../lib/supabase';
import type { UserRecord } from '../types/domain';
import { enrichWorkspaceAccess } from '../constants/workspaces';

type ProfileRow = {
  name: string;
  role: UserRecord['role'];
  branch: string | null;
  email: string;
  company?: string | null;
  profile_title?: string | null;
  avatar_url?: string | null;
  logo_url?: string | null;
  workspace_ids?: string[] | null;
};

export class UserProfilesNotConfiguredError extends Error {
  constructor() {
    super('The Supabase profiles table is not installed yet.');
    this.name = 'UserProfilesNotConfiguredError';
  }
}

export type UsersResult = {
  profilesConfigured: boolean;
  users: UserRecord[];
};

function isMissingProfilesTable(error: { code?: string; message?: string }) {
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    error.message?.toLowerCase().includes("could not find the table 'public.profiles'") ||
    error.message?.toLowerCase().includes('relation "public.profiles" does not exist')
  );
}

async function hydrateAuthSession() {
  await supabase?.auth.getSession();
}

export async function getUsers(): Promise<UserRecord[]> {
  if (!supabase) {
    return [];
  }

  await hydrateAuthSession();

  const profileResult = await supabase
    .from('profiles')
    .select('name, role, branch, email, company, profile_title, avatar_url, logo_url, workspace_ids')
    .order('name', { ascending: true });

  let data: Partial<ProfileRow>[] | null = profileResult.data as Partial<ProfileRow>[] | null;
  let error = profileResult.error;

  if (['company', 'profile_title', 'avatar_url', 'logo_url', 'workspace_ids'].some((column) => error?.message.toLowerCase().includes(column))) {
    const fallbackResult = await supabase
      .from('profiles')
      .select('name, role, branch, email')
      .order('name', { ascending: true });

    data = fallbackResult.data as Partial<ProfileRow>[] | null;
    error = fallbackResult.error;
  }

  if (error) {
    if (isMissingProfilesTable(error)) {
      throw new UserProfilesNotConfiguredError();
    }

    throw error;
  }

  if (!data) {
    return [];
  }

  return (data as ProfileRow[]).map((row) => enrichWorkspaceAccess({
    name: row.name,
    role: row.role,
    branch: row.branch ?? undefined,
    company: row.company ?? undefined,
    profileTitle: row.profile_title ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    workspaceIds: Array.isArray(row.workspace_ids) ? row.workspace_ids : undefined,
    email: row.email,
  }));
}

export async function getUsersResult(): Promise<UsersResult> {
  try {
    return {
      profilesConfigured: true,
      users: await getUsers(),
    };
  } catch (error) {
    if (error instanceof UserProfilesNotConfiguredError) {
      return {
        profilesConfigured: false,
        users: [],
      };
    }

    throw error;
  }
}

export type CreateUserProfileInput = {
  name: string;
  email: string;
  role: UserRecord['role'];
  branch?: string;
};

async function getFunctionErrorMessage(error: Error) {
  if (error.message.toLowerCase().includes('failed to send a request')) {
    return 'Unable to reach the invite-user Edge Function. Deploy it with supabase/functions/invite-user and supabase/config.toml so CORS preflight can reach the function.';
  }

  const response = (error as { context?: Response }).context;

  if (response) {
    try {
      const body = await response.clone().json() as { error?: string };
      if (body.error) {
        return body.error;
      }
    } catch {
      return error.message;
    }
  }

  return error.message;
}

export async function inviteUser(input: CreateUserProfileInput): Promise<UserRecord> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const payload = {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    branch: input.branch?.trim() || undefined,
  };

  const { data, error } = await supabase.functions.invoke<UserRecord>('invite-user', {
    body: payload,
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (!data) {
    throw new Error('The invite was sent, but no profile was returned.');
  }

  return data;
}

export async function createUserProfile(input: CreateUserProfileInput): Promise<UserRecord> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  await hydrateAuthSession();

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      name: input.name,
      email: input.email,
      role: input.role,
      branch: input.branch ?? null,
    })
    .select('name, role, branch, email')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to create user profile.');
  }

  return {
    name: data.name,
    role: data.role,
    branch: data.branch ?? undefined,
    email: data.email,
  };
}