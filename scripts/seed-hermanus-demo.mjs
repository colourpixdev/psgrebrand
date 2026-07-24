import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '..', '.env.local');
const projectId = 'PSG-HERMANUS-DEMO-001';

function loadEnv(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    return raw.split('\n').reduce((values, line) => {
      const trimmed = line.trim();
      const separator = trimmed.indexOf('=');
      if (!trimmed || trimmed.startsWith('#') || separator === -1) return values;
      values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
      return values;
    }, {});
  } catch {
    return {};
  }
}

const env = { ...loadEnv(envPath), ...process.env };
if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.');
}

const adminClient = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const demoFiles = [
  ['01-Site-Survey-Hermanus.pdf', 'application/pdf'],
  ['02-Measurement-Schedule-Hermanus.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['03-Branding-Proof-Rev-A.pdf', 'application/pdf'],
  ['04-Installer-Quotation.pdf', 'application/pdf'],
];

function fileBody(fileName) {
  return `PSG Rebrand demonstration file\nProject: ${projectId}\nFile: ${fileName}\n\nThis placeholder exists so the Hermanus report and file trail can be reviewed end to end.`;
}

async function uploadDemoFiles() {
  const files = [];
  for (const [name, type] of demoFiles) {
    const path = `${projectId}/${name}`;
    const content = new Blob([fileBody(name)], { type });
    const { error } = await adminClient.storage.from('project-files').upload(path, content, {
      cacheControl: '3600',
      contentType: type,
      upsert: true,
    });

    if (error) throw new Error(`Could not upload ${name}: ${error.message}`);
    files.push({ name, path, size: content.size, type, uploadedAt: '2026-07-24T09:45:00Z' });
  }
  return files;
}

async function saveProject(project) {
  const payload = { ...project };

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { error } = await adminClient.from('projects').upsert(payload, { onConflict: 'id' });
    if (!error) return;

    const missingColumn = error.message.match(/Could not find the '([^']+)' column/i)?.[1];
    if (!missingColumn || !(missingColumn in payload)) throw new Error(`Could not save the Hermanus demo project: ${error.message}`);

    delete payload[missingColumn];
    console.log(`Live schema does not yet have projects.${missingColumn}; using the compatible demo payload.`);
  }

  throw new Error('Could not save the Hermanus demo project after removing unavailable optional columns.');
}

async function seedHermanusDemo() {
  const { data: branch, error: branchError } = await adminClient
    .from('branches')
    .select('id, name, province, town, physical_address, latitude, longitude')
    .eq('name', 'PSG Hermanus Wealth')
    .maybeSingle();

  if (branchError) throw new Error(`Could not find the Hermanus branch: ${branchError.message}`);
  if (!branch) throw new Error('PSG Hermanus Wealth is not available. Run the branch seeder before the Hermanus demo seed.');

  const files = await uploadDemoFiles();
  const project = {
    id: projectId,
    branch_id: branch.id,
    branch: branch.name,
    province: branch.province,
    town: branch.town,
    physical_address: branch.physical_address,
    latitude: branch.latitude,
    longitude: branch.longitude,
    manager: 'Lara Botha',
    manager_email: 'lara.botha@psg.co.za',
    installer: 'Overberg Signage',
    designer: 'Colourpix Studio',
    current_stage: 'Awaiting Approval',
    status: 'awaiting_approval',
    target_date: '2026-08-08',
    installation_date: '2026-08-13',
    completion_date: '',
    updated_at: '2026-07-24T09:45:00Z',
    progress: 64,
    branch_manager_view_only: false,
    notes: 'Demonstration rollout record for report review. Site survey and measurements are complete. Artwork proof revision A and the installer quotation are awaiting branch and head-office approval before production release.',
    files,
    tasks: [
      {
        id: 'hermanus-survey-complete', text: 'Complete site inspection and photograph existing fascia', completed: true,
        stage: 'Site Survey', assignees: [{ name: 'Mia Daniels', email: 'mia.daniels@overbergsignage.co.za', designation: 'Survey Lead' }],
        createdAt: '2026-07-15T08:00:00Z', completedAt: '2026-07-16T14:30:00Z', completedByName: 'Mia Daniels', completedByEmail: 'mia.daniels@overbergsignage.co.za',
      },
      {
        id: 'hermanus-measurements-complete', text: 'Verify fascia and reception measurements against survey pack', completed: true,
        stage: 'Measurements Received', assignees: [{ name: 'Mia Daniels', email: 'mia.daniels@overbergsignage.co.za', designation: 'Survey Lead' }],
        createdAt: '2026-07-16T09:00:00Z', completedAt: '2026-07-17T11:15:00Z', completedByName: 'Mia Daniels', completedByEmail: 'mia.daniels@overbergsignage.co.za',
      },
      {
        id: 'hermanus-approval', text: 'Approve branding proof revision A', completed: false,
        stage: 'Awaiting Approval', assignees: [{ name: 'Lara Botha', email: 'lara.botha@psg.co.za', designation: 'Branch Manager' }, { name: 'Beverley', email: 'beverley@colourpix.co.za', designation: 'Colourpix Administrator' }],
        createdAt: '2026-07-22T08:45:00Z',
      },
      {
        id: 'hermanus-quote', text: 'Confirm quotation and release production instruction', completed: false,
        stage: 'Awaiting Approval', assignees: [{ name: 'Beverley', email: 'beverley@colourpix.co.za', designation: 'Colourpix Administrator' }, { name: 'Ruan Meyer', email: 'ruan.meyer@psg.co.za', designation: 'PSG Head Office' }],
        createdAt: '2026-07-23T10:20:00Z',
      },
    ],
    comments: [
      { id: 'hermanus-journal-1', kind: 'comment', date: '15 Jul 2026', author: 'Mia Daniels', message: 'Site inspection completed. The existing fascia is sound and access can be managed from the rear parking area.' },
      { id: 'hermanus-journal-2', kind: 'comment', date: '17 Jul 2026', author: 'Colourpix Studio', message: 'Measurements checked and proof revision A issued. Reception acrylic and external fascia align with the approved brand specification.' },
      { id: 'hermanus-question-1', kind: 'question', date: '24 Jul 2026', requestedAt: '2026-07-24T08:30:00Z', author: 'Colourpix Studio', requesterEmail: 'beverley@colourpix.co.za', message: 'Please confirm that the proposed installation window of 13 August is suitable for the Hermanus office.', status: 'open', requestStage: 'Awaiting Approval' },
    ],
    activity: [
      { date: '24 Jul 2026', title: 'Approval pack issued', detail: 'Proof revision A and the installer quotation were sent to Hermanus and PSG Head Office for approval.', type: 'info' },
      { date: '23 Jul 2026', title: 'Quotation received', detail: 'Overberg Signage quotation was checked against the measurement schedule and attached to the rollout record.', type: 'success' },
      { date: '17 Jul 2026', title: 'Measurements verified', detail: 'The survey pack and measurement schedule were approved by the Colourpix Studio team.', type: 'success' },
    ],
    workspace_id: 'psg-rebrand',
    workspace_name: 'PSG Rebrand',
    client_company: 'PSG',
    graphics_partner: 'Colourpix',
    project_type: 'signage_rollout',
    project_type_name: 'Signage Rollout',
    site_label: 'Hermanus Wealth Office',
    delivery_partner_label: 'Installer',
  };

  await saveProject(project);
  console.log(`Hermanus demonstration project ${projectId} is ready.`);
}

seedHermanusDemo().catch((error) => {
  console.error(error.message);
  process.exit(1);
});