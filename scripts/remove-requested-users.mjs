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
const emails = [
  'ops@abcsignage.co.za',
  'beverley@colourpix.co.za',
  'john.smith@psg.co.za',
  'head.office@psg.co.za',
  'psg@psg.co.za',
];

if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const adminClient = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: profiles, error: profileLookupError } = await adminClient
  .from('profiles')
  .select('id, email')
  .in('email', emails);
if (profileLookupError) throw profileLookupError;

const { error: profileDeleteError } = await adminClient.from('profiles').delete().in('email', emails);
if (profileDeleteError) throw profileDeleteError;

let page = 1;
let deletedAuthUsers = 0;
while (true) {
  const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  const matches = (data.users ?? []).filter((user) => emails.includes(user.email?.trim().toLowerCase()));
  for (const user of matches) {
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    deletedAuthUsers += 1;
  }
  if ((data.users ?? []).length < 1000) break;
  page += 1;
}

console.log(`Deleted ${profiles?.length ?? 0} profile row(s) and ${deletedAuthUsers} Auth user(s).`);