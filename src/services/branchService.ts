import { supabase } from '../lib/supabase';
import { createProject, getProjects, type CreateProjectInput } from './portalService';
import type { Branch, ContactPerson, Division, Project } from '../types/domain';
import { createNextBranchCode, createNextProjectId } from '../utils/branchProjectIds';

const branchesStorageKey = 'psg-rebrand:branches';

export function normalizeBranchLocationValue(value?: string | null) {
  return (value ?? '').trim().replace(/^,\s*/, '').trim();
}

export function formatBranchLocation(town?: string, province?: string) {
  const normalizedParts = [town, province]
    .map((value) => normalizeBranchLocationValue(value))
    .filter(Boolean);

  return normalizedParts.join(' ');
}

/**
 * Format a branch name as "[Branch Name] [Division]" when division is supplied.
 */
export function formatBranchName(division: Division, branchName: string): string {
  const baseName = extractBranchName(branchName).trim();
  if (!baseName) {
    return division;
  }

  return division ? `${baseName} ${division}`.trim() : baseName;
}

/**
 * Extract the base branch name by removing any PSG prefix and division label.
 */
export function extractBranchName(fullName: string): string {
  const trimmedName = fullName.trim();

  const psgMatch = trimmedName.match(/^PSG\s+(?:Wealth|Insure|Wealth\s+Insure|Asset|Trust)\s+(.+)$/i);
  if (psgMatch) {
    return psgMatch[1].trim();
  }

  const genericPsgMatch = trimmedName.match(/^PSG\s+(.+)$/i);
  if (genericPsgMatch) {
    return genericPsgMatch[1].trim();
  }

  return trimmedName;
}

export interface CreateBranchInput {
  name: string;
  code?: string | null;
  division: Division;
  province: string;
  city?: string | null;
  town: string;
  physicalAddress: string;
  signageCompany?: string | null;
  signageContactName?: string | null;
  signageContactPhone?: string | null;
  signageContactEmail?: string | null;
  signageAddress?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contacts?: ContactPerson[];
  marketingCoordinatorName?: string | null;
  marketingCoordinatorEmail?: string | null;
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
  signage_contact_name?: string | null;
  signage_contact_phone?: string | null;
  signage_contact_email?: string | null;
  signage_address?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contacts?: ContactPerson[] | null;
  marketing_coordinator_name?: string | null;
  marketing_coordinator_email?: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
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
    province: normalizeBranchLocationValue(row.province) || 'Not captured',
    city: row.city ?? undefined,
    town: row.town ?? 'Not captured',
    physicalAddress: row.physical_address ?? '',
    signageCompany: row.signage_company ?? undefined,
    signageContactName: row.signage_contact_name ?? undefined,
    signageContactPhone: row.signage_contact_phone ?? undefined,
    signageContactEmail: row.signage_contact_email ?? undefined,
    signageAddress: row.signage_address ?? undefined,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    contacts: Array.isArray(row.contacts) ? row.contacts : undefined,
    marketingCoordinatorName: row.marketing_coordinator_name ?? undefined,
    marketingCoordinatorEmail: row.marketing_coordinator_email ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    archivedAt: row.archived_at ?? undefined,
  };
}

