import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const env = {};

try {
  const contents = readFileSync(envPath, 'utf8');
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equalIndex = line.indexOf('=');
    if (equalIndex === -1) continue;
    const key = line.slice(0, equalIndex).trim();
    const value = line.slice(equalIndex + 1).trim().replace(/^"|"$/g, '');
    if (key) {
      env[key] = value;
    }
  }
} catch {
  // Ignore missing local env and rely on the process environment.
}

const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local or environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const desiredStages = [
  'Site Inspection',
  'Layout Brief',
  'Signed Brief',
  'Quote',
  'Invoice',
  'Production & Installation',
];

function normalizeStage(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugify(value) {
  return normalizeStage(value).replace(/\s+/g, '-');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeNewTask(stage, index) {
  const now = new Date().toISOString();
  return {
    id: `stage-${Date.now()}-${index}-${slugify(stage) || 'stage'}`,
    text: stage,
    stage,
    completed: false,
    status: 'pending',
    createdAt: now,
  };
}

async function fetchRows() {
  const [branchesResult, projectsResult] = await Promise.all([
    supabase.from('branches').select('*'),
    supabase.from('projects').select('*'),
  ]);

  if (branchesResult.error) throw branchesResult.error;
  if (projectsResult.error) throw projectsResult.error;

  return {
    branches: branchesResult.data ?? [],
    projects: projectsResult.data ?? [],
  };
}

function deriveProjectId(branch, existingProjects) {
  const branchCode = String(branch?.code ?? 'PSG000').trim().toUpperCase() || 'PSG000';
  const projectPrefix = `${branchCode}P`;
  const matches = existingProjects
    .map((project) => project?.id)
    .filter((id) => typeof id === 'string' && new RegExp(`^${escapeRegExp(projectPrefix)}\\d+$`, 'i').test(id));

  const maxSequence = matches.reduce((max, id) => {
    const match = new RegExp(`^${escapeRegExp(projectPrefix)}(\\d+)$`, 'i').exec(id);
    if (!match) return max;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);

  return `${projectPrefix}${maxSequence + 1}`;
}

function mergeDesiredTasks(existingTasks) {
  const tasks = [];
  const seen = new Set();

  for (const task of Array.isArray(existingTasks) ? existingTasks : []) {
    const key = normalizeStage(task?.stage ?? task?.text ?? '');
    if (desiredStages.some((stage) => normalizeStage(stage) === key)) {
      if (seen.has(key)) continue;
      task.text = desiredStages.find((stage) => normalizeStage(stage) === key);
      task.stage = task.text;
      task.completed = false;
      task.status = 'pending';
      if (!task.createdAt) task.createdAt = new Date().toISOString();
      seen.add(key);
    }
    tasks.push(task);
  }

  desiredStages.forEach((stage, index) => {
    const key = normalizeStage(stage);
    if (seen.has(key)) {
      return;
    }

    tasks.push(makeNewTask(stage, index));
  });

  return tasks;
}

async function ensureProjectForBranch(branch, projects) {
  const linkedProjects = projects.filter((project) => {
    if (!project) return false;
    const branchIdMatch = project.branch_id === branch.id;
    const branchNameMatch = typeof project.branch === 'string' && project.branch.trim().toLowerCase() === String(branch.name).trim().toLowerCase();
    const branchCodeMatch = typeof branch.code === 'string' && typeof project.branch_code === 'string' && project.branch_code.trim().toLowerCase() === branch.code.trim().toLowerCase();
    return branchIdMatch || branchNameMatch || branchCodeMatch;
  });

  if (linkedProjects.length === 0) {
    const projectId = deriveProjectId(branch, projects);
    const now = new Date().toISOString();
    const projectPayload = {
      id: projectId,
      branch_id: branch.id,
      branch_code: branch.code ?? null,
      branch: branch.name,
      workspace_id: 'psg-national-signage-rollout',
      workspace_name: 'Colourpix / PSG Workspace',
      client_company: 'PSG',
      graphics_partner: 'Colourpix CC',
      project_type: 'signage_rollout',
      project_type_name: 'Signage rollout',
      site_label: 'Site / branch',
      province: branch.province ?? null,
      town: branch.town ?? null,
      physical_address: branch.physical_address ?? branch.physicalAddress ?? null,
      latitude: null,
      longitude: null,
      manager: branch.marketing_coordinator_name ?? branch.contact_name ?? 'Not captured',
      manager_email: branch.marketing_coordinator_email ?? branch.contact_email ?? '',
      installer: 'Not captured',
      designer: 'Not captured',
      current_stage: 'Site Inspection',
      status: 'on_schedule',
      target_date: '',
      installation_date: '',
      completion_date: '',
      updated_at: now,
      progress: 0,
      branch_manager_view_only: false,
      notes: `Created automatically for branch ${branch.name}.`,
      files: [],
      tasks: desiredStages.map((stage, index) => makeNewTask(stage, index)),
      comments: [],
      activity: [{ date: now.slice(0, 10), title: 'Project Created', detail: `${projectId} created for branch ${branch.name}.`, type: 'success' }],
    };

    const { data, error } = await supabase.from('projects').insert([projectPayload]).select('id');
    if (error) throw error;
    return { branchId: branch.id, projectId: data?.[0]?.id ?? projectId, action: 'created' };
  }

  const project = linkedProjects[0];
  const nextTasks = mergeDesiredTasks(project.tasks);
  const nextCurrentStage = desiredStages.includes(project.current_stage) ? project.current_stage : desiredStages[0];
  const updatePayload = {
    tasks: nextTasks,
    current_stage: nextCurrentStage,
    status: 'on_schedule',
    progress: 0,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('projects').update(updatePayload).eq('id', project.id);
  if (error) throw error;

  return { branchId: branch.id, projectId: project.id, action: 'updated' };
}

async function main() {
  const { branches, projects } = await fetchRows();
  const results = [];

  for (const branch of branches) {
    const result = await ensureProjectForBranch(branch, projects);
    results.push(result);
  }

  const createdCount = results.filter((entry) => entry.action === 'created').length;
  const updatedCount = results.filter((entry) => entry.action === 'updated').length;
  console.log(`Synced ${results.length} branches. Created ${createdCount}, updated ${updatedCount}.`);
  console.log(JSON.stringify(results.slice(0, 10), null, 2));
}

main().catch((error) => {
  console.error('Failed to sync branch lifecycle:', error);
  process.exit(1);
});
