import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const csvPath = process.argv[2] ?? 'D:/last 3 months.CSV';
const shouldApply = process.argv.includes('--apply');
const shouldReplace = process.argv.includes('--replace');
const actor = 'Beverley';
const actorEmail = 'bd@colourpix.co.za';

const provinceByTown = new Map(Object.entries({
  yzerfontein: 'Western Cape', langebaan: 'Western Cape', malmesbury: 'Western Cape', newlands: 'Western Cape', somerset: 'Western Cape', somersetlinks: 'Western Cape', outeniqua: 'Western Cape', garlington: 'KwaZulu-Natal', umhlanga: 'KwaZulu-Natal', pietermaritzburg: 'KwaZulu-Natal', hoedspruit: 'Limpopo', warmbad: 'Limpopo', bela: 'Limpopo', louis: 'Limpopo', trichardt: 'Limpopo', middelburg: 'Mpumalanga', pretoria: 'Gauteng', centurion: 'Gauteng', r21: 'Gauteng', wolwespruit: 'Gauteng', oldoak: 'Western Cape', oak: 'Western Cape', fintech: 'Western Cape', melrose: 'Gauteng', northcliff: 'Gauteng', jeffreys: 'Eastern Cape', jeffreysbay: 'Eastern Cape', christiana: 'North West', bloemhof: 'North West', bultfontein: 'Free State' }));

const knownSites = [
  { key: 'yzerfontein', branch: 'PSG Yzerfontein', town: 'Yzerfontein' },
  { key: 'warmbad', branch: 'PSG Insure Warmbad', town: 'Warmbad' },
  { key: 'bela bela', branch: 'PSG Insure Warmbad', town: 'Warmbad' },
  { key: 'christiana', branch: 'PSG Christiana', town: 'Christiana' },
  { key: 'bloemhof', branch: 'PSG Bloemhof', town: 'Bloemhof' },
  { key: 'bultfontein', branch: 'PSG Bultfontein', town: 'Bultfontein' },
  { key: 'old oak', branch: 'PSG Old Oak', town: 'Old Oak' },
  { key: 'louis trichardt', branch: 'PSG Louis Trichardt', town: 'Louis Trichardt' },
  { key: 'pretoria relocation', branch: 'PSG Pretoria Relocation', town: 'Pretoria' },
  { key: 'pretoria east', branch: 'PSG Wealth Pretoria East', town: 'Pretoria' },
  { key: 'wolwespruit', branch: 'PSG Wealth and Insure Wolwespruit', town: 'Pretoria' },
  { key: 'umhlanga', branch: 'PSG Wealth Umhlanga', town: 'Umhlanga' },
  { key: 'somerset links', branch: 'PSG Somerset Links', town: 'Somerset West' },
  { key: 'newlands', branch: 'PSG Wealth Newlands', town: 'Newlands' },
  { key: 'middelberg', branch: 'PSG Middelburg Mpumalanga', town: 'Middelburg' },
  { key: 'middelburg', branch: 'PSG Middelburg Mpumalanga', town: 'Middelburg' },
  { key: 'hoedspruit', branch: 'PSG Hoedspruit', town: 'Hoedspruit' },
  { key: 'malmesbury market', branch: 'PSG Wealth Malmesbury Market Street', town: 'Malmesbury' },
  { key: 'malmesbury', branch: 'PSG Malmesbury', town: 'Malmesbury' },
  { key: 'fintech campus', branch: 'PSG Wealth Fintech Campus', town: 'Cape Town' },
  { key: 'outeniqua', branch: 'PSG Wealth Outeniqua', town: 'George' },
  { key: 'r21', branch: 'PSG R21 Pretoria', town: 'Pretoria' },
  { key: 'psf insure centurion', branch: 'PSG Insure Centurion', town: 'Centurion' },
  { key: 'pietermaritzburg', branch: 'PSG Insure Pietermaritzburg', town: 'Pietermaritzburg' },
  { key: 'northcliff', branch: 'PSG Wealth Northcliff', town: 'Johannesburg' },
  { key: 'melrose arch', branch: 'PSG Wealth Melrose Arch', town: 'Johannesburg' },
  { key: 'jeffreys bay', branch: 'PSG Jeffreys Bay Oosterland Street', town: 'Jeffreys Bay' },
  { key: 'garlington', branch: 'PSG Garlington', town: 'Hilton' },
  { key: 'constantia', branch: 'PSG Constantia', town: 'Constantia' },
  { key: 'cradock', branch: 'PSG Cradock', town: 'Cradock' },
  { key: 'tygervalley', branch: 'PSG Tygervalley', town: 'Bellville' },
  { key: 'global house', branch: 'PSG Global House', town: 'Johannesburg' },
  { key: 'hermanus portfolio', branch: 'PSG Hermanus Portfolio Management & Stockbroking', town: 'Hermanus' },
  { key: 'pretoria oos', branch: 'PSG Pretoria Oos', town: 'Pretoria' },
  { key: 'silverlakes', branch: 'PSG Silverlakes', town: 'Pretoria' },
];

