import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '..', '.env.local');

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
        try {
          resolvePromise({ status: response.statusCode, body: JSON.parse(raw) });
        } catch {
          resolvePromise({ status: response.statusCode, body: raw });
        }
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
const placeholderTokens = new Set(['your_pat_here', 'REPLACE_WITH_YOUR_PAT', 'your-token-here']);

if (!supabaseUrl) {
  console.error('Missing VITE_SUPABASE_URL in .env.local.');
  process.exit(1);
}

if (!accessToken || placeholderTokens.has(accessToken)) {
  console.error('Missing SUPABASE_ACCESS_TOKEN in .env.local or process environment.');
  console.error('Create a Supabase Personal Access Token, set SUPABASE_ACCESS_TOKEN, then re-run npm run apply:rls.');
  process.exit(1);
}

if (!/^sbp_[a-f0-9]{40}$/.test(accessToken)) {
  console.error('SUPABASE_ACCESS_TOKEN does not look like a Supabase Personal Access Token.');
  console.error(`The saved value starts with ${accessToken.slice(0, 4)} and is ${accessToken.length} characters long.`);
  console.error('Classic Supabase tokens should look like sbp_ followed by 40 lowercase hexadecimal characters.');
  console.error('Use a token from https://supabase.com/dashboard/account/tokens, not the anon key, service-role key, or project JWT secret.');
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const sql = readFileSync(resolve(__dir, '..', 'supabase', 'repair-live-database.sql'), 'utf8');

console.log(`Applying RLS hardening to project: ${projectRef}`);
const result = await post(`/v1/projects/${projectRef}/database/query`, { query: sql }, accessToken);
const resultText = typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2);
const responseBodyHasError = Boolean(
  result.body &&
  typeof result.body === 'object' &&
  ('error' in result.body || 'message' in result.body || 'code' in result.body) &&
  !('result' in result.body),
);

if ((result.status === 200 || result.status === 201) && !responseBodyHasError) {
  console.log('RLS hardening applied. Run npm run check:rls to verify role scoping.');
} else {
  console.error(`RLS hardening failed (HTTP ${result.status}):`);
  console.error(resultText);
  process.exit(1);
}
