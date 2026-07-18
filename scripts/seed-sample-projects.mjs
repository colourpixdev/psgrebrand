/**
 * seed-sample-projects.mjs
 * Adds realistic PSG rollout sample data and enriches existing projects with
 * files, tasks, comments, and activity for dashboard/detail testing.
 *
 * Usage:
 *   node scripts/seed-sample-projects.mjs
 *   npm run seed:sample-projects
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

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
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === 'REPLACE_WITH_YOUR_SERVICE_ROLE_SECRET') {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SAMPLE_PROJECTS = [
  {
    id: 'PSG-SAMPLE-CTN-001',
    province: 'Western Cape',
    town: 'Cape Town',
    branch: 'PSG Cape Town Waterfront',
    manager: 'Nadia Jacobs',
    manager_email: 'nadia.jacobs@psg.co.za',
    installer: 'Cape Installers',
    designer: 'Colourpix',
    current_stage: 'Site Survey',
    status: 'in_progress',
    target_date: '09 September',
    installation_date: '18 September',
    completion_date: '20 September',
    updated_at: '2026-07-18T10:40:00Z',
    progress: 28,
    branch_manager_view_only: false,
    notes: 'Waterfront office requires tenant approval before external fascia installation. Internal wayfinding can proceed after survey pack is signed.',
  },
  {
    id: 'PSG-SAMPLE-JHB-002',
    province: 'Gauteng',
    town: 'Johannesburg',
    branch: 'PSG Rosebank Wealth',
    manager: 'Thabo Mokoena',
    manager_email: 'thabo.mokoena@psg.co.za',
    installer: 'Highveld Signage',
    designer: 'Colourpix',
    current_stage: 'Artwork Sent',
    status: 'awaiting_approval',
    target_date: '12 September',
    installation_date: '23 September',
    completion_date: '24 September',
    updated_at: '2026-07-18T09:55:00Z',
    progress: 52,
    branch_manager_view_only: false,
    notes: 'Artwork pack sent to branch and PSG head office. Awaiting confirmation on glass vinyl privacy band height.',
  },
  {
    id: 'PSG-SAMPLE-PTA-003',
    province: 'Gauteng',
    town: 'Pretoria',
    branch: 'PSG Pretoria East Insure',
    manager: 'Elmarie Botha',
    manager_email: 'elmarie.botha@psg.co.za',
    installer: 'Highveld Signage',
    designer: 'Colourpix',
    current_stage: 'Quotation Received',
    status: 'in_progress',
    target_date: '16 September',
    installation_date: '26 September',
    completion_date: '27 September',
    updated_at: '2026-07-17T15:20:00Z',
    progress: 61,
    branch_manager_view_only: false,
    notes: 'Quote received with alternate acrylic option. Branch asked for cost comparison before PO issue.',
  },
  {
    id: 'PSG-SAMPLE-DBN-004',
    province: 'KwaZulu-Natal',
    town: 'Umhlanga',
    branch: 'PSG Umhlanga Ridge',
    manager: 'Priya Naidoo',
    manager_email: 'priya.naidoo@psg.co.za',
    installer: 'Durban Signs',
    designer: 'Colourpix',
    current_stage: 'Installation In Progress',
    status: 'in_progress',
    target_date: '30 August',
    installation_date: '01 September',
    completion_date: '02 September',
    updated_at: '2026-07-18T08:45:00Z',
    progress: 88,
    branch_manager_view_only: false,
    notes: 'Install crew completed reception wall. External blade sign scheduled for early morning access window.',
  },
  {
    id: 'PSG-SAMPLE-BFN-005',
    province: 'Free State',
    town: 'Bloemfontein',
    branch: 'PSG Bloemfontein',
    manager: 'Anika Pretorius',
    manager_email: 'anika.pretorius@psg.co.za',
    installer: 'Central Signs',
    designer: 'Colourpix',
    current_stage: 'Awaiting Information',
    status: 'delayed',
    target_date: '05 September',
    installation_date: 'TBC',
    completion_date: 'TBC',
    updated_at: '2026-07-16T13:10:00Z',
    progress: 18,
    branch_manager_view_only: false,
    notes: 'Landlord drawings are still outstanding. Delay escalated to PSG head office for lease document follow-up.',
  },
  {
    id: 'PSG-SAMPLE-EL-006',
    province: 'Eastern Cape',
    town: 'East London',
    branch: 'PSG East London',
    manager: 'Sipho Gqirana',
    manager_email: 'sipho.gqirana@psg.co.za',
    installer: 'Coastal Brand Works',
    designer: 'Colourpix',
    current_stage: 'PO Issued',
    status: 'in_progress',
    target_date: '10 September',
    installation_date: '17 September',
    completion_date: '18 September',
    updated_at: '2026-07-15T16:30:00Z',
    progress: 68,
    branch_manager_view_only: false,
    notes: 'PO issued and production slot held. Installer requested updated parking access instructions.',
  },
  {
    id: 'PSG-SAMPLE-WHK-007',
    province: 'Namibia',
    town: 'Windhoek',
    branch: 'PSG Windhoek Wealth',
    manager: 'Petra Haak',
    manager_email: 'petra.haak@psg.co.na',
    installer: 'Namibia Install Co',
    designer: 'Colourpix',
    current_stage: 'Approved',
    status: 'in_progress',
    target_date: '14 September',
    installation_date: '21 September',
    completion_date: '22 September',
    updated_at: '2026-07-18T07:35:00Z',
    progress: 73,
    branch_manager_view_only: false,
    notes: 'Cross-border artwork pack approved. Production team confirmed material availability for Namibia shipment.',
  },
  {
    id: 'PSG-SAMPLE-WVB-008',
    province: 'Namibia',
    town: 'Walvis Bay',
    branch: 'PSG Walvis Bay',
    manager: 'Johan Brand',
    manager_email: 'johan.brand@psg.co.na',
    installer: 'Namibia Install Co',
    designer: 'Colourpix',
    current_stage: 'Measurements Received',
    status: 'in_progress',
    target_date: '18 September',
    installation_date: '27 September',
    completion_date: '28 September',
    updated_at: '2026-07-17T11:05:00Z',
    progress: 46,
    branch_manager_view_only: false,
    notes: 'Measurements received from coastal installer. Artwork needs additional corrosion-resistant fixing note for exterior signage.',
  },
  {
    id: 'PSG-SAMPLE-PLK-009',
    province: 'Limpopo',
    town: 'Polokwane',
    branch: 'PSG Polokwane',
    manager: 'Lerato Molefe',
    manager_email: 'lerato.molefe@psg.co.za',
    installer: 'Northern Signs',
    designer: 'Colourpix',
    current_stage: 'Client Signoff',
    status: 'awaiting_approval',
    target_date: '28 August',
    installation_date: '30 August',
    completion_date: '31 August',
    updated_at: '2026-07-18T06:50:00Z',
    progress: 96,
    branch_manager_view_only: false,
    notes: 'Final photos uploaded. Waiting for branch manager signoff on reception sign alignment.',
  },
  {
    id: 'PSG-SAMPLE-MBK-010',
    province: 'Mpumalanga',
    town: 'Mbombela',
    branch: 'PSG Mbombela',
    manager: 'Monique Kruger',
    manager_email: 'monique.kruger@psg.co.za',
    installer: 'Lowveld Sign Studio',
    designer: 'Colourpix',
    current_stage: 'Completed',
    status: 'completed',
    target_date: '22 August',
    installation_date: '24 August',
    completion_date: '25 August',
    updated_at: '2026-07-14T14:25:00Z',
    progress: 100,
    branch_manager_view_only: false,
    notes: 'Completed with signed handover pack, final photos, and branch manager approval archived.',
  },
];

const TASKS_BY_STAGE = {
  'New Project': ['Confirm branch contacts', 'Request landlord signage rules', 'Open site survey ticket'],
  'Awaiting Information': ['Follow up landlord drawings', 'Request storefront photos', 'Escalate missing measurements'],
  'Site Survey': ['Confirm survey appointment', 'Upload site photos', 'Capture fascia dimensions'],
  'Measurements Received': ['Check measurements against artwork brief', 'Prepare artwork layout', 'Confirm material specification'],
  'Artwork In Progress': ['Complete artwork pack', 'Send internal design review', 'Prepare approval email'],
  'Artwork Sent': ['Chase branch artwork approval', 'Capture requested changes', 'Update approval tracker'],
  'Awaiting Approval': ['Follow up PSG signoff', 'Confirm branch manager approval', 'Hold production slot'],
  Approved: ['Release pack to production', 'Confirm installation window', 'Send installer job card'],
  'Quotation Requested': ['Request installer quote', 'Attach survey pack', 'Confirm access requirements'],
  'Quotation Received': ['Review installer quote', 'Request PO approval', 'Update project costing'],
  'PO Issued': ['Confirm PO with installer', 'Book production slot', 'Send installation checklist'],
  Production: ['Track print production', 'Confirm dispatch date', 'Prepare delivery note'],
  'Installation Scheduled': ['Confirm installer crew', 'Notify branch of access time', 'Prepare photo checklist'],
  'Installation In Progress': ['Monitor installation progress', 'Request same-day photos', 'Log snag list'],
  Installed: ['Upload completion photos', 'Request manager signoff', 'Check signage placement'],
  'Photos Uploaded': ['Review photo pack', 'Confirm no snags', 'Prepare closeout note'],
  'Client Signoff': ['Chase final signoff', 'Archive handover pack', 'Send completion report'],
  Completed: ['Archive project folder', 'Send completion report', 'Update rollout dashboard'],
  'On Hold': ['Confirm restart date', 'Document hold reason', 'Escalate blocker'],
  Delayed: ['Escalate delay owner', 'Update branch ETA', 'Rebook installer'],
  Cancelled: ['Archive cancelled record', 'Notify stakeholders', 'Close open tasks'],
};

function uniq(items) {
  return [...new Set(items.filter(Boolean))];
}

function mergeByKey(existingItems, sampleItems, keyForItem) {
  const itemsByKey = new Map();

  for (const item of [...sampleItems, ...existingItems]) {
    itemsByKey.set(keyForItem(item), item);
  }

  return [...itemsByKey.values()];
}

function sampleFiles(project) {
  return uniq([
    '01-Site-Survey.pdf',
    '02-Measurements.xlsx',
    '03-Artwork-Pack.pdf',
    '04-Installer-Quote.pdf',
    '05-Purchase-Order.pdf',
    '06-Installation-Photos.zip',
    '07-Branch-Signoff.pdf',
    `${project.id}-handover-notes.docx`,
  ]);
}

function sampleComments(project) {
  return [
    {
      date: '12 July',
      author: 'Colourpix',
      message: `Opened rollout record for ${project.branch}. Initial site information and brand requirements captured.`,
    },
    {
      date: '15 July',
      author: project.manager,
      message: `Branch contact confirmed. Please keep installation outside client meeting hours where possible.`,
    },
    {
      date: '17 July',
      author: project.installer,
      message: `Survey pack reviewed. Access notes and parking instructions have been added to the job card.`,
    },
    {
      date: '18 July',
      author: 'PSG Head Office',
      message: `Status reviewed for ${project.town}. Keep the dashboard updated before the next rollout stand-up.`,
    },
  ];
}

function sampleActivity(project) {
  const activityType = project.status === 'delayed' || project.status === 'on_hold' ? 'warning' : project.status === 'completed' ? 'success' : 'info';
  return [
    {
      date: 'Today',
      title: `${project.current_stage} update`,
      detail: `${project.branch} is ${project.progress}% complete with ${project.installer} assigned.`,
      type: activityType,
    },
    {
      date: 'Yesterday',
      title: 'Interaction logged',
      detail: `${project.manager} added branch feedback for ${project.town}.`,
      type: 'info',
    },
    {
      date: '16 July',
      title: 'Files updated',
      detail: `Latest survey, quote, and artwork files were attached to ${project.id}.`,
      type: 'success',
    },
  ];
}

function enrichProject(project) {
  const stageTasks = TASKS_BY_STAGE[project.current_stage] ?? ['Review project status', 'Update next action', 'Notify stakeholders'];
  const comments = mergeByKey(project.comments ?? [], sampleComments(project), (comment) => `${comment.date}|${comment.author}|${comment.message}`);
  const activity = mergeByKey(project.activity ?? [], sampleActivity(project), (item) => `${item.date}|${item.title}|${item.detail}`);

  return {
    ...project,
    files: uniq([...(project.files ?? []), ...sampleFiles(project)]),
    tasks: uniq([...(project.tasks ?? []), ...stageTasks]),
    comments: comments.slice(-8),
    activity: activity.slice(0, 8),
  };
}

async function fetchExistingProjects() {
  const { data, error } = await adminClient.from('projects').select('*').order('updated_at', { ascending: false });

  if (error) {
    console.error('Could not read existing projects:', error.message);
    process.exit(1);
  }

  return data ?? [];
}

async function seedSampleProjects() {
  console.log('\n-- Seeding sample project data ------------------\n');

  const existingProjects = await fetchExistingProjects();
  const existingIds = new Set(existingProjects.map((project) => project.id));
  const projectsToCreate = SAMPLE_PROJECTS.filter((project) => !existingIds.has(project.id)).map(enrichProject);
  const projectsToUpdate = existingProjects.map(enrichProject);

  if (projectsToCreate.length > 0) {
    const { error } = await adminClient.from('projects').insert(projectsToCreate);

    if (error) {
      console.error('Sample project insert failed:', error.message);
      process.exit(1);
    }
  }

  if (projectsToUpdate.length > 0) {
    const { error } = await adminClient.from('projects').upsert(projectsToUpdate, { onConflict: 'id' });

    if (error) {
      console.error('Existing project enrichment failed:', error.message);
      process.exit(1);
    }
  }

  const { count, error: countError } = await adminClient.from('projects').select('id', { count: 'exact', head: true });

  if (countError) {
    console.error('Could not count projects after seeding:', countError.message);
    process.exit(1);
  }

  console.log(`Created ${projectsToCreate.length} new sample projects.`);
  console.log(`Enriched ${projectsToUpdate.length} existing projects.`);
  console.log(`Total projects now: ${count ?? 'unknown'}.\n`);
}

seedSampleProjects().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});