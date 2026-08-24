import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(filePath) {
  try {
    return Object.fromEntries(readFileSync(filePath, 'utf8').split(/\r?\n/).flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return [];
      const separator = trimmed.indexOf('=');
      return separator === -1 ? [] : [[trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')]];
    }));
  } catch {
    return {};
  }
}

const env = { ...loadEnv(resolve(__dirname, '..', '.env.local')), ...process.env };
const password = 'PSG123';
const users = [
  { name: 'Tharwah Solomon', email: 'tharwah.solomon@psg.co.za' },
  { name: 'Kweku', email: 'gavor.kweku@psg.co.za' },
  { name: 'Aleza van Zyl', email: 'aleza.vanzyl@psg.co.za' },
  { name: 'Sheyaam Hill', email: 'sheyaam.hill@psg.co.za' },
  { name: 'Judith Claassens', email: 'judith.claassens@psg.co.za' },
];

if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const adminClient = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listAuthUsers() {
  const result = [];
  let page = 1;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    result.push(...(data.users ?? []));
    if ((data.users ?? []).length < 1000) return result;
    page += 1;
  }
}

const authUsers = await listAuthUsers();
for (const user of users) {
  const email = user.email.toLowerCase();
  const existing = authUsers.find((item) => item.email?.trim().toLowerCase() === email);
  let authUser = existing;

  if (existing) {
    const { data, error } = await adminClient.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { name: user.name, role: 'psg_user' },
    });
    if (error) throw error;
    authUser = data.user;
  } else {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: user.name, role: 'psg_user' },
    });
    if (error) throw error;
    authUser = data.user;
  }

  if (!authUser) throw new Error(`Auth user was not returned for ${email}.`);

  const { error: profileError } = await adminClient.from('profiles').upsert({
    user_id: authUser.id,
    name: user.name,
    email,
    role: 'psg_user',
    branch: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'email' });
  if (profileError) throw profileError;

  console.log(`${existing ? 'Updated' : 'Created'} ${email}`);
}

console.log(`Processed ${users.length} PSG user accounts.`);