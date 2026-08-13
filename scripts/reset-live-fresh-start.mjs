import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const preferredMeEmail = 'francois@colourpix.co.za';
const preferredBeverleyEmails = ['bd@colourpix.co.za', 'beverley@colourpix.co.za'];
const storageBuckets = ['project-files', 'voice-updates'];

function loadEnv(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const vars = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eq = trimmed.indexOf('=');
      if (eq === -1) {
        continue;
      }
      vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
    return vars;
  } catch {
    return {};
  }
}

const env = {
  ...loadEnv(resolve(__dir, '..', '.env.local')),
  ...loadEnv(resolve(__dir, '..', '.env')),
  ...process.env,
};

const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === 'REPLACE_WITH_YOUR_SERVICE_ROLE_SECRET') {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listAuthUsers() {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw error;
    }

    users.push(...data.users);
    if (data.users.length < 1000) {
      break;
    }
    page += 1;
  }

  return users;
}

async function countRows(table) {
  const { count, error } = await adminClient.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    throw error;
  }
  return count ?? 0;
}

async function listStorageObjects(bucket, prefix = '') {
  const { data, error } = await adminClient.storage
    .from(bucket)
    .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

  if (error) {
    if (error.message?.toLowerCase().includes('not found')) {
      return [];
    }
    throw error;
  }

  const objects = [];
  for (const item of data ?? []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      objects.push(...await listStorageObjects(bucket, path));
    } else {
      objects.push(path);
    }
  }

  return objects;
}

async function clearStorageBucket(bucket) {
  const objects = await listStorageObjects(bucket);
  for (let index = 0; index < objects.length; index += 100) {
    const batch = objects.slice(index, index + 100);
    if (batch.length === 0) {
      continue;
    }
    const { error } = await adminClient.storage.from(bucket).remove(batch);
    if (error) {
      throw error;
    }
  }
  return objects.length;
}

function normalizeEmail(value) {
  return value?.trim().toLowerCase() ?? '';
}

function isMissingProjectColumnError(message) {
  const lowered = message.toLowerCase();
  return [
    'branch_id',
    'branch_code',
    'province',
    'town',
    'physical_address',
    'latitude',
    'longitude',
    'workspace_id',
    'workspace_name',
    'client_company',
    'graphics_partner',
    'project_type',
    'project_type_name',
    'site_label',
    'delivery_partner_label',
    'signage_contact_name',
    'signage_contact_email',
    'signage_contact_phone',
  ].some((column) => lowered.includes(column));
}

function extractMissingColumn(message) {
  const match = /could not find the '([^']+)' column/i.exec(message);
  return match?.[1] ?? null;
}

async function ensureAuthUser(email, name) {
  const normalizedEmail = normalizeEmail(email);
  let authUser = (await listAuthUsers()).find((item) => normalizeEmail(item.email) === normalizedEmail);
  if (!authUser) {
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: { name, role: 'colourpix_admin' },
      redirectTo: env.SITE_URL || undefined,
    });
    if (error) {
      throw error;
    }
    authUser = data.user;
  }

  if (!authUser) {
    throw new Error(`Could not ensure auth user for ${email}.`);
  }

  const { error: metadataError } = await adminClient.auth.admin.updateUserById(authUser.id, {
    user_metadata: { name, role: 'colourpix_admin' },
  });
  if (metadataError) {
    throw metadataError;
  }

  return authUser;
}

async function upsertProfile({ userId, name, email, role }) {
  const payload = {
    user_id: userId,
    name,
    email,
    role,
    branch: null,
    company: 'Colourpix CC',
    profile_title: null,
    workspace_ids: ['*'],
    updated_at: new Date().toISOString(),
  };

  let result = await adminClient
    .from('profiles')
    .upsert(payload, { onConflict: 'email' })
    .select('email, name, role')
    .single();

  if (['company', 'profile_title'].some((column) => result.error?.message.toLowerCase().includes(column))) {
    const { company, profile_title, ...fallbackPayload } = payload;
    result = await adminClient
      .from('profiles')
      .upsert(fallbackPayload, { onConflict: 'email' })
      .select('email, name, role')
      .single();
  }

  if (result.error?.message.toLowerCase().includes('workspace_ids')) {
    const { workspace_ids, company, profile_title, ...fallbackPayload } = payload;
    result = await adminClient
      .from('profiles')
      .upsert(fallbackPayload, { onConflict: 'email' })
      .select('email, name, role')
      .single();
  }

  if (result.error) {
    throw result.error;
  }
}

async function getJanKempdorpBranch() {
  let branchResult = await adminClient
    .from('branches')
    .select('id, name, code, province, town, physical_address, latitude, longitude')
    .or('name.ilike.%Jan Kemp%,town.ilike.%Jan Kemp%')
    .limit(1);

  if (branchResult.error?.message?.toLowerCase().includes('code')) {
    branchResult = await adminClient
      .from('branches')
      .select('id, name, province, town, physical_address, latitude, longitude')
      .or('name.ilike.%Jan Kemp%,town.ilike.%Jan Kemp%')
      .limit(1);
  }

  if (branchResult.error) {
    throw branchResult.error;
  }

  const data = branchResult.data;

  if (data && data.length > 0) {
    return data[0];
  }

  const fallback = {
    id: 'psg-001',
    name: 'PSG Jan Kemp Dorp Wealth',
    division: 'Wealth',
    province: 'Northern Cape',
    city: 'Jan Kempdorp',
    town: 'Jan Kempdorp',
    physical_address: 'Frans Lubbe Street, Jan Kempdorp, 8550',
    latitude: -27.9234,
    longitude: 24.8306,
    updated_at: new Date().toISOString(),
  };

  let inserted = await adminClient
    .from('branches')
    .upsert(fallback, { onConflict: 'id' })
    .select('id, name, code, province, town, physical_address, latitude, longitude')
    .single();

  if (inserted.error?.message?.toLowerCase().includes('code')) {
    inserted = await adminClient
      .from('branches')
      .upsert(fallback, { onConflict: 'id' })
      .select('id, name, province, town, physical_address, latitude, longitude')
      .single();
  }

  if (inserted.error) {
    throw inserted.error;
  }

  return inserted.data;
}

