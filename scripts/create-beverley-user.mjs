import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const user = {
  name: 'Beverley',
  email: 'bd@colourpix.co.za',
  role: 'colourpix_admin',
  branch: null,
  workspace_ids: ['*'],
};

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

async function main() {
  const existingAuthUser = (await listAuthUsers()).find((authUser) => authUser.email?.trim().toLowerCase() === user.email);
  let authUser = existingAuthUser;
  let inviteSent = false;

  if (!authUser) {
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(user.email, {
      data: {
        name: user.name,
        role: user.role,
      },
      redirectTo: env.SITE_URL || undefined,
    });

    if (error) {
      throw error;
    }

    authUser = data.user;
    inviteSent = true;
  }

  if (!authUser) {
    throw new Error('Auth user could not be created.');
  }

  const { error: metadataError } = await adminClient.auth.admin.updateUserById(authUser.id, {
    user_metadata: {
      name: user.name,
      role: user.role,
    },
  });

  if (metadataError) {
    throw metadataError;
  }

  const profilePayload = {
    user_id: authUser.id,
    name: user.name,
    email: user.email,
    role: user.role,
    branch: user.branch,
    company: 'Colourpix CC',
    profile_title: 'Workspace Administrator',
    workspace_ids: user.workspace_ids,
    updated_at: new Date().toISOString(),
  };

  let profileResult = await adminClient
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'email' })
    .select('email, name, role, branch, workspace_ids')
    .single();

  if (['company', 'profile_title'].some((column) => profileResult.error?.message.toLowerCase().includes(column))) {
    const { company, profile_title, ...fallbackProfilePayload } = profilePayload;
    profileResult = await adminClient
      .from('profiles')
      .upsert(fallbackProfilePayload, { onConflict: 'email' })
      .select('email, name, role, branch, workspace_ids')
      .single();
  }

  if (profileResult.error?.message.toLowerCase().includes('workspace_ids')) {
    const { workspace_ids, company, profile_title, ...fallbackProfilePayload } = profilePayload;
    profileResult = await adminClient
      .from('profiles')
      .upsert(fallbackProfilePayload, { onConflict: 'email' })
      .select('email, name, role, branch')
      .single();
  }

  if (profileResult.error) {
    throw profileResult.error;
  }

  const authUsers = await listAuthUsers();
  const profile = profileResult.data;

  console.log(inviteSent ? 'Invite sent and user created.' : 'Existing auth user updated.');
  console.log(`Auth users: ${authUsers.map((authUserItem) => authUserItem.email ?? authUserItem.id).join(', ')}`);
  console.log(`Profile: ${profile.email} (${profile.role}) workspace_ids=${JSON.stringify(profile.workspace_ids ?? null)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});