import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const envPath = resolve(root, '.env.local');
const extractPath = resolve(root, 'artifacts', 'pst_extract', 'psg_emails_last_3_months.json');
const extractJsonlPath = resolve(root, 'artifacts', 'pst_extract', 'psg_emails_last_3_months.jsonl');
const reportPath = resolve(root, 'artifacts', 'pst_extract', 'imported_projects_report.md');
const rawReportPath = resolve(root, 'artifacts', 'pst_extract', 'imported_projects_report.json');

function loadEnv(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const vars = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
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

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

if (!existsSync(extractPath) && !existsSync(extractJsonlPath)) {
  throw new Error(`Extraction output not found at ${extractPath} or ${extractJsonlPath}`);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const keywordPattern = /(psg|rebrand|sign|signage|branding|installation|install|quote|quotation|artwork|survey|measurements|vinyl|fascia|totem|fabrication|print|production)/i;

function normalizeSubject(subject) {
  return (subject ?? '')
    .replace(/^(re|fw|fwd)\s*:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function projectIdFor(branchId, subject, date) {
  const key = `${branchId}|${subject}|${date.slice(0, 10)}`;
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 8).toUpperCase();
  return `PSGMAIL-${hash}`;
}

function extractFirstEmail(text) {
  const match = (text ?? '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : '';
}

function pickInstaller(senderName, senderEmail, to, cc) {
  const all = [senderName, senderEmail, to, cc].join(' | ').toLowerCase();
  if (all.includes('colourpix')) return 'Colourpix';
  if (all.includes('sign')) return 'Sign Company';
  if (all.includes('print')) return 'Print Partner';
  return 'Not captured';
}

function loadExtractedEmails() {
  if (existsSync(extractPath)) {
    try {
      return JSON.parse(readFileSync(extractPath, 'utf8'));
    } catch {
      // Fall back to JSONL when final JSON serialization contains malformed records.
    }
  }

  const raw = readFileSync(extractJsonlPath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function normalizeTokenText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function branchTokens(branch) {
  const stopWords = new Set([
    'psg',
    'wealth',
    'insure',
    'asset',
    'trust',
    'office',
    'branch',
    'financial',
    'planning',
  ]);

  const source = [branch.name, branch.town, branch.province]
    .map((s) => normalizeTokenText(s))
    .join(' ')
    .split(' ')
    .filter((token) => token.length >= 4 && !stopWords.has(token));

  return [...new Set(source)];
}

function inferBranchFromMail(mail, branches, branchByName) {
  if (Array.isArray(mail.matchedBranches) && mail.matchedBranches.length > 0) {
    const direct = branchByName.get(String(mail.matchedBranches[0]).toLowerCase());
    if (direct) {
      return direct;
    }
  }

  const haystack = normalizeTokenText([
    mail.subject,
    mail.bodyPreview,
    mail.senderName,
    mail.senderEmail,
    mail.recipientsTo,
    mail.recipientsCc,
  ].join(' '));

  let best = null;
  let bestScore = 0;

  for (const branch of branches) {
    let score = 0;
    const name = normalizeTokenText(branch.name);
    const town = normalizeTokenText(branch.town);
    const province = normalizeTokenText(branch.province);
    const address = normalizeTokenText(branch.physical_address);

    if (name && haystack.includes(name)) score += 5;
    if (town && haystack.includes(town)) score += 3;
    if (province && haystack.includes(province)) score += 1;
    if (address && address.length > 8 && haystack.includes(address)) score += 4;

    for (const token of branchTokens(branch)) {
      if (haystack.includes(token)) score += 1;
    }

    if (score > bestScore) {
      best = branch;
      bestScore = score;
    }
  }

  if (bestScore >= 4) {
    return best;
  }

  return null;
}

async function loadBranches() {
  const selectFull = 'id,name,division,province,town,physical_address,contact_name,contact_email,contact_phone';
  const fullResult = await supabase.from('branches').select(selectFull);

  if (!fullResult.error) {
    return fullResult.data ?? [];
  }

  const fallbackResult = await supabase.from('branches').select('id,name,division,province,town,physical_address');
  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return (fallbackResult.data ?? []).map((row) => ({
    ...row,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
  }));
}

async function ensureProject(payload) {
  const removableFields = [
    'branch_id',
    'workspace_id',
    'workspace_name',
    'client_company',
    'graphics_partner',
    'project_type',
    'project_type_name',
    'site_label',
    'delivery_partner_label',
    'latitude',
    'longitude',
    'physical_address',
  ];

  let candidate = { ...payload };

  for (let i = 0; i < removableFields.length + 3; i++) {
    const result = await supabase.from('projects').upsert(candidate, { onConflict: 'id' }).select('*').single();

    if (!result.error && result.data) {
      return result.data;
    }

    const message = result.error?.message?.toLowerCase() ?? '';

    if (message.includes('duplicate key value')) {
      const existing = await supabase.from('projects').select('*').eq('id', payload.id).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return existing.data;
    }

    const badField = removableFields.find((field) => message.includes(field));
    if (badField && badField in candidate) {
      delete candidate[badField];
      continue;
    }

    const missingColumnMatch = result.error?.message?.match(/'([^']+)'\s+column/i);
    const missingColumn = missingColumnMatch?.[1];
    if (missingColumn && missingColumn in candidate) {
      delete candidate[missingColumn];
      continue;
    }

    throw result.error ?? new Error('Unable to create project record.');
  }

  throw new Error('Unable to create project after fallback attempts.');
}

async function uploadAttachments(projectId, filesMeta, attachmentPaths) {
  const uploaded = [];

  for (const filePath of attachmentPaths) {
    if (!existsSync(filePath)) continue;

    const fileName = filePath.split(/[/\\]/).pop() ?? 'attachment.bin';
    const storagePath = `${projectId}/email-import/${Date.now()}-${fileName}`;
    const fileBuffer = readFileSync(filePath);

    const upload = await supabase
      .storage
      .from('project-files')
      .upload(storagePath, fileBuffer, { upsert: true, contentType: 'application/octet-stream' });

    if (upload.error) {
      continue;
    }

    uploaded.push({
      name: fileName,
      path: storagePath,
      size: fileBuffer.length,
      type: 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
    });
  }

  const merged = [...(Array.isArray(filesMeta) ? filesMeta : []), ...uploaded];

  if (uploaded.length > 0) {
    await supabase.from('projects').update({ files: merged, updated_at: new Date().toISOString() }).eq('id', projectId);
  }

  return uploaded;
}

async function main() {
  const emails = loadExtractedEmails();
  const branches = await loadBranches();

  const branchByName = new Map(branches.map((b) => [String(b.name).toLowerCase(), b]));

  const candidateEmails = emails.filter((mail) => {
    const subject = String(mail.subject ?? '');
    const preview = String(mail.bodyPreview ?? '');
    const text = `${subject} ${preview}`;
    return keywordPattern.test(text);
  });

  const groups = new Map();
  let unmatchedCount = 0;

  for (const mail of candidateEmails) {
    const branch = inferBranchFromMail(mail, branches, branchByName);
    if (!branch) {
      unmatchedCount++;
      continue;
    }

    const subject = normalizeSubject(String(mail.subject ?? 'Untitled conversation'));
    const date = String(mail.date ?? new Date().toISOString());
    const key = `${branch.id}|${subject}`;

    if (!groups.has(key)) {
      groups.set(key, {
        branch,
        subject,
        earliestDate: date,
        latestDate: date,
        emails: [],
      });
    }

    const group = groups.get(key);
    if (date < group.earliestDate) group.earliestDate = date;
    if (date > group.latestDate) group.latestDate = date;
    group.emails.push(mail);
  }

  const report = [];
  const totalGroups = groups.size;
  let processedGroups = 0;

  for (const [, group] of groups) {
    processedGroups++;
    if (processedGroups === 1 || processedGroups % 25 === 0 || processedGroups === totalGroups) {
      console.log(`Processing group ${processedGroups}/${totalGroups} ...`);
    }

    const branch = group.branch;
    const projectId = projectIdFor(branch.id, group.subject, group.earliestDate);

    const senderEmail = extractFirstEmail(group.emails[0]?.senderEmail || group.emails[0]?.recipientsTo || '');
    const managerEmail = senderEmail.includes('@psg') ? senderEmail : (branch.contact_email ?? '');
    const manager = branch.contact_name ?? (group.emails[0]?.senderName || 'Not captured');
    const installer = pickInstaller(group.emails[0]?.senderName, group.emails[0]?.senderEmail, group.emails[0]?.recipientsTo, group.emails[0]?.recipientsCc);

    const payload = {
      id: projectId,
      branch_id: branch.id,
      branch: branch.name,
      province: branch.province ?? 'Not captured',
      town: branch.town ?? 'Not captured',
      physical_address: branch.physical_address ?? '',
      latitude: null,
      longitude: null,
      manager,
      manager_email: managerEmail,
      installer,
      designer: 'Not captured',
      current_stage: 'Awaiting Information',
      status: 'in_progress',
      target_date: '',
      installation_date: '',
      completion_date: '',
      updated_at: new Date().toISOString(),
      progress: 5,
      branch_manager_view_only: false,
      notes: `Imported from Beverley PST email set. Topic: ${group.subject}. Date range: ${group.earliestDate.slice(0, 10)} to ${group.latestDate.slice(0, 10)}.`,
      files: [],
      tasks: [],
      comments: [],
      activity: [{
        date: 'Today',
        title: 'Email import',
        detail: 'Project created from PSG-related Inbox/Sent emails (last 3 months).',
        type: 'info',
      }],
      workspace_id: 'psg-rebrand',
      workspace_name: 'PSG Rebrand',
      client_company: 'PSG',
      graphics_partner: 'Colourpix',
      project_type: 'signage_rollout',
      project_type_name: 'Signage Rollout',
      site_label: 'Branch',
      delivery_partner_label: 'Signage Company',
    };

    const project = await ensureProject(payload);

    const attachments = group.emails.flatMap((mail) => Array.isArray(mail.attachments) ? mail.attachments : []);
    const uploaded = await uploadAttachments(project.id, project.files, attachments);

    report.push({
      branchId: branch.id,
      branchName: branch.name,
      projectId: project.id,
      projectSubject: group.subject,
      manager,
      managerEmail,
      installer,
      emailCount: group.emails.length,
      dateRange: `${group.earliestDate.slice(0, 10)} to ${group.latestDate.slice(0, 10)}`,
      uploadedAttachmentCount: uploaded.length,
      uploadedAttachmentNames: uploaded.map((file) => file.name),
      contactsSeen: [
        ...new Set(group.emails.flatMap((mail) => [mail.senderName, mail.senderEmail, mail.recipientsTo, mail.recipientsCc]).filter(Boolean)),
      ],
    });
  }

  writeFileSync(rawReportPath, JSON.stringify(report, null, 2), 'utf8');

  const lines = [
    '# PSG Email Import Summary',
    '',
    `Imported projects: ${report.length}`,
    `Candidate PSG emails reviewed: ${candidateEmails.length}`,
    `Unmatched emails skipped: ${unmatchedCount}`,
    '',
  ];

  const byBranch = new Map();
  for (const row of report) {
    if (!byBranch.has(row.branchName)) byBranch.set(row.branchName, []);
    byBranch.get(row.branchName).push(row);
  }

  for (const [branchName, rows] of [...byBranch.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`## ${branchName}`);
    lines.push('');

    for (const row of rows) {
      lines.push(`- Project ID: ${row.projectId}`);
      lines.push(`- Topic: ${row.projectSubject}`);
      lines.push(`- Manager: ${row.manager}`);
      lines.push(`- Manager email: ${row.managerEmail || 'Not captured'}`);
      lines.push(`- Signage company: ${row.installer}`);
      lines.push(`- Source emails: ${row.emailCount}`);
      lines.push(`- Date range: ${row.dateRange}`);
      lines.push(`- Uploaded attachments: ${row.uploadedAttachmentCount}`);
      if (row.uploadedAttachmentNames.length > 0) {
        lines.push(`- Attachment names: ${row.uploadedAttachmentNames.join(', ')}`);
      }
      if (row.contactsSeen.length > 0) {
        lines.push(`- Contacts seen: ${row.contactsSeen.join(' | ')}`);
      }
      lines.push('');
    }
  }

  writeFileSync(reportPath, lines.join('\n'), 'utf8');

  console.log(`Projects imported: ${report.length}`);
  console.log(`Candidate emails: ${candidateEmails.length}`);
  console.log(`Unmatched skipped: ${unmatchedCount}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Raw report: ${rawReportPath}`);
}

main().catch((error) => {
  console.error('Import failed:', error.message);
  process.exit(1);
});
