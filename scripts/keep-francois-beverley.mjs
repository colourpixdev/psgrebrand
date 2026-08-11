import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

      vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    }

    return vars;
  } catch {
    return {};
  }
}

const env = {
  ...loadEnv(resolve(__dirname, '..', '.env.local')),
  ...process.env,
};

const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables.');
  console.error('  VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗ missing');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✓' : '✗ missing');
  console.error('Add them to .env.local or your shell environment and rerun this script.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const keepEmails = ['francois@colourpix.co.za', 'beverley@colourpix.co.za'].map((email) => email.toLowerCase());

async function listAuthUsers() {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw error;
    }

    users.push(...(data.users ?? []));
    if ((data.users ?? []).length < 1000) {
      break;
    }
    page += 1;
  }

  return users;
}

async function deleteOtherAuthUsers(users) {
  const keepMap = new Map();
  const deleteList = [];

  for (const user of users) {
    const email = user.email?.trim().toLowerCase();
    if (!email || !keepEmails.includes(email)) {
      deleteList.push(user);
      continue;
    }

    if (!keepMap.has(email)) {
      keepMap.set(email, user);
      continue;
    }

    deleteList.push(user);
  }

  const deleted = [];
  for (const user of deleteList) {
    const { error } = await adminClient.auth.admin.deleteUser(user.id);
    if (error) {
      throw new Error(`Failed to delete auth user ${user.email ?? user.id}: ${error.message}`);
    }
    deleted.push(user.email ?? user.id);
  }

  return deleted;
}

async function cleanProfiles() {
  const emailList = keepEmails.map((email) => `'${email}'`).join(',');
  const { error: deleteError } = await adminClient
    .from('profiles')
    .delete()
    .not('email', 'in', `(${emailList})`);

  if (deleteError) {
    throw deleteError;
  }

  for (const email of keepEmails) {
    const name = email.startsWith('francois') ? 'Francois' : 'Beverley';
    const { error: upsertError } = await adminClient
      .from('profiles')
      .upsert(
        {
          email,
          name,
          role: 'colourpix_admin',
          branch: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' },
      );

    if (upsertError) {
      throw upsertError;
    }
  }
}

async function updateKeptAuthUsers(users) {
  for (const user of users) {
    const email = user.email?.trim().toLowerCase();
    if (!email || !keepEmails.includes(email)) {
      continue;
    }

    const name = email.startsWith('francois') ? 'Francois' : 'Beverley';
    const { error } = await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: { name, role: 'colourpix_admin' },
    });

    if (error) {
      throw new Error(`Failed to update kept auth user ${email}: ${error.message}`);
    }
  }
}

async function main() {
  console.log('Listing Supabase auth users...');
  const users = await listAuthUsers();
  console.log(`Found ${users.length} auth users.`);

  const deletedAuthUsers = await deleteOtherAuthUsers(users);
  console.log(`Deleted ${deletedAuthUsers.length} auth users.`);

  console.log('Updating kept auth user metadata...');
  await updateKeptAuthUsers(users);

  console.log('Cleaning Supabase profiles...');
  await cleanProfiles();

  const remainingUsers = await listAuthUsers();
  console.log(`Remaining auth users: ${remainingUsers.map((user) => user.email ?? user.id).join(', ')}`);

  const { data: remainingProfiles, error: profileError } = await adminClient.from('profiles').select('email, name, role').order('email');
  if (profileError) {
    throw profileError;
  }

  console.log('Remaining profiles:', remainingProfiles);
  console.log('Cleanup complete. Only Francois and Beverley should remain.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
