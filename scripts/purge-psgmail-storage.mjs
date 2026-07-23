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

async function listAll(supabase, bucket, prefix = '') {
  const out = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) throw error;
    if (!data || data.length === 0) break;

    out.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }

  return out;
}

async function gatherFiles(supabase, bucket, prefix) {
  const entries = await listAll(supabase, bucket, prefix);
  const files = [];

  for (const entry of entries) {
    if (!entry?.name) continue;
    const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) {
      files.push(entryPath);
    } else {
      const nested = await gatherFiles(supabase, bucket, entryPath);
      files.push(...nested);
    }
  }

  return files;
}

const root = resolve(process.cwd());
const env = { ...loadEnv(resolve(root, '.env.local')), ...process.env };
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const bucket = 'project-files';
const topLevel = await listAll(supabase, bucket, '');
const psgmailPrefixes = topLevel
  .map((e) => e?.name)
  .filter((name) => typeof name === 'string' && name.startsWith('PSGMAIL-'));

let totalFiles = 0;
let deletedFiles = 0;

for (const prefix of psgmailPrefixes) {
  const files = await gatherFiles(supabase, bucket, prefix);
  totalFiles += files.length;

  for (let i = 0; i < files.length; i += 100) {
    const chunk = files.slice(i, i + 100);
    if (chunk.length === 0) continue;
    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (error) {
      console.error(`Delete error for chunk under ${prefix}: ${error.message}`);
      continue;
    }
    deletedFiles += chunk.length;
  }
}

console.log(`PSGMAIL prefixes found: ${psgmailPrefixes.length}`);
console.log(`PSGMAIL files found: ${totalFiles}`);
console.log(`PSGMAIL files deleted: ${deletedFiles}`);
