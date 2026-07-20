import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(scriptDir, '..', '.env.local');

function loadEnv(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const vars = {};

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const eq = trimmed.indexOf('=');
      if (eq === -1) {
        continue;
      }

      vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }

    return vars;
  } catch {
    return {};
  }
}

function post(path, body, token) {
  return new Promise((resolvePromise, reject) => {
    const data = JSON.stringify(body);
    const request = https.request({
      hostname: 'api.supabase.com',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        Authorization: `Bearer ${token}`,
      },
    }, (response) => {
      let raw = '';
      response.on('data', (chunk) => {
        raw += chunk;
      });
      response.on('end', () => {
        resolvePromise({ status: response.statusCode, body: raw });
      });
    });

    request.on('error', reject);
    request.write(data);
    request.end();
  });
}

const env = { ...loadEnv(envPath), ...process.env };
const supabaseUrl = env.VITE_SUPABASE_URL;
const accessToken = env.SUPABASE_ACCESS_TOKEN;

if (!supabaseUrl || !accessToken) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_ACCESS_TOKEN.');
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const sql = `
alter table public.projects add column if not exists physical_address text;
alter table public.projects add column if not exists latitude double precision;
alter table public.projects add column if not exists longitude double precision;

do $$ begin
  alter table public.projects add constraint projects_latitude_range check (latitude is null or latitude between -90 and 90);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.projects add constraint projects_longitude_range check (longitude is null or longitude between -180 and 180);
exception when duplicate_object then null;
end $$;
`;

console.log(`Applying project location schema to project: ${projectRef}`);
const result = await post(`/v1/projects/${projectRef}/database/query`, { query: sql }, accessToken);

if (result.status === 200 || result.status === 201) {
  console.log('Project location schema applied.');
} else {
  console.error(`Project location schema failed (HTTP ${result.status}):`);
  console.error(result.body);
  process.exit(1);
}