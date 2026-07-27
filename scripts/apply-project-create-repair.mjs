import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(scriptDir, '..', '.env.local');

function loadEnv(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const variables = {};

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }

      variables[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
    }

    return variables;
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
alter table public.projects add column if not exists branch text;
alter table public.projects alter column branch drop not null;

select column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'projects'
  and column_name in ('branch', 'branch_id')
order by column_name;
`;

console.log(`Repairing project create schema for project: ${projectRef}`);
const result = await post(`/v1/projects/${projectRef}/database/query`, { query: sql }, accessToken);

if (result.status === 200 || result.status === 201) {
  console.log('Project create schema repaired.');
  console.log(result.body);
} else {
  console.error(`Project create schema repair failed (HTTP ${result.status}):`);
  console.error(result.body);
  process.exit(1);
}