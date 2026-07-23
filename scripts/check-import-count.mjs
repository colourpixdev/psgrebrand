import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const root = resolve(process.cwd());
const envRaw = readFileSync(resolve(root, '.env.local'), 'utf8');
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const i = t.indexOf('=');
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const result = await supabase.from('projects').select('id', { count: 'exact', head: true }).like('id', 'PSGMAIL-%');

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

console.log(`PSGMAIL projects: ${result.count ?? 0}`);
