import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(path) {
  const env = {};
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

async function listAllStoragePaths(supabase, bucket, prefix) {
  const paths = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) break;
    if (!data || data.length === 0) break;

    for (const item of data) {
      if (!item?.name) continue;
      paths.push(`${prefix}/${item.name}`);
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return paths;
}

const root = resolve(process.cwd());
const env = { ...loadEnv(resolve(root, '.env.local')), ...process.env };
const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const q1 = await supabase.from('projects').select('id,notes,files').like('id', 'PSGMAIL-%');
if (q1.error) throw q1.error;

const q2 = await supabase
  .from('projects')
  .select('id,notes,files')
  .ilike('notes', 'Imported from Beverley PST email set.%');
if (q2.error) throw q2.error;

const projectMap = new Map();
for (const row of [...(q1.data ?? []), ...(q2.data ?? [])]) {
  if (row?.id) projectMap.set(row.id, row);
}

const projects = [...projectMap.values()];
console.log(`Found imported projects to rollback: ${projects.length}`);

const bucket = 'project-files';
let storageDeleteCount = 0;
let projectDeleteCount = 0;

for (const p of projects) {
  const storagePaths = new Set();

  for (const item of Array.isArray(p.files) ? p.files : []) {
    if (item?.path && typeof item.path === 'string') {
      storagePaths.add(item.path);
    }
  }

  const prefix = `${p.id}/email-import`;
  const listed = await listAllStoragePaths(supabase, bucket, prefix);
  for (const path of listed) storagePaths.add(path);

  const allPaths = [...storagePaths];
  for (let i = 0; i < allPaths.length; i += 100) {
    const chunk = allPaths.slice(i, i + 100);
    if (chunk.length === 0) continue;
    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (!error) storageDeleteCount += chunk.length;
  }

  const { error: delErr } = await supabase.from('projects').delete().eq('id', p.id);
  if (!delErr) projectDeleteCount += 1;
}

const remain1 = await supabase.from('projects').select('id', { count: 'exact', head: true }).like('id', 'PSGMAIL-%');
if (remain1.error) throw remain1.error;

const remain2 = await supabase
  .from('projects')
  .select('id', { count: 'exact', head: true })
  .ilike('notes', 'Imported from Beverley PST email set.%');
if (remain2.error) throw remain2.error;

console.log(`Deleted projects: ${projectDeleteCount}`);
console.log(`Deleted storage objects (attempted): ${storageDeleteCount}`);
console.log(`Remaining PSGMAIL projects: ${remain1.count ?? 0}`);
console.log(`Remaining note-tagged projects: ${remain2.count ?? 0}`);
