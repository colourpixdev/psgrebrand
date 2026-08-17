/**
 * update-profiles-role-constraint.mjs
 * Updates the profiles table check constraint to include psg_user role
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

async function updateConstraint() {
  console.log('\n── Updating profiles table constraint ──────────────────────\n');

  // Drop the old constraint and recreate it with psg_user
  const { error } = await adminClient.rpc('exec_sql', {
    sql: `
      DO $$ BEGIN
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
          CHECK (role IN ('colourpix_admin', 'psg_head_office', 'psg_branch_manager', 'psg_user', 'sign_company'));
      END $$;
    `
  }).catch(err => {
    // If exec_sql doesn't exist, try direct query
    return adminClient.from('profiles').select('id').limit(1);
  });

  if (error) {
    console.error('✗ Error updating constraint:', error.message);
    // Try alternative method using raw SQL
    console.log('\nAttempting alternative method...');
    try {
      const result = await adminClient.rpc('exec_raw', {
        statement: `
          ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
          ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
            CHECK (role IN ('colourpix_admin', 'psg_head_office', 'psg_branch_manager', 'psg_user', 'sign_company'));
        `
      });
      console.error('Alternative method also failed:', result.error);
      console.log('\n⚠️  Manual update required:');
      console.log('   Run this in Supabase Dashboard → SQL Editor:');
      console.log(`
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
          CHECK (role IN ('colourpix_admin', 'psg_head_office', 'psg_branch_manager', 'psg_user', 'sign_company'));
      `);
    } catch (innerErr) {
      console.error('Inner error:', innerErr.message);
    }
    return;
  }

  console.log('✓ Constraint updated successfully');
  console.log('✓ You can now run: npm run seed:profiles\n');
}

updateConstraint().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
