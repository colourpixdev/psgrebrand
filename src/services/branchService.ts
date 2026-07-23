import { supabase } from '../lib/supabase';
import type { Branch, Division } from '../types/domain';

const branchesStorageKey = 'psg-rebrand:branches';

export interface CreateBranchInput {
  name: string;
  division: Division;
  province: string;
  town: string;
  physicalAddress: string;
  latitude?: number | null;
  longitude?: number | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
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
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
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
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createBranchId() {
  return globalThis.crypto?.randomUUID?.() ?? `branch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readLocalBranches(): Branch[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(branchesStorageKey);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as Branch[]) : [];
  } catch {
    return [];
  }
}

function writeLocalBranches(branches: Branch[]) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(branchesStorageKey, JSON.stringify(branches));
}

export async function getAllBranches(): Promise<Branch[]> {
  if (!supabase) {
    return readLocalBranches().sort((a, b) => a.name.localeCompare(b.name));
  }

  const { data, error } = await supabase.from('branches').select('*').order('name');

  if (error) {
    console.error('Failed to fetch branches:', error);
    return [];
  }

  return data.map(rowToBranch);
}

export async function getBranchById(id: string): Promise<Branch | null> {
  if (!supabase) {
    const branch = readLocalBranches().find((item) => item.id === id);
    return branch ?? null;
  }

  const { data, error } = await supabase.from('branches').select('*').eq('id', id).single();

  if (error) {
    console.error(`Failed to fetch branch ${id}:`, error);
    return null;
  }

  return rowToBranch(data);
}

export async function createBranch(input: CreateBranchInput): Promise<Branch | null> {
  if (!supabase) {
    const now = new Date().toISOString();
    const nextBranch: Branch = {
      id: createBranchId(),
      name: input.name,
      division: input.division,
      province: input.province,
      town: input.town,
      physicalAddress: input.physicalAddress,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      contactName: input.contactName ?? undefined,
      contactEmail: input.contactEmail ?? undefined,
      contactPhone: input.contactPhone ?? undefined,
      createdAt: now,
      updatedAt: now,
    };

    const nextBranches = [...readLocalBranches(), nextBranch];
    writeLocalBranches(nextBranches);
    return nextBranch;
  }

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
        contact_name: input.contactName ?? null,
        contact_email: input.contactEmail ?? null,
        contact_phone: input.contactPhone ?? null,
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
  if (!supabase) {
    const branches = readLocalBranches();
    const index = branches.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error('Branch not found.');
    }

    const existing = branches[index];
    const updatedBranch: Branch = {
      ...existing,
      name: input.name ?? existing.name,
      division: input.division ?? existing.division,
      province: input.province ?? existing.province,
      town: input.town ?? existing.town,
      physicalAddress: input.physicalAddress ?? existing.physicalAddress,
      latitude: input.latitude !== undefined ? input.latitude : existing.latitude,
      longitude: input.longitude !== undefined ? input.longitude : existing.longitude,
      contactName: input.contactName !== undefined ? input.contactName ?? undefined : existing.contactName,
      contactEmail: input.contactEmail !== undefined ? input.contactEmail ?? undefined : existing.contactEmail,
      contactPhone: input.contactPhone !== undefined ? input.contactPhone ?? undefined : existing.contactPhone,
      updatedAt: new Date().toISOString(),
    };

    branches[index] = updatedBranch;
    writeLocalBranches(branches);
    return updatedBranch;
  }

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.division !== undefined) updates.division = input.division;
  if (input.province !== undefined) updates.province = input.province;
  if (input.town !== undefined) updates.town = input.town;
  if (input.physicalAddress !== undefined) updates.physical_address = input.physicalAddress;
  if (input.latitude !== undefined) updates.latitude = input.latitude;
  if (input.longitude !== undefined) updates.longitude = input.longitude;
  if (input.contactName !== undefined) updates.contact_name = input.contactName;
  if (input.contactEmail !== undefined) updates.contact_email = input.contactEmail;
  if (input.contactPhone !== undefined) updates.contact_phone = input.contactPhone;

  const { data, error } = await supabase.from('branches').update(updates).eq('id', id).select().single();

  if (error) {
    console.error('Failed to update branch:', error);
    throw new Error(error.message || 'Failed to update branch');
  }

  return rowToBranch(data);
}

export async function deleteBranch(id: string): Promise<boolean> {
  if (!supabase) {
    const branches = readLocalBranches();
    const nextBranches = branches.filter((item) => item.id !== id);

    if (nextBranches.length === branches.length) {
      throw new Error('Branch not found.');
    }

    writeLocalBranches(nextBranches);
    return true;
  }

  const { error } = await supabase.from('branches').delete().eq('id', id);

  if (error) {
    console.error('Failed to delete branch:', error);
    throw new Error(error.message || 'Failed to delete branch');
  }

  return true;
}
