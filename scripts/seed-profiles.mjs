/**
 * seed-profiles.mjs
 * Upserts profile records into public.profiles AND corrects
 * user_metadata (role, name, branch) on the matching auth users
 * so that sign-in resolves the right role and display name.
 *
 * Requires the table to already exist (apply supabase/schema.sql first
 * via the Supabase Dashboard SQL editor if you haven't done so).
 *
 * Usage:
 *   node scripts/seed-profiles.mjs
 *   # or via npm:
 *   npm run seed:profiles
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

const PROFILES = [
  { name: 'Beverley', role: 'colourpix_admin', branch: null, email: 'beverley@colourpix.co.za' },
  { name: 'Francois', role: 'colourpix_admin', branch: null, email: 'francois@colourpix.co.za' },
  { name: 'PSG Head Office', role: 'psg_head_office', branch: null, email: 'head.office@psg.co.za' },
  { name: 'John Smith', role: 'psg_branch_manager', branch: 'PSG Hermanus', email: 'john.smith@psg.co.za' },
  { name: 'ABC Signage', role: 'sign_company', branch: null, email: 'ops@abcsignage.co.za' },
];

async function seedProfiles() {
  console.log('\n── Seeding profiles table ──────────────────────\n');

  const { error } = await adminClient
    .from('profiles')
    .upsert(PROFILES, { onConflict: 'email' });

  if (error) {
    if (error.code === '42P01') {
      console.error('✗ The "profiles" table does not exist.');
      console.error('  Run supabase/schema.sql in the Supabase Dashboard → SQL Editor first.');
    } else {
      console.error('✗ Profiles upsert failed:', error.message);
    }
    return false;
  }

  for (const p of PROFILES) {
    console.log(`  ✓ ${p.email} (${p.role})`);
  }

  console.log('\nProfiles seeded.\n');
  return true;
}

async function fixUserMetadata() {
  console.log('── Fixing auth user_metadata ───────────────────\n');

  const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error('Failed to list auth users:', error.message);
    return;
  }

  for (const profile of PROFILES) {
    const authUser = data.users.find((u) => u.email === profile.email);
    if (!authUser) {
      console.log(`  ↳ ${profile.email} — no auth user (skipped)`);
      continue;
    }

    const metadata = {
      name: profile.name,
      role: profile.role,
      ...(profile.branch ? { branch: profile.branch } : {}),
    };

    const { error: updateErr } = await adminClient.auth.admin.updateUserById(authUser.id, {
      user_metadata: metadata,
    });

    if (updateErr) {
      console.error(`  ✗ ${profile.email} — ${updateErr.message}`);
    } else {
      console.log(`  ✓ ${profile.email} — metadata set to role="${profile.role}" name="${profile.name}"`);
    }
  }

  console.log('\nMetadata update complete.\n');
}

(async () => {
  const profilesOk = await seedProfiles();
  await fixUserMetadata();   // always run — independent of profiles table
  console.log('Done.\n');
})().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
