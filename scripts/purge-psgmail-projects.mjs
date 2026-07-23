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

const root = resolve(process.cwd());
const env = { ...loadEnv(resolve(root, '.env.local')), ...process.env };
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const before = await supabase.from('projects').select('id', { count: 'exact', head: true }).like('id', 'PSGMAIL-%');
if (before.error) throw before.error;

const del = await supabase.from('projects').delete().like('id', 'PSGMAIL-%');
if (del.error) throw del.error;

const after = await supabase.from('projects').select('id', { count: 'exact', head: true }).like('id', 'PSGMAIL-%');
if (after.error) throw after.error;

console.log(`Before: ${before.count ?? 0}`);
console.log(`After: ${after.count ?? 0}`);