function loadEnv(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const vars = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
    return vars;
  } catch {
    return {};
  }
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += char;
  }
  if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

function normalize(value) {
  return value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanSubject(subject) {
  return subject.replace(/^(re|fw|fwd):\s*/i, '').trim();
}

function slug(value) {
  return normalize(value).replace(/\s+/g, '-').replace(/^-|-$/g, '') || 'project';
}

function siteMatches(text, record = {}) {
  const normal = normalize(text);
  const matches = [];
  for (const site of knownSites) {
    if (normal.includes(normalize(site.key))) matches.push(site);
  }

  if (/@umhlangasigns\.co\.za/i.test(record['From: (Address)'] ?? '') && !matches.some((site) => site.branch === 'PSG Wealth Umhlanga')) {
    matches.push({ key: 'umhlanga signs sender', branch: 'PSG Wealth Umhlanga', town: 'Umhlanga' });
  }

  return matches;
}

function topMessage(body) {
  return String(body ?? '')
    .split(/\n\s*From:\s+/i)[0]
    .replace(/_{20,}[\s\S]*$/g, '')
    .trim();
}

function inferStage(text, category) {
  const normal = normalize(text);
  if (/photos of the new signage|looks great|happy with the work|installation complete|completed/.test(normal)) return 'Installed';
  if (/installation date|arrange for access|rope access|cherry picker|on site|tomorrow at 9am|removals can be done|removal to happen tomorrow/.test(normal)) return 'Installation Scheduled';
  if (/approved|all in order|costs has been approved/.test(normal)) return 'Approved';
  if (/quote received|attached quote|attached please find.*quote|two quotes|quote estimate|kwotasies|please see attached/.test(normal)) return 'Quotation Received';
  if (/quote|quotation|kwotasie|estimate/.test(normal)) return 'Quotation Requested';
  if (/artwork.*sent|attached artwork|final layouts|layout/.test(normal)) return 'Artwork Sent';
  if (/municipal approval|landlord|provider contact|approval application/.test(normal)) return 'Awaiting Approval';
  if (/measurements|dimensions|size|120 l|2300mm/.test(normal)) return 'Measurements Received';
  if (/brief|request|new signage|brand refresh|rebrand|signage/.test(normal)) return 'Awaiting Information';
  if (category?.toLowerCase().includes('in process')) return 'Artwork In Progress';
  return 'New Project';
}

function progressForStage(stage) {
  const stages = ['New Project', 'Awaiting Information', 'Site Survey', 'Measurements Received', 'Artwork In Progress', 'Artwork Sent', 'Awaiting Approval', 'Approved', 'Quotation Requested', 'Quotation Received', 'PO Issued', 'Production', 'Installation Scheduled', 'Installation In Progress', 'Installed', 'Photos Uploaded', 'Client Signoff', 'Completed'];
  const index = stages.indexOf(stage);
  return index < 0 ? 0 : Math.round((index / (stages.length - 1)) * 100);
}

function statusForStage(stage, text) {
  const normal = normalize(text);
  if (/dropped|overdue|still outstanding|not yet been|trying to get hold|follow up|waiting/.test(normal)) return 'delayed';
  if (stage === 'Installed' || stage === 'Completed') return 'completed';
  if (stage === 'Awaiting Approval') return 'awaiting_approval';
  return 'in_progress';
}

function extractManager(record, text) {
  const fromName = record['From: (Name)']?.trim() || '';
  const fromAddress = record['From: (Address)']?.trim() || '';
  if (fromAddress && !/@colourpix\.co\.za|@visex\.co\.za|@truegritsignage\.co\.za|@ornate\.co\.za|@umhlangasigns\.co\.za|@signcosa\.co\.za|@exsigns\.co\.za|@edenleo\.com/i.test(fromAddress)) {
    return { manager: fromName || fromAddress.split('@')[0], managerEmail: fromAddress };
  }
  const match = text.match(/([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})\s*\n[^\n]{0,80}\n\s*E:\s*([^\s<]+@psg\.co\.za)/i);
  if (match) return { manager: match[1].trim(), managerEmail: match[2].trim().toLowerCase() };
  const emailMatch = text.match(/([A-Za-z0-9._%+-]+@psg\.co\.za)/i);
  if (emailMatch) return { manager: emailMatch[1].split('@')[0].replace(/[._]/g, ' '), managerEmail: emailMatch[1].toLowerCase() };
  return { manager: 'Not captured', managerEmail: '' };
}

function extractInstaller(text) {
  const lower = text.toLowerCase();
  if (lower.includes('truegrit')) return 'True Grit Signage';
  if (lower.includes('ornate')) return 'Ornate';
  if (lower.includes('visex')) return 'Visex';
  if (lower.includes('umhlanga signs')) return 'Umhlanga Signs';
  if (lower.includes('signcosa')) return 'SignCo SA';
  if (lower.includes('exsigns')) return 'Exsigns';
  if (lower.includes('edenleo')) return 'Edenleo';
  if (lower.includes('saprintandsign')) return 'SA Print and Sign';
  return 'Not captured';
}

function taskFromText(text) {
  const normal = normalize(text);
  const tasks = new Set();
  if (/quote|quotation|kwotasie/.test(normal)) tasks.add('Review or request quote');
  if (/artwork|layout|brief/.test(normal)) tasks.add('Check artwork or layout');
  if (/installation date|arrange|on site|tomorrow|removal|rope access|cherry picker/.test(normal)) tasks.add('Confirm installation/removal date');
  if (/approval|landlord|municipal/.test(normal)) tasks.add('Follow up approval');
  if (/measurements|dimensions|size/.test(normal)) tasks.add('Confirm measurements');
  if (/photos|signoff|happy with the work/.test(normal)) tasks.add('Review photos and close out');
  return [...tasks].slice(0, 5);
}

function latestSentAt(text) {
  const matches = [...text.matchAll(/Sent:\s*(?:\w+,\s*)?(\d{1,2}\s+\w+\s+2026)\s+(\d{1,2}:\d{2})/gi)];
  if (!matches.length) return new Date().toISOString();
  const raw = `${matches[0][1]} ${matches[0][2]}`;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}

function projectSummary(records) {
  return records
    .slice(0, 4)
    .map((record) => `${cleanSubject(record.Subject)} — ${record['From: (Name)'] || record['From: (Address)']}: ${String(record.Body).replace(/\s+/g, ' ').slice(0, 260)}`)
    .join('\n\n');
}

const csvRows = parseCsv(readFileSync(csvPath, 'utf8'));
const headers = (csvRows.shift() ?? []).map((header) => header.replace(/^\uFEFF/, '').trim());
const records = csvRows.filter((row) => row.some(Boolean)).map((row, index) => ({ rowNumber: index + 1, ...Object.fromEntries(headers.map((header, column) => [header, row[column] ?? ''])) }));
const groups = new Map();

for (const record of records) {
  const haystack = `${record.Subject}\n${topMessage(record.Body)}`;
  const matches = siteMatches(haystack, record);
  for (const site of matches) {
    const group = groups.get(site.branch) ?? { site, records: [] };
    group.records.push(record);
    groups.set(site.branch, group);
  }
}

const projects = [...groups.values()]
  .filter((group) => group.records.length > 0)
  .sort((left, right) => left.site.branch.localeCompare(right.site.branch))
  .map((group, index) => {
    const uniqueRecords = [...new Map(group.records.map((record) => [record.rowNumber, record])).values()]
      .sort((left, right) => left.rowNumber - right.rowNumber);
    const combined = uniqueRecords.map((record) => `${record.Subject}\n${record.Body}`).join('\n\n');
    const latestRecord = uniqueRecords[0];
    const latestThreadText = uniqueRecords.slice(0, 3).map((record) => `${record.Subject}\n${topMessage(record.Body)}`).join('\n\n');
    const stage = inferStage(latestThreadText, latestRecord.Categories);
    const status = statusForStage(stage, latestThreadText);
    const manager = extractManager(latestRecord, combined);
    const tasks = taskFromText(combined).map((task, taskIndex) => ({
      id: `email-import-${slug(group.site.branch)}-${taskIndex + 1}`,
      text: task,
      completed: false,
      createdAt: new Date().toISOString(),
    }));
    const townKey = normalize(group.site.town).split(' ')[0];
    const province = provinceByTown.get(townKey) ?? provinceByTown.get(slug(group.site.town).replace(/-/g, '')) ?? 'Not captured';
    const rowRefs = uniqueRecords.map((record) => record.rowNumber).sort((a, b) => a - b);
    const id = `PSG-${String(index + 1).padStart(3, '0')}-${slug(group.site.town).toUpperCase().slice(0, 12)}`;

    return {
      id,
      workspace_id: 'psg-national-signage-rollout',
      workspace_name: 'Colourpix / PSG Wealth Insure Workspace',
      client_company: 'PSG Wealth Insure',
      graphics_partner: 'Colourpix CC',
      project_type: 'signage_rollout',
      project_type_name: 'Signage rollout',
      site_label: 'Site / branch',
      delivery_partner_label: 'Delivery partner',
      province,
      town: group.site.town,
      branch: group.site.branch,
      manager: manager.manager,
      manager_email: manager.managerEmail,
      installer: extractInstaller(combined),
      designer: 'Colourpix',
      current_stage: stage,
      status,
      target_date: '',
      installation_date: '',
      completion_date: '',
      updated_at: latestSentAt(combined),
      progress: progressForStage(stage),
      branch_manager_view_only: false,
      notes: `Imported by ${actor} from email CSV. Source rows: ${rowRefs.join(', ')}.\n\n${projectSummary(group.records)}`,
      files: [],
      tasks,
      comments: uniqueRecords.slice(0, 6).map((record) => ({
        date: 'Email import',
        author: record['From: (Name)'] || record['From: (Address)'] || 'Email sender',
        message: `${cleanSubject(record.Subject)}\n${topMessage(record.Body).replace(/\s+/g, ' ').slice(0, 900)}`,
      })),
      activity: [{
        date: 'Today',
        title: 'Project created from email import',
        detail: `${actor} imported ${uniqueRecords.length} related email row${uniqueRecords.length === 1 ? '' : 's'} for ${group.site.branch}.`,
        type: 'success',
      }],
      import_meta: {
        actor,
        actorEmail,
        source: csvPath,
        rowRefs,
        subjects: [...new Set(uniqueRecords.map((record) => cleanSubject(record.Subject)))],
      },
    };
  });

mkdirSync(resolve(__dir, '..', 'artifacts'), { recursive: true });
writeFileSync(resolve(__dir, '..', 'artifacts', 'email-project-import-preview.json'), JSON.stringify(projects, null, 2));
writeFileSync(resolve(__dir, '..', 'artifacts', 'email-project-import-preview.csv'), [
  'id,branch,town,province,stage,status,installer,manager,emailRows,subjects',
  ...projects.map((project) => [
    project.id,
    project.branch,
    project.town,
    project.province,
    project.current_stage,
    project.status,
    project.installer,
    project.manager,
    project.import_meta.rowRefs.join('|'),
    project.import_meta.subjects.join(' | '),
  ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')),
].join('\n'));

console.log(`Prepared ${projects.length} project import candidates.`);
for (const project of projects) {
  console.log(`${project.id} | ${project.branch} | ${project.current_stage} | ${project.status} | rows ${project.import_meta.rowRefs.join(',')}`);
}

if (!shouldApply) {
  console.log('Preview only. Re-run with --apply to insert into Supabase.');
  process.exit(0);
}

const env = { ...loadEnv(resolve(__dir, '..', '.env.local')), ...loadEnv(resolve(__dir, '..', '.env')), ...process.env };
if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const adminClient = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

if (shouldReplace) {
  const { error: deleteError } = await adminClient.from('projects').delete().neq('id', '__keep_no_projects__');
  if (deleteError) {
    console.error(deleteError);
    process.exit(1);
  }
}

const payload = projects.map(({ import_meta, ...project }) => project);
let importResult = await adminClient.from('projects').upsert(payload, { onConflict: 'id' }).select('id, branch, current_stage, status');

if (['workspace_id', 'workspace_name', 'client_company', 'graphics_partner', 'project_type', 'project_type_name', 'site_label', 'delivery_partner_label'].some((column) => importResult.error?.message.toLowerCase().includes(column))) {
  const fallbackPayload = payload.map((project) => {
    const {
      workspace_id,
      workspace_name,
      client_company,
      graphics_partner,
      project_type,
      project_type_name,
      site_label,
      delivery_partner_label,
      ...fallbackProject
    } = project;

    return fallbackProject;
  });

  importResult = await adminClient.from('projects').upsert(fallbackPayload, { onConflict: 'id' }).select('id, branch, current_stage, status');
}

if (importResult.error) {
  console.error(importResult.error);
  process.exit(1);
}

console.log(`${shouldReplace ? 'Replaced and imported' : 'Imported'} ${importResult.data?.length ?? 0} projects into Supabase as ${actor}.`);
