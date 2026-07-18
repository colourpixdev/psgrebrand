/**
 * apply-profiles-schema.mjs
 * Applies the profiles table DDL + seed data via the Supabase Management API.
 * Requires a Supabase Personal Access Token (PAT).
 *
 * Get your PAT from: https://supabase.com/dashboard/account/tokens
 * Then add to .env.local:
 *   SUPABASE_ACCESS_TOKEN=your_pat_here
 *
 * Usage:
 *   node scripts/apply-profiles-schema.mjs
 *   # or via npm:
 *   npm run apply:profiles
 */

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
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      vars[key] = val;
    }
    return vars;
  } catch {
    return {};
  }
}

const env = { ...loadEnv(envPath), ...process.env };
const supabaseUrl = env.VITE_SUPABASE_URL;
const accessToken = env.SUPABASE_ACCESS_TOKEN;

if (!accessToken || accessToken === 'REPLACE_WITH_YOUR_PAT') {
  console.error('\nMissing SUPABASE_ACCESS_TOKEN in .env.local.');
  console.error('Get your Personal Access Token from:');
  console.error('  https://supabase.com/dashboard/account/tokens\n');
  console.error('Then add to .env.local:');
  console.error('  SUPABASE_ACCESS_TOKEN=your_pat_here\n');
  console.error('Alternatively, run supabase/create-profiles.sql manually in the Supabase SQL Editor.\n');
  process.exit(1);
}

// Extract project ref from URL  (https://plqrjfylolaukazldnuz.supabase.co → plqrjfylolaukazldnuz)
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];

const sql = readFileSync(resolve(__dir, '..', 'supabase', 'create-profiles.sql'), 'utf8');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'api.supabase.com',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        Authorization: `Bearer ${token}`,
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  console.log(`\nApplying profiles schema to project: ${projectRef}\n`);

  const result = await post(
    `/v1/projects/${projectRef}/database/query`,
    { query: sql },
    accessToken,
  );

  if (result.status === 200 || result.status === 201) {
    console.log('✓ Profiles table created and seeded successfully.\n');
    console.log('You can now run: npm run seed:profiles\n');
  } else {
    console.error(`✗ Request failed (HTTP ${result.status}):`);
    console.error(JSON.stringify(result.body, null, 2));
    console.error('\nFallback: run supabase/create-profiles.sql in the Supabase SQL Editor.\n');
  }
})().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
