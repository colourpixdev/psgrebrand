/**
 * fix-project-id.mjs
 * Fixes the malformed project ID in Supabase
 * Changes 'PSG Jan Kemp Dorp Wealth' to 'PSG001P1'
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
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fixProjectId() {
  console.log('Looking for project with malformed ID...\n');

  // Find project with "Jan Kemp" in the ID
  const { data: projects, error: findError } = await adminClient
    .from('projects')
    .select('id, branch, branch_id')
    .ilike('id', '%Jan%');

  if (findError) {
    console.error('✗ Error finding project:', findError.message);
    return false;
  }

  if (!projects || projects.length === 0) {
    console.log('✓ No projects with malformed IDs found');
    return true;
  }

  const project = projects[0];
  const oldId = project.id;
  const newId = 'PSG001P1';

  console.log(`Found project:`);
  console.log(`  Old ID: ${oldId}`);
  console.log(`  Branch: ${project.branch}`);
  console.log(`  Branch ID: ${project.branch_id}\n`);

  console.log(`Updating to new ID: ${newId}...\n`);

  // Update the project ID
  const { error: updateError } = await adminClient
    .from('projects')
    .update({ id: newId })
    .eq('id', oldId);

  if (updateError) {
    console.error('✗ Error updating project:', updateError.message);
    return false;
  }

  console.log(`✓ Project ID updated successfully`);
  console.log(`  ${oldId} → ${newId}`);
  return true;
}

fixProjectId().then(success => {
  process.exit(success ? 0 : 1);
});
