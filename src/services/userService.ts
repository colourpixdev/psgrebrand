import { supabase } from '../lib/supabase';
import type { UserRecord } from '../types/domain';

type ProfileRow = {
  name: string;
  role: UserRecord['role'];
  branch: string | null;
  email: string;
};

export async function getUsers(): Promise<UserRecord[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('name, role, branch, email')
    .order('name', { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as ProfileRow[]).map((row) => ({
    name: row.name,
    role: row.role,
    branch: row.branch ?? undefined,
    email: row.email,
  }));
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