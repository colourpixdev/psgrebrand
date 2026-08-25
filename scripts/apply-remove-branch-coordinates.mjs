import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(scriptDir, '..', '.env.local');

function loadEnv(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    return Object.fromEntries(raw.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#')).map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['\"]|['\"]$/g, '')];
    }));
  } catch {
    return {};
  }
}

const env = { ...loadEnv(envPath), ...process.env };
const supabaseUrl = env.VITE_SUPABASE_URL;
const accessToken = env.SUPABASE_ACCESS_TOKEN;

if (!supabaseUrl || !accessToken) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_ACCESS_TOKEN.');
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({ query: 'alter table if exists public.branches drop column if exists latitude, drop column if exists longitude;' }),
});

if (!response.ok) {
  console.error(`Branch coordinate migration failed (HTTP ${response.status}).`);
  console.error(await response.text());
  process.exit(1);
}

console.log(`Removed branch latitude and longitude from Supabase project ${projectRef}.`);
