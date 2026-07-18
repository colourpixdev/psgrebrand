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

const scenarios = [
  {
    label: 'Colourpix admin',
    email: 'francois@colourpix.co.za',
    assertProjects(projects) {
      if (projects.length < 10) {
        throw new Error(`Expected broad admin project access, received ${projects.length}.`);
      }
    },
  },
  {
    label: 'PSG branch manager',
    email: 'john.smith@psg.co.za',
    assertProjects(projects) {
      const outsideBranch = projects.filter((project) => project.branch !== 'PSG Hermanus');
      if (outsideBranch.length > 0) {
        throw new Error(`Branch manager saw unrelated branches: ${outsideBranch.map((project) => project.branch).join(', ')}`);
      }
    },
  },
  {
    label: 'Sign company',
    email: 'ops@abcsignage.co.za',
    assertProjects(projects) {
      const outsideInstaller = projects.filter((project) => project.installer !== 'ABC Signage');
      if (outsideInstaller.length > 0) {
        throw new Error(`Sign company saw unrelated installers: ${outsideInstaller.map((project) => project.installer).join(', ')}`);
      }
    },
  },
];

async function runScenario(scenario) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: signInError } = await client.auth.signInWithPassword({
    email: scenario.email,
    password,
  });

  if (signInError) {
    throw new Error(`${scenario.label} sign-in failed: ${signInError.message}`);
  }

  const { data: projects, error: projectsError } = await client
    .from('projects')
    .select('id, branch, installer')
    .order('updated_at', { ascending: false });

  if (projectsError) {
    throw new Error(`${scenario.label} project query failed: ${projectsError.message}`);
  }

  scenario.assertProjects(projects ?? []);

  const { data: profiles, error: profilesError } = await client
    .from('profiles')
    .select('email, role')
    .order('email', { ascending: true });

  if (profilesError) {
    throw new Error(`${scenario.label} profile query failed: ${profilesError.message}`);
  }

  await client.auth.signOut();

  return {
    label: scenario.label,
    projectCount: projects?.length ?? 0,
    profileCount: profiles?.length ?? 0,
  };
}

const results = [];
for (const scenario of scenarios) {
  results.push(await runScenario(scenario));
}

console.table(results);
console.log('RLS scope smoke test passed.');
