/**
 * reset-auth-passwords.mjs
 * Resets the password for all seeded auth users to the default.
 * Run after seed:auth if users already existed with a different password.
 *
 * Usage:
 *   node scripts/reset-auth-passwords.mjs
 *   # or via npm:
 *   npm run reset:passwords
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '..', '.env.local');

function loadEnv(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const vars = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      vars[key] = val;
    }
    return vars;
  } catch {
    return {};
  }
}

const env = { ...loadEnv(envPath), ...process.env };
const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === 'REPLACE_WITH_YOUR_SERVICE_ROLE_SECRET') {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NEW_PASSWORD = 'Rebrand2026!';

const TARGET_EMAILS = [
  'beverley@colourpix.co.za',
  'francois@colourpix.co.za',
  'head.office@psg.co.za',
  'john.smith@psg.co.za',
  'ops@abcsignage.co.za',
];

async function resetPasswords() {
  console.log('\nFetching all auth users…');

  // List all users (up to 1000)
  const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

  if (error) {
    console.error('Failed to list users:', error.message);
    process.exit(1);
  }

  const users = data.users;
  console.log(`Found ${users.length} auth user(s) total.\n`);

  for (const email of TARGET_EMAILS) {
    const match = users.find((u) => u.email === email);

    if (!match) {
      console.log(`  ✗ ${email} — not found in Auth (run seed:auth first)`);
      continue;
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(match.id, {
      password: NEW_PASSWORD,
      email_confirm: true,
    });

    if (updateError) {
      console.error(`  ✗ ${email} — ${updateError.message}`);
    } else {
      console.log(`  ✓ ${email} — password reset to: ${NEW_PASSWORD}`);
    }
  }

  console.log('\nDone. All targeted users can now sign in with Rebrand2026!\n');
}

resetPasswords().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
