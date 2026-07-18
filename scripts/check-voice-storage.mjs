import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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

const env = { ...loadEnv(envPath), ...process.env };
const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const password = env.RLS_TEST_PASSWORD || 'Rebrand2026!';

if (!supabaseUrl || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.');
  process.exit(1);
}

async function uploadAs(email) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !signInData.user) {
    throw new Error(`${email} sign-in failed: ${signInError?.message ?? 'No user returned.'}`);
  }

  const path = `${signInData.user.id}/${Date.now()}-policy-test.webm`;
  const audio = new Blob([new Uint8Array([26, 69, 223, 163])], { type: 'audio/webm' });
  const { error } = await client.storage.from('voice-updates').upload(path, audio, { contentType: 'audio/webm' });

  if (!error) {
    await client.storage.from('voice-updates').remove([path]);
  }

  await client.auth.signOut();

  return {
    email,
    ok: !error,
    error: error?.message ?? null,
  };
}

const admin = await uploadAs('francois@colourpix.co.za');
const signCompany = await uploadAs('ops@abcsignage.co.za');

if (!admin.ok) {
  throw new Error(`Expected admin voice upload to work: ${admin.error}`);
}

if (signCompany.ok) {
  throw new Error('Expected sign company voice upload to be blocked.');
}

console.table([admin, signCompany]);
console.log('Voice storage policy smoke test passed.');
