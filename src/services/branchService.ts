import { supabase } from '../lib/supabase';
import { createProject, type CreateProjectInput } from './portalService';
import type { Branch, ContactPerson, Division, Project } from '../types/domain';

const branchesStorageKey = 'psg-rebrand:branches';

/**
 * Format a branch name as "PSG [Division] [Branch Name]"
 */
export function formatBranchName(division: Division, branchName: string): string {
  const baseName = extractBranchName(branchName).trim();
  return `PSG ${division} ${baseName}`;
}

/**
 * Extract the base branch name by removing "PSG [Division] " prefix
 */
export function extractBranchName(fullName: string): string {
  // If the name already starts with "PSG ", extract the part after "PSG Division "
  const psgMatch = fullName.match(/^PSG\s+(?:Wealth|Insure|Wealth\s+Insure|Asset|Trust)\s+(.+)$/i);
  if (psgMatch) {
    return psgMatch[1];
  }
  // Otherwise, return the name as-is
  return fullName;
}

export interface CreateBranchInput {
  name: string;
  division: Division;
  province: string;
  city?: string | null;
  town: string;
  physicalAddress: string;
  signageCompany?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contacts?: ContactPerson[];
}

type BranchRow = {
  id: string;
  code?: string | null;
  name: string;
  division: Division;
  province: string;
  city?: string | null;
  town: string;
  physical_address: string;
  signage_company?: string | null;
  latitude: number | null;
  longitude: number | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contacts?: ContactPerson[] | null;
  created_at: string;
  updated_at: string;
};

function isDivision(value: unknown): value is Division {
  return typeof value === 'string' && ['Wealth', 'Insure', 'Wealth Insure', 'Asset', 'Trust'].includes(value);
}

