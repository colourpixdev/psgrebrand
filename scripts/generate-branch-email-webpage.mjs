import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';
import { createClient } from '@supabase/supabase-js';

const root = resolve(process.cwd());
const artifactsDir = resolve(root, 'artifacts');
const extractJsonPath = resolve(root, 'artifacts', 'pst_extract', 'psg_emails_last_3_months.json');
const extractJsonlPath = resolve(root, 'artifacts', 'pst_extract', 'psg_emails_last_3_months.jsonl');
const previewsDir = resolve(root, 'artifacts', 'branch-email-previews');
const outHtmlPath = resolve(root, 'artifacts', 'branches-email-preview.html');
const publicReportDir = resolve(root, 'src', 'public');
const publicPreviewsDir = resolve(publicReportDir, 'branch-email-previews');
const publicOutHtmlPath = resolve(publicReportDir, 'branches-email-preview.html');

function loadEnv(path) {
  const env = {};
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

function loadExtractedEmails() {
  if (existsSync(extractJsonPath)) {
    try {
      return JSON.parse(readFileSync(extractJsonPath, 'utf8'));
    } catch {
      // Fallback to JSONL.
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
    if (direct) return direct;
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

  return bestScore >= 4 ? best : null;
}

function encodeHrefFromAbs(absPath, fromDir) {
  const rel = relative(fromDir, absPath).split('\\').join('/');
  return rel
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function emailSortDesc(a, b) {
  return new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime();
}

async function loadBranches(supabase) {
  const full = await supabase
    .from('branches')
    .select('id,name,division,province,town,physical_address,contact_name,contact_email,contact_phone')
    .order('name', { ascending: true });

  if (!full.error) return full.data ?? [];

  const fallback = await supabase
    .from('branches')
    .select('id,name,division,province,town,physical_address')
    .order('name', { ascending: true });

  if (fallback.error) throw fallback.error;

  return (fallback.data ?? []).map((r) => ({
    ...r,
    contact_name: '',
    contact_email: '',
    contact_phone: '',
  }));
}

function makePreviewHtml(mail, attachmentLinks) {
  const body = cleanText(mail.bodyPreview || 'No preview text captured.');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(mail.subject || 'Email Preview')}</title>
  <style>
    body{font-family:Segoe UI,Arial,sans-serif;background:#f7f8fb;color:#1f2937;margin:0;padding:24px}
    .card{max-width:980px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px}
    h1{font-size:20px;margin:0 0 10px}
    .meta{display:grid;grid-template-columns:160px 1fr;gap:8px;margin-bottom:16px}
    .meta div:nth-child(odd){color:#6b7280;font-weight:600}
    pre{white-space:pre-wrap;word-wrap:break-word;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px}
    a{color:#0f62fe;text-decoration:none}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <div class="card">
    <h1>${esc(mail.subject || '(No subject)')}</h1>
    <div class="meta">
      <div>Date</div><div>${esc(mail.date || '')}</div>
      <div>From</div><div>${esc(mail.senderName || '')} ${mail.senderEmail ? '&lt;' + esc(mail.senderEmail) + '&gt;' : ''}</div>
      <div>To</div><div>${esc(mail.recipientsTo || '')}</div>
      <div>CC</div><div>${esc(mail.recipientsCc || '')}</div>
      <div>Folder</div><div>${esc(mail.folderPath || '')}</div>
    </div>
    <h3>Body Preview</h3>
    <pre>${esc(body)}</pre>
    <h3>Attachments</h3>
    <ul>
      ${attachmentLinks.length ? attachmentLinks.map((a) => `<li><a target="_blank" rel="noopener" href="${a.href}">${esc(a.name)}</a></li>`).join('') : '<li>No attachments</li>'}
    </ul>
  </div>
</body>
</html>`;
}

async function main() {
  const env = { ...loadEnv(resolve(root, '.env.local')), ...process.env };
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const branches = await loadBranches(supabase);
  const emails = loadExtractedEmails();

  mkdirSync(previewsDir, { recursive: true });
  mkdirSync(publicPreviewsDir, { recursive: true });

  const branchByName = new Map(branches.map((b) => [String(b.name).toLowerCase(), b]));
  const branchMap = new Map(branches.map((b) => [b.id, { branch: b, emails: [] }]));

  for (const mail of emails) {
    const branch = inferBranchFromMail(mail, branches, branchByName);
    if (!branch) continue;
    branchMap.get(branch.id).emails.push(mail);
  }

  for (const { emails: branchEmails } of branchMap.values()) {
    branchEmails.sort(emailSortDesc);
  }

  let branchButtons = '';
  let branchPanels = '';
  let firstBranchId = '';

  for (const { branch, emails: branchEmails } of branchMap.values()) {
    if (!firstBranchId) {
      firstBranchId = String(branch.id);
    }

    const emailRows = [];
    const attachmentRows = [];

    for (const mail of branchEmails) {
      const mailKey = mail.mailKey || `mail-${Math.random().toString(36).slice(2)}`;
      const previewFile = `${mailKey}.html`;
      const previewAbs = resolve(previewsDir, previewFile);
      const publicPreviewAbs = resolve(publicPreviewsDir, previewFile);
      const previewHref = `branch-email-previews/${encodeURIComponent(previewFile)}`;

      const attachments = Array.isArray(mail.attachments) ? mail.attachments : [];
      const attachmentLinks = attachments
        .filter((abs) => typeof abs === 'string' && abs.length > 0)
        .map((abs) => {
          const attachmentAbs = resolve(abs);
          const href = encodeHrefFromAbs(attachmentAbs, previewsDir);
          const artHref = encodeHrefFromAbs(attachmentAbs, artifactsDir);
          const name = abs.split(/[\\/]/).pop() || abs;
          return { href, artHref, name };
        });

      const previewHtml = makePreviewHtml(mail, attachmentLinks);
      writeFileSync(previewAbs, previewHtml, 'utf8');
      writeFileSync(publicPreviewAbs, previewHtml, 'utf8');

      emailRows.push(`
        <tr>
          <td>${esc(mail.date || '')}</td>
          <td>${esc(mail.subject || '(No subject)')}</td>
          <td>${esc(mail.senderName || '')}</td>
          <td><a target="_blank" rel="noopener" href="${previewHref}">Open preview</a></td>
        </tr>
      `);

      for (const att of attachmentLinks) {
        attachmentRows.push({
          date: mail.date || '',
          subject: mail.subject || '(No subject)',
          fileName: att.name,
          fileHref: att.artHref,
          previewHref,
        });
      }
    }

    attachmentRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const attachmentsHtml = attachmentRows.length
      ? `<table class="list"><thead><tr><th>Date</th><th>Attachment</th><th>Email</th><th>Preview</th></tr></thead><tbody>${attachmentRows
          .map(
            (r) => `<tr><td>${esc(r.date)}</td><td><a target="_blank" rel="noopener" href="${r.fileHref}">${esc(
              r.fileName,
            )}</a></td><td>${esc(r.subject)}</td><td><a target="_blank" rel="noopener" href="${r.previewHref}">Open preview</a></td></tr>`,
          )
          .join('')}</tbody></table>`
      : '<p class="muted">No attachments matched for this branch.</p>';

    branchButtons += `
      <button type="button" class="branch-pill" data-branch-button data-branch-id="${esc(branch.id)}" data-branch-search="${esc(
        `${branch.name} ${branch.division || ''} ${branch.town || ''} ${branch.province || ''}`,
      )}">
        <span class="name">${esc(branch.name)}</span>
        <span class="count">${branchEmails.length}</span>
      </button>
    `;

    branchPanels += `
      <section class="branch" data-branch-panel id="${esc(branch.id)}">
        <h2>${esc(branch.name)}</h2>
        <div class="grid">
          <div><strong>ID</strong><span>${esc(branch.id)}</span></div>
          <div><strong>Division</strong><span>${esc(branch.division || '')}</span></div>
          <div><strong>Province</strong><span>${esc(branch.province || '')}</span></div>
          <div><strong>Town</strong><span>${esc(branch.town || '')}</span></div>
          <div><strong>Physical Address</strong><span>${esc(branch.physical_address || '')}</span></div>
          <div><strong>Contact Name</strong><span>${esc(branch.contact_name || '')}</span></div>
          <div><strong>Contact Email</strong><span>${esc(branch.contact_email || '')}</span></div>
          <div><strong>Contact Phone</strong><span>${esc(branch.contact_phone || '')}</span></div>
          <div><strong>Matched Emails</strong><span>${branchEmails.length}</span></div>
        </div>

        <h3>Emails</h3>
        ${
          emailRows.length
            ? `<table class="list"><thead><tr><th>Date</th><th>Subject</th><th>Sender</th><th>Preview</th></tr></thead><tbody>${emailRows.join(
                '',
              )}</tbody></table>`
            : '<p class="muted">No matched emails for this branch.</p>'
        }

        <h3>Attachments (Newest to Oldest)</h3>
        ${attachmentsHtml}
      </section>
    `;
  }

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PSG Branch Email and Attachment Preview</title>
  <style>
    :root{--bg:#f4f7fb;--card:#fff;--line:#dbe3ef;--ink:#172033;--muted:#5f6f88;--link:#0f62fe}
    *{box-sizing:border-box}
    body{margin:0;background:linear-gradient(180deg,#eef3fa 0%,#f8fbff 100%);font-family:Segoe UI,Arial,sans-serif;color:var(--ink)}
    .wrap{max-width:1320px;margin:0 auto;padding:24px}
    .hero{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px;margin-bottom:18px}
    h1{margin:0 0 8px;font-size:28px}
    .muted{color:var(--muted)}
    .layout{display:grid;grid-template-columns:340px 1fr;gap:16px;align-items:start}
    .sidebar{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;position:sticky;top:14px;max-height:calc(100vh - 28px);overflow:auto}
    .panel{background:transparent}
    .search{width:100%;padding:10px 12px;border:1px solid #c9d4e7;border-radius:10px;font-size:14px}
    .branch-list{display:flex;flex-direction:column;gap:8px;margin-top:12px}
    .branch-pill{display:flex;align-items:center;justify-content:space-between;width:100%;padding:10px 12px;border-radius:10px;border:1px solid #d7e1f1;background:#f8fbff;color:#18253d;cursor:pointer;transition:.15s ease}
    .branch-pill:hover{background:#eef5ff;border-color:#9ab4df}
    .branch-pill.active{background:#0f62fe;color:#fff;border-color:#0f62fe}
    .branch-pill .name{font-weight:600;text-align:left}
    .branch-pill .count{font-size:12px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.25)}
    .branch{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:16px}
    .branch[hidden]{display:none}
    h2{margin:0 0 12px;font-size:22px}
    h3{margin:16px 0 8px;font-size:16px}
    .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 16px;margin-bottom:10px}
    .grid div{display:flex;flex-direction:column;border:1px solid #edf1f7;border-radius:8px;padding:8px;background:#fbfdff}
    .grid strong{font-size:12px;color:var(--muted);margin-bottom:2px}
    .list{width:100%;border-collapse:collapse;font-size:14px}
    .list th,.list td{border-bottom:1px solid #ecf1f7;padding:8px;text-align:left;vertical-align:top}
    .list th{background:#f7faff;color:#3b4a63}
    a{color:var(--link);text-decoration:none}
    a:hover{text-decoration:underline}
    .hint{font-size:12px;color:var(--muted);margin-top:8px}
    @media (max-width:980px){.layout{grid-template-columns:1fr}.sidebar{position:static;max-height:none}.grid{grid-template-columns:1fr 1fr}}
    @media (max-width:640px){.grid{grid-template-columns:1fr}.wrap{padding:12px}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>PSG Branch Email and Attachment Preview</h1>
      <p class="muted">Source PST: ${esc(resolve(root, 'Outlook.pst'))}</p>
      <p class="muted">Generated: ${esc(new Date().toISOString())}</p>
      <p class="muted">Branches listed: ${branches.length}</p>
    </div>
    <div class="layout">
      <aside class="sidebar">
        <input id="branch-search" class="search" type="search" placeholder="Search branch, town, province..." />
        <div class="branch-list" id="branch-list">${branchButtons}</div>
        <p class="hint">Click a branch to load details and matched projects.</p>
      </aside>
      <main class="panel" id="branch-panels">
        ${branchPanels}
      </main>
    </div>
  </div>
  <script>
    const branchButtons = [...document.querySelectorAll('[data-branch-button]')];
    const branchPanels = [...document.querySelectorAll('[data-branch-panel]')];
    const searchInput = document.getElementById('branch-search');
    const firstBranchId = ${JSON.stringify(firstBranchId)};

    function setActiveBranch(branchId) {
      let found = false;

      for (const panel of branchPanels) {
        const isActive = panel.id === branchId;
        panel.hidden = !isActive;
        if (isActive) found = true;
      }

      for (const button of branchButtons) {
        button.classList.toggle('active', button.dataset.branchId === branchId);
      }

      return found;
    }

    function firstVisibleBranchId() {
      const visible = branchButtons.find((button) => button.style.display !== 'none');
      return visible ? visible.dataset.branchId : '';
    }

    for (const button of branchButtons) {
      button.addEventListener('click', () => {
        setActiveBranch(button.dataset.branchId || '');
      });
    }

    searchInput.addEventListener('input', (event) => {
      const term = String(event.target.value || '').trim().toLowerCase();

      for (const button of branchButtons) {
        const hay = String(button.dataset.branchSearch || '').toLowerCase();
        button.style.display = !term || hay.includes(term) ? '' : 'none';
      }

      const active = branchButtons.find((b) => b.classList.contains('active') && b.style.display !== 'none');
      if (!active) {
        const fallback = firstVisibleBranchId();
        setActiveBranch(fallback);
      }
    });

    const chosenId = firstVisibleBranchId() || firstBranchId;
    setActiveBranch(chosenId);
  </script>
</body>
</html>`;

  writeFileSync(outHtmlPath, html, 'utf8');
  writeFileSync(publicOutHtmlPath, html, 'utf8');
  console.log(`Generated webpage: ${outHtmlPath}`);
  console.log(`Generated webpage for Pages: ${publicOutHtmlPath}`);
  console.log(`Generated preview pages in: ${previewsDir}`);
  console.log(`Generated preview pages for Pages: ${publicPreviewsDir}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
