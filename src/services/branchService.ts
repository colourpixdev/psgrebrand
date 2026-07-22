import { supabase } from '../lib/supabase';
import type { Branch, Division } from '../types/domain';

export interface CreateBranchInput {
  name: string;
  division: Division;
  province: string;
  town: string;
  physicalAddress: string;
  latitude?: number | null;
  longitude?: number | null;
}

type BranchRow = {
  id: string;
  name: string;
  division: Division;
  province: string;
  town: string;
  physical_address: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
};

function rowToBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    name: row.name,
    division: row.division,
    province: row.province,
    town: row.town,
    physicalAddress: row.physical_address,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllBranches(): Promise<Branch[]> {
  if (!supabase) return [];

  const { data, error } = await supabase.from('branches').select('*').order('name');

  if (error) {
    console.error('Failed to fetch branches:', error);
    return [];
  }

  return data.map(rowToBranch);
}

export async function getBranchById(id: string): Promise<Branch | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.from('branches').select('*').eq('id', id).single();

  if (error) {
    console.error(`Failed to fetch branch ${id}:`, error);
    return null;
  }

  return rowToBranch(data);
}

export async function createBranch(input: CreateBranchInput): Promise<Branch | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('branches')
    .insert([
      {
        name: input.name,
        division: input.division,
        province: input.province,
        town: input.town,
        physical_address: input.physicalAddress,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Failed to create branch:', error);
    throw new Error(error.message || 'Failed to create branch');
  }

  return rowToBranch(data);
}

export async function updateBranch(id: string, input: Partial<CreateBranchInput>): Promise<Branch | null> {
  if (!supabase) return null;

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.division !== undefined) updates.division = input.division;
  if (input.province !== undefined) updates.province = input.province;
  if (input.town !== undefined) updates.town = input.town;
  if (input.physicalAddress !== undefined) updates.physical_address = input.physicalAddress;
  if (input.latitude !== undefined) updates.latitude = input.latitude;
  if (input.longitude !== undefined) updates.longitude = input.longitude;

  const { data, error } = await supabase.from('branches').update(updates).eq('id', id).select().single();

  if (error) {
    console.error('Failed to update branch:', error);
    throw new Error(error.message || 'Failed to update branch');
  }

  return rowToBranch(data);
}

export async function deleteBranch(id: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase.from('branches').delete().eq('id', id);

  if (error) {
    console.error('Failed to delete branch:', error);
    throw new Error(error.message || 'Failed to delete branch');
  }

  return true;
}
