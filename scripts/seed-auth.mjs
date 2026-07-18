/**
 * seed-auth.mjs
 * Creates Supabase Auth users for every seeded profile so that
 * email/password sign-in works out of the box.
 *
 * Requirements:
 *   VITE_SUPABASE_URL       — your project URL (already in .env.local)
 *   SUPABASE_SERVICE_ROLE_KEY — service role secret from
 *                               Supabase Dashboard → Project Settings → API
 *
 * Usage:
 *   node scripts/seed-auth.mjs
 *   # or via npm:
 *   npm run seed:auth
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Load env from .env.local (Vite convention)
// ---------------------------------------------------------------------------
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

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables.');
  console.error('  VITE_SUPABASE_URL          :', supabaseUrl ? '✓' : '✗ missing');
  console.error('  SUPABASE_SERVICE_ROLE_KEY  :', serviceRoleKey ? '✓' : '✗ missing');
  console.error('\nAdd SUPABASE_SERVICE_ROLE_KEY to .env.local and re-run.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Admin client — never expose service role key in the browser
// ---------------------------------------------------------------------------
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Seed users
// Each user gets user_metadata so sessionToUser() resolves the right role.
// Default password: Rebrand2026! — change after first login.
// ---------------------------------------------------------------------------
const DEFAULT_PASSWORD = 'Rebrand2026!';

const SEED_USERS = [
  {
    email: 'beverley@colourpix.co.za',
    user_metadata: { name: 'Beverley', role: 'colourpix_admin' },
  },
  {
    email: 'francois@colourpix.co.za',
    user_metadata: { name: 'Francois', role: 'colourpix_admin' },
  },
  {
    email: 'head.office@psg.co.za',
    user_metadata: { name: 'PSG Head Office', role: 'psg_head_office' },
  },
  {
    email: 'john.smith@psg.co.za',
    user_metadata: { name: 'John Smith', role: 'psg_branch_manager', branch: 'PSG Hermanus' },
  },
  {
    email: 'ops@abcsignage.co.za',
    user_metadata: { name: 'ABC Signage', role: 'sign_company' },
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function seedAuthUsers() {
  console.log(`\nSeeding ${SEED_USERS.length} Supabase Auth users…\n`);

  for (const seed of SEED_USERS) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: seed.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,           // skip the confirmation email step
      user_metadata: seed.user_metadata,
    });

    if (error) {
      if (error.message?.toLowerCase().includes('already been registered') ||
          error.code === 'email_exists') {
        console.log(`  ↳ ${seed.email} — already exists (skipped)`);
      } else {
        console.error(`  ✗ ${seed.email} — ${error.message}`);
      }
    } else {
      console.log(`  ✓ ${seed.email} — created (id: ${data.user.id})`);
    }
  }

  console.log(`\nDone. Default password for all new accounts: ${DEFAULT_PASSWORD}`);
  console.log('Users should change their password after first login.\n');
}

seedAuthUsers().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
