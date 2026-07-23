import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const since = String(args.since ?? '');
const totalGroups = Number(args.total ?? 558);

if (!since) {
  console.error('Missing --since <ISO_TIMESTAMP>');
  process.exit(1);
}

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

const result = await supabase
  .from('projects')
  .select('id', { count: 'exact', head: true })
  .like('id', 'PSGMAIL-%')
  .gte('updated_at', since);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

const processed = Number(result.count ?? 0);
const percent = Math.min(100, Math.max(0, (processed / totalGroups) * 100));

console.log(
  JSON.stringify(
    {
      since,
      totalGroups,
      processed,
      remaining: Math.max(0, totalGroups - processed),
      percent: Number(percent.toFixed(2)),
    },
    null,
    2,
  ),
);
