import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import https from 'node:https';

function loadEnv(filePath) {
  const variables = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    variables[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return variables;
}

function post(path, body, token) {
  return new Promise((resolvePromise, reject) => {
    const payload = JSON.stringify(body);
    const request = https.request({
      hostname: 'api.supabase.com',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        Authorization: `Bearer ${token}`,
      },
    }, (response) => {
      let raw = '';
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => resolvePromise({ status: response.statusCode, body: raw }));
    });
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

const env = { ...loadEnv(resolve('.env.local')), ...process.env };
const supabaseUrl = env.VITE_SUPABASE_URL;
const accessToken = env.SUPABASE_ACCESS_TOKEN;
if (!supabaseUrl || !accessToken) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or SUPABASE_ACCESS_TOKEN. ' +
    'This script uses the Supabase Management API; SUPABASE_SERVICE_ROLE_KEY is not a substitute.'
  );
}

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const sql = readFileSync(resolve('supabase/migrations/20260819000400_rebrand_phase3_files_backfill.sql'), 'utf8');
const result = await post(`/v1/projects/${projectRef}/database/query`, { query: sql }, accessToken);
console.log(`HTTP ${result.status}`);
console.log(result.body);
if (result.status < 200 || result.status >= 300) process.exit(1);
