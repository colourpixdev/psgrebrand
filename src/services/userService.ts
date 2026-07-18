import { supabase } from '../lib/supabase';
import type { UserRecord } from '../types/domain';

type ProfileRow = {
  name: string;
  role: UserRecord['role'];
  branch: string | null;
  email: string;
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

  const { data, error } = await supabase
    .from('profiles')
    .select('name, role, branch, email')
    .order('name', { ascending: true });

  if (error) {
    if (isMissingProfilesTable(error)) {
      throw new UserProfilesNotConfiguredError();
    }

    throw error;
  }

  if (!data) {
    return [];
  }

  return (data as ProfileRow[]).map((row) => ({
    name: row.name,
    role: row.role,
    branch: row.branch ?? undefined,
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