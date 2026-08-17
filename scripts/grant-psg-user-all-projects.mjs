/**
 * grant-psg-user-all-projects.mjs
 * Grants psg@psg.co.za permission to view all projects while keeping other restrictions
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

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables.');
  console.error('  VITE_SUPABASE_URL          :', supabaseUrl ? '✓' : '✗ missing');
  console.error('  SUPABASE_SERVICE_ROLE_KEY  :', serviceRoleKey ? '✓' : '✗ missing');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function grantPermission() {
  console.log('\n── Granting psg@psg.co.za view-all-projects permission ──────────────────────\n');

  const { data, error } = await adminClient
    .from('profiles')
    .update({
      permission_overrides: {
        'projectAccess.canViewAllProjects': true,
      },
    })
    .eq('email', 'psg@psg.co.za');

  if (error) {
    console.error('✗ Failed to update permissions:', error.message);
    process.exit(1);
  }

  console.log('✓ psg@psg.co.za now has permission to view all projects');
  console.log('  - Still cannot edit, create, or delete projects');
  console.log('  - Still cannot add comments or create tasks');
  console.log('  - Can only download and export files\n');
}

grantPermission().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