function rowToBranch(row: BranchRow): Branch {
  return {
    id: row.id ?? '',
    code: row.code ?? undefined,
    name: row.name ?? 'Unknown branch',
    division: isDivision(row.division) ? row.division : 'Wealth',
    province: row.province ?? 'Not captured',
    city: row.city ?? undefined,
    town: row.town ?? 'Not captured',
    physicalAddress: row.physical_address ?? '',
    signageCompany: row.signage_company ?? undefined,
    latitude: typeof row.latitude === 'number' ? row.latitude : null,
    longitude: typeof row.longitude === 'number' ? row.longitude : null,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    contacts: Array.isArray(row.contacts) ? row.contacts : undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
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

function mergeLocalBranchMetadata(branch: Branch): Branch {
  const storedBranch = readLocalBranches().find((item) => item.id === branch.id);

  if (!storedBranch) {
    return branch;
  }

  return {
    ...branch,
    contactName: branch.contactName ?? storedBranch.contactName,
    contactEmail: branch.contactEmail ?? storedBranch.contactEmail,
    contactPhone: branch.contactPhone ?? storedBranch.contactPhone,
    contacts: branch.contacts?.length ? branch.contacts : storedBranch.contacts,
    updatedAt: branch.updatedAt || storedBranch.updatedAt,
  };
}

function saveBranchToLocalShadow(branch: Branch) {
  const branches = readLocalBranches();
  const existingIndex = branches.findIndex((item) => item.id === branch.id);

  if (existingIndex >= 0) {
    branches[existingIndex] = branch;
  } else {
    branches.push(branch);
  }

  writeLocalBranches(branches);
}

function shouldFallbackToLocal(errorMessage: string | undefined) {
  if (!errorMessage) {
    return false;
  }

  const normalizedMessage = errorMessage.toLowerCase();
  return [
    'row-level security',
    'permission denied',
    'jwt',
    'auth',
    'network',
    'fetch',
    'failed to fetch',
    'not configured',
    'does not exist',
    'could not find',
  ].some((token) => normalizedMessage.includes(token));
}

function isMissingBranchColumnError(errorMessage: string | undefined) {
  if (!errorMessage) {
    return false;
  }

  const normalizedMessage = errorMessage.toLowerCase();
  return [
    'contact_name',
    'contact_email',
    'contact_phone',
    'signage_company',
    'city',
    'contacts',
  ].some((column) => normalizedMessage.includes(column));
}

function getMissingBranchColumns(errorMessage: string | undefined) {
  if (!errorMessage) {
    return [] as Array<'contact_name' | 'contact_email' | 'contact_phone' | 'signage_company' | 'city' | 'contacts'>;
  }

  const normalizedMessage = errorMessage.toLowerCase();
  const supportedColumns = ['contact_name', 'contact_email', 'contact_phone', 'signage_company', 'city', 'contacts'] as const;
  return supportedColumns.filter((column) => normalizedMessage.includes(column));
}

function getPrimaryContactFromContacts(input: Pick<CreateBranchInput, 'contactName' | 'contactEmail' | 'contactPhone' | 'contacts'>) {
  const primaryContact = input.contacts?.find((contact) => contact.name?.trim()) ?? undefined;

  return {
    contactName: input.contactName?.trim() || primaryContact?.name?.trim() || null,
    contactEmail: input.contactEmail?.trim() || primaryContact?.email?.trim() || null,
    contactPhone: input.contactPhone?.trim() || primaryContact?.phone?.trim() || null,
  };
}

function buildBranchInsertPayload(input: CreateBranchInput) {
  const syncedContactFields = getPrimaryContactFromContacts(input);

  return {
    name: input.name,
    division: input.division,
    province: input.province,
    city: input.city?.trim() || null,
    town: input.town,
    physical_address: input.physicalAddress,
    signage_company: input.signageCompany?.trim() || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    contact_name: syncedContactFields.contactName,
    contact_email: syncedContactFields.contactEmail,
    contact_phone: syncedContactFields.contactPhone,
    contacts: input.contacts ?? [],
  };
}

function omitBranchColumns<T extends Record<string, unknown>>(
  payload: T,
  columns: readonly ('contact_name' | 'contact_email' | 'contact_phone' | 'signage_company' | 'city' | 'contacts')[],
) {
  const nextPayload: Record<string, unknown> = { ...payload };
  columns.forEach((column) => {
    delete nextPayload[column];
  });
  return nextPayload;
}

async function saveBranchWithSchemaFallback(
  mode: 'insert' | 'update',
  payload: Record<string, unknown>,
  id?: string,
) {
  let candidatePayload = { ...payload };
  let attempts = 0;

  while (attempts <= 5) {
    const query = mode === 'insert'
      ? supabase!.from('branches').insert([candidatePayload])
      : supabase!.from('branches').update(candidatePayload).eq('id', id ?? '');

    const result = await query.select().single();
    if (!result.error) {
      return result;
    }

    if (!isMissingBranchColumnError(result.error.message)) {
      return result;
    }

    const missingColumns = getMissingBranchColumns(result.error.message);
    if (missingColumns.length === 0) {
      return result;
    }

    // Do not silently drop legacy contact columns. If the database schema is missing
    // contact_name/contact_email/contact_phone, we want the caller to see that error
    // rather than silently ignoring the branch contact update.
    const droppingLegacyContactColumns = missingColumns.some((column) => column !== 'contacts');
    if (droppingLegacyContactColumns) {
      return result;
    }

    candidatePayload = omitBranchColumns(candidatePayload, missingColumns);
    attempts += 1;
  }

  return mode === 'insert'
    ? supabase!.from('branches').insert([candidatePayload]).select().single()
    : supabase!.from('branches').update(candidatePayload).eq('id', id ?? '').select().single();
}

export async function getAllBranches(): Promise<Branch[]> {
  const localBranches = readLocalBranches();

  if (!supabase) {
    if (localBranches.length > 0) {
      return localBranches.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Try static sample fallback bundled with the site (public/sample-branches.json)
    try {
      const res = await fetch('/sample-branches.json');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped = data.map((row) => mergeLocalBranchMetadata(row as any));
          const localOnlyBranches = localBranches.filter((localBranch) => !mapped.some((serverBranch) => serverBranch.id === localBranch.id));
          return [...mapped, ...localOnlyBranches].sort((a, b) => a.name.localeCompare(b.name));
        }
      }
    } catch (err) {
      // ignore and fall back to empty local branches
      console.warn('No sample branches available:', err);
    }

    return localBranches.sort((a, b) => a.name.localeCompare(b.name));
  }

  const { data, error } = await supabase.from('branches').select('*').order('name');

  if (error) {
    console.error('Failed to fetch branches:', error);
    return localBranches.sort((a, b) => a.name.localeCompare(b.name));
  }

  const serverBranches = data.map((row) => mergeLocalBranchMetadata(rowToBranch(row)));
  const localOnlyBranches = localBranches.filter((localBranch) => !serverBranches.some((serverBranch) => serverBranch.id === localBranch.id));

  return [...serverBranches, ...localOnlyBranches].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getBranchById(id: string): Promise<Branch | null> {
  if (!supabase) {
    const branch = readLocalBranches().find((item) => item.id === id);
    return branch ?? null;
  }

  const { data, error } = await supabase.from('branches').select('*').eq('id', id).single();

  if (error) {
    console.error(`Failed to fetch branch ${id}:`, error);
    const branch = readLocalBranches().find((item) => item.id === id);
    return branch ?? null;
  }

  return mergeLocalBranchMetadata(rowToBranch(data));
}

export async function createBranch(input: CreateBranchInput): Promise<Branch | null> {
  if (!supabase) {
    const now = new Date().toISOString();
    const nextBranch: Branch = {
      id: createBranchId(),
      name: input.name,
      division: input.division,
      province: input.province,
      city: input.city?.trim() || undefined,
      town: input.town,
      physicalAddress: input.physicalAddress,
      signageCompany: input.signageCompany?.trim() || undefined,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      contactName: input.contactName ?? undefined,
      contactEmail: input.contactEmail ?? undefined,
      contactPhone: input.contactPhone ?? undefined,
      contacts: input.contacts,
      createdAt: now,
      updatedAt: now,
    };

    const nextBranches = [...readLocalBranches(), nextBranch];
    writeLocalBranches(nextBranches);
    return nextBranch;
  }

  const insertPayload = buildBranchInsertPayload(input);

  const { data, error } = await saveBranchWithSchemaFallback('insert', insertPayload);

  if (error) {
    console.error('Failed to create branch:', error);

    if (!shouldFallbackToLocal(error.message)) {
      throw new Error(error.message || 'Failed to create branch');
    }

    const now = new Date().toISOString();
    const nextBranch: Branch = {
      id: createBranchId(),
      name: input.name,
      division: input.division,
      province: input.province,
      city: input.city?.trim() || undefined,
      town: input.town,
      physicalAddress: input.physicalAddress,
      signageCompany: input.signageCompany?.trim() || undefined,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      contactName: input.contactName ?? undefined,
      contactEmail: input.contactEmail ?? undefined,
      contactPhone: input.contactPhone ?? undefined,
      contacts: input.contacts,
      createdAt: now,
      updatedAt: now,
    };

    saveBranchToLocalShadow(nextBranch);
    return nextBranch;
  }

  const savedBranch = rowToBranch(data);
  saveBranchToLocalShadow(savedBranch);
  return savedBranch;
}

export async function createBranchProject(input: CreateBranchInput): Promise<{ branch: Branch; project: Project }> {
  const branch = await createBranch(input);
  if (!branch) {
    throw new Error('The branch could not be created.');
  }

  const projectInput: CreateProjectInput = {
    id: `branch-${branch.id}`,
    branchId: branch.id,
    branch: branch.name,
    branchCode: branch.code,
    province: branch.province,
    town: branch.town,
    physicalAddress: branch.physicalAddress,
    manager: branch.contactName,
    managerEmail: branch.contactEmail,
    projectType: 'signage_rollout',
    currentStage: 'New Project',
    status: 'in_progress',
    progress: 0,
    selectedTaskIds: [],
  };

  try {
    const project = await createProject(projectInput);

    if (supabase) {
      const { data: workspace, error: workspaceError } = await supabase
        .from('rebrand_workspaces')
        .select('id')
        .eq('branch_id', branch.id)
        .eq('is_primary', true)
        .eq('lifecycle_state', 'active')
        .maybeSingle();

      if (workspaceError) {
        throw workspaceError;
      }

      if (!workspace?.id) {
        const { error: createWorkspaceError } = await supabase
          .from('rebrand_workspaces')
          .insert({
            branch_id: branch.id,
            workspace_reference: `WS-${project.id}`,
            workspace_type: 'rebrand',
            is_primary: true,
            lifecycle_state: 'active',
            health: 'on_track',
            progress: 0,
            notes: `Created for branch project ${project.id}.`,
          });

        if (createWorkspaceError) {
          throw createWorkspaceError;
        }
      }
    }

    return { branch, project };
  } catch (error) {
    try {
      await deleteBranch(branch.id);
    } catch {
      // Preserve the project creation error if cleanup is blocked by permissions.
    }
    throw error;
  }
}

export async function updateBranch(id: string, input: Partial<CreateBranchInput>): Promise<Branch | null> {
  if (!supabase) {
    const branches = readLocalBranches();
    const index = branches.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error('Branch not found.');
    }

    const existing = branches[index];
    const syncedContactFields = getPrimaryContactFromContacts({
      contactName: input.contactName ?? existing.contactName ?? null,
      contactEmail: input.contactEmail ?? existing.contactEmail ?? null,
      contactPhone: input.contactPhone ?? existing.contactPhone ?? null,
      contacts: input.contacts ?? existing.contacts,
    });

    const updatedBranch: Branch = {
      ...existing,
      name: input.name ?? existing.name,
      division: input.division ?? existing.division,
      province: input.province ?? existing.province,
      city: input.city !== undefined ? input.city ?? undefined : existing.city,
      town: input.town ?? existing.town,
      physicalAddress: input.physicalAddress ?? existing.physicalAddress,
      signageCompany: input.signageCompany !== undefined ? input.signageCompany?.trim() || undefined : existing.signageCompany,
      latitude: input.latitude !== undefined ? input.latitude : existing.latitude,
      longitude: input.longitude !== undefined ? input.longitude : existing.longitude,
      contactName: syncedContactFields.contactName ?? undefined,
      contactEmail: syncedContactFields.contactEmail ?? undefined,
      contactPhone: syncedContactFields.contactPhone ?? undefined,
      contacts: input.contacts !== undefined ? input.contacts ?? undefined : existing.contacts,
      updatedAt: new Date().toISOString(),
    };

    branches[index] = updatedBranch;
    writeLocalBranches(branches);
    return updatedBranch;
  }

  const syncedContactFields = getPrimaryContactFromContacts(input as Pick<CreateBranchInput, 'contactName' | 'contactEmail' | 'contactPhone' | 'contacts'>);
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.division !== undefined) updates.division = input.division;
  if (input.province !== undefined) updates.province = input.province;
  if (input.city !== undefined) updates.city = input.city;
  if (input.town !== undefined) updates.town = input.town;
  if (input.physicalAddress !== undefined) updates.physical_address = input.physicalAddress;
  if (input.signageCompany !== undefined) updates.signage_company = input.signageCompany?.trim() || null;
  if (input.latitude !== undefined) updates.latitude = input.latitude;
  if (input.longitude !== undefined) updates.longitude = input.longitude;
  if (input.contactName !== undefined || input.contacts !== undefined) {
    updates.contact_name = syncedContactFields.contactName;
  }
  if (input.contactEmail !== undefined || input.contacts !== undefined) {
    updates.contact_email = syncedContactFields.contactEmail;
  }
  if (input.contactPhone !== undefined || input.contacts !== undefined) {
    updates.contact_phone = syncedContactFields.contactPhone;
  }
  if (input.contacts !== undefined) updates.contacts = input.contacts;

  const { data, error } = await saveBranchWithSchemaFallback('update', updates, id);

  if (error) {
    console.error('Failed to update branch:', error);
    throw new Error(error.message || 'Failed to update branch');
  }

  const updatedBranch = rowToBranch(data);
  saveBranchToLocalShadow(updatedBranch);
  return updatedBranch;
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
