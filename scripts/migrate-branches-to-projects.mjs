/**
 * migrate-branches-to-projects.mjs
 *
 * - Backs up all rows from `branches` to `scripts/backups/branches-<timestamp>.json`.
 * - For each branch that does not already have a linked project, creates a new project record
 *   with `id` = `branch-<branch.id>` and copies key fields (branch_id, branch, location, contact).
 * - Writes a migration log to `scripts/backups/migration-log-<timestamp>.json` containing created project ids.
 *
 * Usage (dry-run):
 *   node scripts/migrate-branches-to-projects.mjs --dry
 *
 * To run against Supabase you must set `.env.local` with `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
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
      const val = trimmed.slice(eq + 1).trim().replace(/^\"|\"$/g, '');
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

const args = process.argv.slice(2);
const dryRun = args.includes('--dry') || args.includes('-n');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local or environment variables.');
  console.error('Create .env.local with the required keys before running this script.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function backupBranches() {
  console.log('Fetching branches...');
  const { data, error } = await supabase.from('branches').select('*');
  if (error) throw error;
  const outDir = resolve(__dir, 'backups');
  mkdirSync(outDir, { recursive: true });
  const file = resolve(outDir, `branches-${timestamp()}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Saved ${data.length} branches to ${file}`);
  return { data, backupFile: file };
}

async function projectExistsForBranch(branch) {
  // check by branch_id or branch name match
  const branchId = branch.id;
  const branchName = branch.name;
  const { data, error } = await supabase.from('projects').select('id').or(`branch_id.eq.${branchId},branch.eq.${encodeURIComponent(branchName)}`);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

async function createProjectFromBranch(branch) {
  const projectId = `branch-${branch.id}`;
  const payload = {
    id: projectId,
    branch_id: branch.id,
    branch: branch.name,
    project_type: 'branch_as_project',
    project_type_name: 'Branch as Project',
    site_label: branch.name,
    province: branch.province ?? null,
    town: branch.town ?? null,
    physical_address: branch.physicalAddress ?? branch.physical_address ?? null,
    latitude: typeof branch.latitude === 'number' ? branch.latitude : null,
    longitude: typeof branch.longitude === 'number' ? branch.longitude : null,
    manager: branch.contactName ?? branch.contact_name ?? 'Not captured',
    manager_email: branch.contactEmail ?? branch.contact_email ?? '',
    installer: 'Not captured',
    designer: 'Not captured',
    current_stage: 'Branch setup',
    status: 'in_progress',
    progress: 0,
    target_date: '',
    installation_date: '',
    completion_date: '',
    updated_at: new Date().toISOString(),
    notes: `Created from branch migration (branch id: ${branch.id})`,
    activity: [{ date: new Date().toISOString().slice(0, 10), title: 'Migration', detail: `Created project for branch ${branch.name} (${branch.id})`, type: 'info' }],
  };

  if (dryRun) {
    return { id: projectId, payload };
  }

  const { data, error } = await supabase.from('projects').insert([payload]).select('id');
  if (error) throw error;
  return { id: data?.[0]?.id ?? projectId };
}

async function run() {
  console.log(`Starting branch→project migration (dryRun=${dryRun})`);

  const { data: branches, backupFile } = await backupBranches();

  const outDir = resolve(__dir, 'backups');
  const migrationLog = { created: [], skipped: [], backup: backupFile, timestamp: new Date().toISOString() };

  for (const branch of branches) {
    try {
      const exists = await projectExistsForBranch(branch);
      if (exists) {
        migrationLog.skipped.push({ branchId: branch.id, reason: 'project already exists' });
        console.log(`Skipping branch ${branch.id} — project already exists`);
        continue;
      }

      const result = await createProjectFromBranch(branch);
      migrationLog.created.push({ branchId: branch.id, projectId: result.id });
      console.log(`Created project ${result.id} for branch ${branch.id}`);
    } catch (err) {
      console.error(`Failed to migrate branch ${branch.id}:`, err instanceof Error ? err.message : err);
      migrationLog.skipped.push({ branchId: branch.id, reason: String(err) });
    }
  }

  const logFile = resolve(outDir, `migration-log-${timestamp()}.json`);
  writeFileSync(logFile, JSON.stringify(migrationLog, null, 2), 'utf8');
  console.log(`Migration complete. Log written to ${logFile}`);
  console.log(`Created ${migrationLog.created.length}, skipped ${migrationLog.skipped.length}`);
}

run().catch((err) => {
  console.error('Migration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