async function createSingleProject(branch) {
  const branchCode = (branch.code || 'PSG001').toUpperCase();
  const id = `${branchCode}P1`;

  const projectPayload = {
    id,
    branch_id: branch.id,
    branch_code: branchCode,
    branch: branch.name,
    province: branch.province || 'Northern Cape',
    town: branch.town || 'Jan Kempdorp',
    physical_address: branch.physical_address || 'Frans Lubbe Street, Jan Kempdorp, 8550',
    latitude: typeof branch.latitude === 'number' ? branch.latitude : null,
    longitude: typeof branch.longitude === 'number' ? branch.longitude : null,
    manager: 'Francois',
    manager_email: preferredMeEmail,
    installer: 'Colourpix CC',
    designer: 'Colourpix CC',
    current_stage: 'New Project',
    status: 'in_progress',
    target_date: '',
    installation_date: '',
    completion_date: '',
    progress: 0,
    branch_manager_view_only: false,
    notes: 'Fresh restart baseline project for Jan Kempdorp.',
    files: [],
    tasks: [],
    comments: [],
    activity: [{
      date: new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }),
      title: 'Workspace reset',
      detail: 'Data reset completed. This branch project is the fresh baseline.',
      type: 'info',
    }],
    workspace_id: 'psg-national-signage-rollout',
    workspace_name: 'Colourpix / PSG Wealth Insure Workspace',
    client_company: 'PSG Wealth Insure',
    graphics_partner: 'Colourpix CC',
    project_type: 'signage_rollout',
    project_type_name: 'Signage rollout',
    site_label: 'Branch',
    delivery_partner_label: 'Service partner',
    signage_contact_name: null,
    signage_contact_email: null,
    signage_contact_phone: null,
    updated_at: new Date().toISOString(),
  };

  let payload = { ...projectPayload };
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const insertResult = await adminClient.from('projects').insert(payload);
    if (!insertResult.error) {
      return id;
    }

    const message = insertResult.error.message ?? '';
    if (!isMissingProjectColumnError(message)) {
      throw insertResult.error;
    }

    const missingColumn = extractMissingColumn(message);
    if (!missingColumn || !(missingColumn in payload)) {
      throw insertResult.error;
    }

    delete payload[missingColumn];
  }

  throw new Error('Project insertion failed after removing missing columns.');
}

async function main() {
  const beforeUsers = await listAuthUsers();
  const beforeProfiles = await countRows('profiles');
  const beforeProjects = await countRows('projects');

  let meUser = beforeUsers.find((user) => normalizeEmail(user.email) === preferredMeEmail);
  if (!meUser) {
    meUser = await ensureAuthUser(preferredMeEmail, 'Francois');
  }

  const refreshedUsers = await listAuthUsers();
  const preferredBeverleyEmail = preferredBeverleyEmails.find((email) => refreshedUsers.some((user) => normalizeEmail(user.email) === normalizeEmail(email)))
    ?? preferredBeverleyEmails[0];
  const beverleyUser = await ensureAuthUser(preferredBeverleyEmail, 'Beverley');

  await upsertProfile({ userId: meUser.id, name: 'Francois', email: preferredMeEmail, role: 'colourpix_admin' });
  await upsertProfile({ userId: beverleyUser.id, name: 'Beverley', email: preferredBeverleyEmail, role: 'colourpix_admin' });

  const keepEmails = new Set([preferredMeEmail, normalizeEmail(preferredBeverleyEmail)]);

  const deletedStorage = {};
  for (const bucket of storageBuckets) {
    deletedStorage[bucket] = await clearStorageBucket(bucket);
  }

  const { error: deleteProjectsError } = await adminClient.from('projects').delete().neq('id', '__keep_none__');
  if (deleteProjectsError) {
    throw deleteProjectsError;
  }

  const { error: deleteProfilesError } = await adminClient.from('profiles').delete().not('email', 'in', `(${Array.from(keepEmails).map((email) => `"${email}"`).join(',')})`);
  if (deleteProfilesError) {
    throw deleteProfilesError;
  }

  for (const user of await listAuthUsers()) {
    if (keepEmails.has(normalizeEmail(user.email))) {
      continue;
    }

    const { error } = await adminClient.auth.admin.deleteUser(user.id);
    if (error) {
      throw new Error(`Could not delete ${user.email ?? user.id}: ${error.message}`);
    }
  }

  const janBranch = await getJanKempdorpBranch();
  const projectId = await createSingleProject(janBranch);

  const afterUsers = await listAuthUsers();
  const afterProfiles = await countRows('profiles');
  const afterProjects = await countRows('projects');

  console.log(`Before: ${beforeUsers.length} auth users, ${beforeProfiles} profiles, ${beforeProjects} projects.`);
  console.log(`Deleted storage objects: ${JSON.stringify(deletedStorage)}`);
  console.log(`After: ${afterUsers.length} auth users, ${afterProfiles} profiles, ${afterProjects} projects.`);
  console.log(`Remaining auth users: ${afterUsers.map((user) => user.email ?? user.id).join(', ')}`);
  console.log(`Kept project: ${projectId} (${janBranch.name})`);
  console.log('Francois profile name updated and all non-kept users/projects removed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
