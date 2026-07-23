import { appendFileSync, readFileSync } from 'fs';
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

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const args = parseArgs(process.argv);
const since = String(args.since ?? '');
const totalGroups = Number(args.total ?? 558);
const importerPid = Number(args.pid ?? 0);
const intervalMs = Number(args.intervalMs ?? 60000);
const outPath = resolve(process.cwd(), 'artifacts', 'pst_extract', 'import-progress.log');

if (!since || !importerPid || Number.isNaN(importerPid)) {
  console.error('Usage: node scripts/monitor-import-progress.mjs --since <ISO> --pid <number> [--total 558] [--intervalMs 60000]');
  process.exit(1);
}

const envRaw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
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

async function capture() {
  const result = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .like('id', 'PSGMAIL-%')
    .gte('updated_at', since);

  if (result.error) {
    const line = `${new Date().toISOString()} | error | ${result.error.message}\n`;
    appendFileSync(outPath, line, 'utf8');
    console.log(line.trim());
    return;
  }

  const processed = Number(result.count ?? 0);
  const percent = Math.min(100, Math.max(0, (processed / totalGroups) * 100));
  const line = `${new Date().toISOString()} | processed=${processed}/${totalGroups} | percent=${percent.toFixed(2)}\n`;
  appendFileSync(outPath, line, 'utf8');
  console.log(line.trim());
}

(async () => {
  appendFileSync(outPath, `\n=== Monitor started ${new Date().toISOString()} pid=${importerPid} since=${since} ===\n`, 'utf8');
  await capture();

  const timer = setInterval(async () => {
    if (!pidAlive(importerPid)) {
      await capture();
      appendFileSync(outPath, `=== Monitor stopped ${new Date().toISOString()} (importer exited) ===\n`, 'utf8');
      clearInterval(timer);
      process.exit(0);
    }
    await capture();
  }, intervalMs);
})();