function createBranchId() {
  return globalThis.crypto?.randomUUID?.() ?? `branch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function createProjectId(branchCode: string) {
  if (supabase) {
    const { data, error } = await supabase.rpc('allocate_project_id', { p_branch_code: branchCode });
    if (!error && typeof data === 'string' && data.trim()) {
      return data;
    }
  }

  return createNextProjectId(branchCode, await getProjects({ includeFiles: false }));
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
    'signage_contact_name',
    'signage_contact_phone',
    'signage_contact_email',
    'signage_address',
    'city',
    'contacts',
  ].some((column) => normalizedMessage.includes(column));
}

function getMissingBranchColumns(errorMessage: string | undefined) {
  if (!errorMessage) {
    return [] as Array<'contact_name' | 'contact_email' | 'contact_phone' | 'signage_company' | 'signage_contact_name' | 'signage_contact_phone' | 'signage_contact_email' | 'signage_address' | 'city' | 'contacts'>;
  }

  const normalizedMessage = errorMessage.toLowerCase();
  const supportedColumns = ['contact_name', 'contact_email', 'contact_phone', 'signage_company', 'signage_contact_name', 'signage_contact_phone', 'signage_contact_email', 'signage_address', 'city', 'contacts'] as const;
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

  const payload = {
    name: input.name,
    division: input.division,
    province: normalizeBranchLocationValue(input.province) || null,
    city: input.city?.trim() || null,
    town: input.town,
    physical_address: input.physicalAddress,
    signage_company: input.signageCompany?.trim() || null,
    signage_contact_name: input.signageContactName?.trim() || null,
    signage_contact_phone: input.signageContactPhone?.trim() || null,
    signage_contact_email: input.signageContactEmail?.trim() || null,
    signage_address: input.signageAddress?.trim() || null,
    contact_name: syncedContactFields.contactName,
    contact_email: syncedContactFields.contactEmail,
    contact_phone: syncedContactFields.contactPhone,
    contacts: input.contacts ?? [],
    marketing_coordinator_name: input.marketingCoordinatorName?.trim() || null,
    marketing_coordinator_email: input.marketingCoordinatorEmail?.trim() || null,
  };

  const code = input.code?.trim();
  return code ? { ...payload, code } : payload;
}

function omitBranchColumns<T extends Record<string, unknown>>(
  payload: T,
  columns: readonly ('contact_name' | 'contact_email' | 'contact_phone' | 'signage_company' | 'signage_contact_name' | 'signage_contact_phone' | 'signage_contact_email' | 'signage_address' | 'city' | 'contacts')[],
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
    throw error;
  }

  const serverBranches = data.filter((row) => !row.archived_at).map((row) => mergeLocalBranchMetadata(rowToBranch(row)));
  writeLocalBranches(serverBranches);
  return serverBranches.sort((a, b) => a.name.localeCompare(b.name));
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
    const localBranches = readLocalBranches();
    const code = input.code?.trim() || createNextBranchCode(localBranches);
    const nextBranch: Branch = {
      id: createBranchId(),
      code,
      name: input.name,
      division: input.division,
      province: input.province,
      city: input.city?.trim() || undefined,
      town: input.town,
      physicalAddress: input.physicalAddress,
      signageCompany: input.signageCompany?.trim() || undefined,
      signageContactName: input.signageContactName?.trim() || undefined,
      signageContactPhone: input.signageContactPhone?.trim() || undefined,
      signageContactEmail: input.signageContactEmail?.trim() || undefined,
      signageAddress: input.signageAddress?.trim() || undefined,
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
    const localBranches = readLocalBranches();
    const code = input.code?.trim() || createNextBranchCode(localBranches);
    const nextBranch: Branch = {
      id: createBranchId(),
      code,
      name: input.name,
      division: input.division,
      province: input.province,
      city: input.city?.trim() || undefined,
      town: input.town,
      physicalAddress: input.physicalAddress,
      signageCompany: input.signageCompany?.trim() || undefined,
      signageContactName: input.signageContactName?.trim() || undefined,
      signageContactPhone: input.signageContactPhone?.trim() || undefined,
      signageContactEmail: input.signageContactEmail?.trim() || undefined,
      signageAddress: input.signageAddress?.trim() || undefined,
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
    id: await createProjectId(branch.code ?? 'PSG000'),
    branchId: branch.id,
    branch: branch.name,
    branchCode: branch.code,
    province: branch.province,
    town: branch.town,
    physicalAddress: branch.physicalAddress,
    manager: input.marketingCoordinatorName ?? branch.contactName,
    managerEmail: input.marketingCoordinatorEmail ?? branch.contactEmail,
    projectType: 'signage_rollout',
    currentStage: 'Site Inspection',
    status: 'on_schedule',
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
      code: input.code !== undefined ? input.code?.trim() || undefined : existing.code,
      division: input.division ?? existing.division,
      province: input.province ?? existing.province,
      city: input.city !== undefined ? input.city ?? undefined : existing.city,
      town: input.town ?? existing.town,
      physicalAddress: input.physicalAddress ?? existing.physicalAddress,
      signageCompany: input.signageCompany !== undefined ? input.signageCompany?.trim() || undefined : existing.signageCompany,
      signageContactName: input.signageContactName !== undefined ? input.signageContactName?.trim() || undefined : existing.signageContactName,
      signageContactPhone: input.signageContactPhone !== undefined ? input.signageContactPhone?.trim() || undefined : existing.signageContactPhone,
      signageContactEmail: input.signageContactEmail !== undefined ? input.signageContactEmail?.trim() || undefined : existing.signageContactEmail,
      contactName: syncedContactFields.contactName ?? undefined,
      contactEmail: syncedContactFields.contactEmail ?? undefined,
      contactPhone: syncedContactFields.contactPhone ?? undefined,
      contacts: input.contacts !== undefined ? input.contacts ?? undefined : existing.contacts,
      marketingCoordinatorName: input.marketingCoordinatorName !== undefined ? input.marketingCoordinatorName?.trim() || undefined : existing.marketingCoordinatorName,
      marketingCoordinatorEmail: input.marketingCoordinatorEmail !== undefined ? input.marketingCoordinatorEmail?.trim() || undefined : existing.marketingCoordinatorEmail,
      updatedAt: new Date().toISOString(),
    };

    branches[index] = updatedBranch;
    writeLocalBranches(branches);
    return updatedBranch;
  }

  const existingBranchResult = await supabase
    .from('branches')
    .select('id, name, code')
    .eq('id', id)
    .maybeSingle();

  const syncedContactFields = getPrimaryContactFromContacts(input as Pick<CreateBranchInput, 'contactName' | 'contactEmail' | 'contactPhone' | 'contacts'>);
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.code !== undefined) updates.code = input.code?.trim() || null;
  if (input.division !== undefined) updates.division = input.division;
  if (input.province !== undefined) updates.province = input.province;
  if (input.city !== undefined) updates.city = input.city;
  if (input.town !== undefined) updates.town = input.town;
  if (input.physicalAddress !== undefined) updates.physical_address = input.physicalAddress;
  if (input.signageCompany !== undefined) updates.signage_company = input.signageCompany?.trim() || null;
  if (input.signageContactName !== undefined) updates.signage_contact_name = input.signageContactName?.trim() || null;
  if (input.signageContactPhone !== undefined) updates.signage_contact_phone = input.signageContactPhone?.trim() || null;
  if (input.signageContactEmail !== undefined) updates.signage_contact_email = input.signageContactEmail?.trim() || null;
  if (input.signageAddress !== undefined) updates.signage_address = input.signageAddress?.trim() || null;
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
  if (input.marketingCoordinatorName !== undefined) updates.marketing_coordinator_name = input.marketingCoordinatorName?.trim() || null;
  if (input.marketingCoordinatorEmail !== undefined) updates.marketing_coordinator_email = input.marketingCoordinatorEmail?.trim() || null;

  const { data, error } = await saveBranchWithSchemaFallback('update', updates, id);

  if (error) {
    console.error('Failed to update branch:', error);
    throw new Error(error.message || 'Failed to update branch');
  }

  const updatedBranch = rowToBranch(data);
  const previousName = existingBranchResult.data?.name;

  if (previousName && previousName !== updatedBranch.name) {
    const syncPayload = {
      branch: updatedBranch.name,
      branch_code: updatedBranch.code ?? null,
      updated_at: new Date().toISOString(),
    };

    const linkedProjectUpdate = supabase.from('projects').update(syncPayload).eq('branch_id', id);
    const legacyNameUpdate = supabase.from('projects').update(syncPayload).eq('branch', previousName);

    const [linkedResult, legacyResult] = await Promise.allSettled([linkedProjectUpdate.select('id'), legacyNameUpdate.select('id')]);

    linkedResult.status === 'rejected' && console.warn('Failed to sync linked project names by branch_id:', linkedResult.reason);
    legacyResult.status === 'rejected' && console.warn('Failed to sync linked project names by legacy branch name:', legacyResult.reason);
  }

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

  const { data, error } = await supabase
    .from('branches')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');

  if (!error && data && data.length > 0) {
    return true;
  }

  if (!error && (!data || data.length === 0)) {
    const { data: existingBranch, error: lookupError } = await supabase
      .from('branches')
      .select('id, archived_at')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) {
      console.error('Failed to verify branch state before archive:', lookupError);
      throw new Error(lookupError.message || 'Failed to archive branch');
    }

    if (!existingBranch) {
      throw new Error('Branch not found.');
    }

    if (existingBranch.archived_at) {
      return true;
    }

    throw new Error('The branch was not removed. Apply the branch archive migration or check your permissions.');
  }

  if (error) {
    const normalizedMessage = (error.message || '').toLowerCase();
    if (
      normalizedMessage.includes('archived_at')
      || normalizedMessage.includes('does not exist')
      || normalizedMessage.includes('column')
    ) {
      throw new Error('The branch archive column is missing. Run the branch archive migration before removing this branch.');
    }

    console.error('Failed to delete branch:', error);
    throw new Error(error.message || 'Failed to archive branch');
  }

  return true;
}
