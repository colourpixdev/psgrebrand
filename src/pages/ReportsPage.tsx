import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Search, Shield } from 'lucide-react';
import { getProjects } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { timelineStages } from '../constants/portal';
import { can, filterProjectsForUser } from '../utils/permissions';
import type { Project, ProjectStatus, Role } from '../types/domain';

type ReportType =
  | 'workspace-summary'
  | 'completed-projects'
  | 'delayed-projects'
  | 'outstanding-quotes'
  | 'awaiting-approval'
  | 'installation-schedule'
  | 'photos-signoff'
  | 'installer-performance';

type DateField = 'targetDate' | 'installationDate' | 'completionDate' | 'updatedAt';

const statusLabels: Record<ProjectStatus, string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  awaiting_approval: 'Awaiting approval',
  delayed: 'Delayed',
  on_hold: 'On hold',
  cancelled: 'Cancelled',
};

const reportTypes: Array<{ value: ReportType; label: string; description: string }> = [
  { value: 'workspace-summary', label: 'Workspace summary', description: 'All sites with progress, stage, status, delivery partner, project type, and key dates.' },
  { value: 'completed-projects', label: 'Completed projects', description: 'Completed project records for handover, signoff, and invoice checks.' },
  { value: 'delayed-projects', label: 'Delayed and at-risk', description: 'Delayed, on-hold, or overdue projects needing escalation.' },
  { value: 'outstanding-quotes', label: 'Outstanding quotes', description: 'Quotation requested or received items waiting for the next commercial step.' },
  { value: 'awaiting-approval', label: 'Awaiting approval', description: 'Artwork, quotation, PO, and client approval bottlenecks.' },
  { value: 'installation-schedule', label: 'Delivery schedule', description: 'Delivery partners, sites, towns, and planned delivery or installation dates.' },
  { value: 'photos-signoff', label: 'Evidence and signoff', description: 'Delivered projects that still need photos, client signoff, or closeout.' },
  { value: 'installer-performance', label: 'Delivery partner performance', description: 'Partner workload, completed jobs, delays, and average progress.' },
];

const dateFields: Array<{ value: DateField; label: string }> = [
  { value: 'targetDate', label: 'Target date' },
  { value: 'installationDate', label: 'Installation date' },
  { value: 'completionDate', label: 'Completion date' },
  { value: 'updatedAt', label: 'Last updated' },
];

const roleReportGuidance: Record<Role, string[]> = {
  colourpix_admin: ['Full workspace summary', 'Delayed and at-risk projects', 'Delivery partner performance', 'Outstanding quotes and approvals'],
  psg_head_office: ['Province and site progress', 'Awaiting approval items', 'Completed handover reports', 'Delayed escalation list'],
  psg_branch_manager: ['My site status', 'Approval and signoff actions', 'Delivery schedule', 'Evidence outstanding'],
  sign_company: ['Assigned delivery schedule', 'Site survey pipeline', 'Evidence and signoff outstanding', 'Delayed jobs by delivery partner'],
};

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function includesText(value: string, query: string) {
  return value.toLowerCase().includes(query);
}

function projectMatchesReportType(project: Project, reportType: ReportType) {
  switch (reportType) {
    case 'completed-projects':
      return project.status === 'completed' || project.currentStage === 'Completed';
    case 'delayed-projects':
      return project.status === 'delayed' || project.status === 'on_hold' || isPastDate(project.targetDate);
    case 'outstanding-quotes':
      return ['Quotation Requested', 'Quotation Received'].includes(project.currentStage);
    case 'awaiting-approval':
      return project.status === 'awaiting_approval' || ['Artwork Sent', 'Awaiting Approval', 'Approved', 'PO Issued'].includes(project.currentStage);
    case 'installation-schedule':
      return ['Installation Scheduled', 'Installation In Progress', 'Installed'].includes(project.currentStage);
    case 'photos-signoff':
      return ['Installed', 'Photos Uploaded', 'Client Signoff'].includes(project.currentStage);
    case 'installer-performance':
    case 'workspace-summary':
    default:
      return true;
  }
}

function isPastDate(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return timestamp < Date.now();
}

function isWithinDateRange(project: Project, dateField: DateField, fromDate: string, toDate: string) {
  if (!fromDate && !toDate) {
    return true;
  }

  const value = Date.parse(project[dateField]);
  if (Number.isNaN(value)) {
    return false;
  }

  const from = fromDate ? Date.parse(fromDate) : Number.NEGATIVE_INFINITY;
  const to = toDate ? Date.parse(`${toDate}T23:59:59`) : Number.POSITIVE_INFINITY;

  return value >= from && value <= to;
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatFileName(reportName: string) {
  const date = new Date().toISOString().slice(0, 10);
  return `${reportName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${date}`;
}

function buildReportTable(projects: Project[], reportName: string) {
  const headers = ['Project ID', 'Site', 'Project Type', 'Town', 'Province', 'Manager', 'Delivery Partner', 'Stage', 'Status', 'Progress', 'Target', 'Delivery', 'Completed', 'Updated'];
  const rows = projects.map((project) => [
    project.id,
    project.branch,
    project.projectTypeName,
    project.town,
    project.province,
    project.manager,
    project.installer,
    project.currentStage,
    statusLabels[project.status],
    `${project.progress}%`,
    project.targetDate,
    project.installationDate,
    project.completionDate,
    project.updatedAt,
  ]);

  return `
    <table>
      <caption>${escapeHtml(reportName)}</caption>
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;
}

function downloadExcel(projects: Project[], reportName: string) {
  const table = buildReportTable(projects, reportName);
  const workbook = `<!doctype html><html><head><meta charset="utf-8" /></head><body>${table}</body></html>`;
  const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${formatFileName(reportName)}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function openPdfReport(projects: Project[], reportName: string) {
  const reportWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!reportWindow) {
    return;
  }

  reportWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(reportName)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
          h1 { font-size: 22px; margin: 0 0 6px; }
          p { color: #4b5563; margin: 0 0 20px; }
          table { border-collapse: collapse; width: 100%; font-size: 11px; }
          caption { text-align: left; font-weight: 700; margin-bottom: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 7px; text-align: left; vertical-align: top; }
          th { background: #e5e7eb; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(reportName)}</h1>
        <p>${projects.length} project${projects.length === 1 ? '' : 's'} exported on ${new Date().toLocaleDateString()}</p>
        ${buildReportTable(projects, reportName)}
        <script>window.addEventListener('load', () => window.print());</script>
      </body>
    </html>
  `);
  reportWindow.document.close();
}

export function ReportsPage() {
  const { user, roleLabel } = useAuth();
  const [reportType, setReportType] = useState<ReportType>('workspace-summary');
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all');
  const [stage, setStage] = useState('all');
  const [province, setProvince] = useState('all');
  const [installer, setInstaller] = useState('all');
  const [dateField, setDateField] = useState<DateField>('targetDate');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [query, setQuery] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  const scopedProjects = useMemo(() => filterProjectsForUser(projects, user), [projects, user]);
  const selectedReport = reportTypes.find((report) => report.value === reportType) ?? reportTypes[0];
  const guidance = user ? roleReportGuidance[user.role] : ['Workspace summary', 'Delayed projects', 'Completed projects', 'Delivery schedule'];
  const normalizedQuery = query.trim().toLowerCase();

  const filterOptions = useMemo(() => ({
    provinces: uniqueSorted(scopedProjects.map((project) => project.province)),
    installers: uniqueSorted(scopedProjects.map((project) => project.installer)),
  }), [scopedProjects]);

  const filteredProjects = useMemo(() => scopedProjects.filter((project) => {
    const matchesSearch = !normalizedQuery || [
      project.id,
      project.branch,
      project.town,
      project.province,
      project.manager,
      project.managerEmail,
      project.installer,
      project.designer,
      project.currentStage,
      project.status,
    ].some((value) => includesText(value, normalizedQuery));

    return projectMatchesReportType(project, reportType)
      && (status === 'all' || project.status === status)
      && (stage === 'all' || project.currentStage === stage)
      && (province === 'all' || project.province === province)
      && (installer === 'all' || project.installer === installer)
      && isWithinDateRange(project, dateField, fromDate, toDate)
      && matchesSearch;
  }), [dateField, fromDate, installer, normalizedQuery, scopedProjects, province, reportType, stage, status, toDate]);
  const canExportReports = can(user, 'export_reports');

  const reportName = `${selectedReport.label} report`;
  const delayedCount = filteredProjects.filter((project) => project.status === 'delayed' || project.status === 'on_hold').length;
  const completedCount = filteredProjects.filter((project) => project.status === 'completed').length;
  const averageProgress = filteredProjects.length
    ? Math.round(filteredProjects.reduce((sum, project) => sum + project.progress, 0) / filteredProjects.length)
    : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Reports</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Pull practical workspace reports by site, province, delivery partner, project type, stage, status, search term, and date range. Exports are Excel or PDF only.
            </p>
          </div>
          <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            <p className="font-medium">{roleLabel}</p>
            <p className="mt-1 text-sky-100/75">{user?.branch ? `${user.branch} scoped view` : 'Workspace reporting view'}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-5 shadow-soft">
          <div className="flex items-start gap-3">
            <Shield className="mt-1 h-5 w-5 text-emerald-300" />
            <div>
              <h3 className="text-lg font-semibold text-white">Useful reports for this role</h3>
              <p className="mt-1 text-sm text-slate-400">Common client, workspace owner, and delivery-partner reporting pulls.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {guidance.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">{item}</div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 rounded-[2rem] border border-white/10 bg-slate-950/50 p-5 shadow-soft sm:grid-cols-3">
          <div>
            <p className="text-sm text-slate-400">Matching projects</p>
            <p className="mt-2 text-3xl font-semibold text-white">{filteredProjects.length}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Completed</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-200">{completedCount}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">At risk</p>
            <p className="mt-2 text-3xl font-semibold text-amber-200">{delayedCount}</p>
          </div>
          <div className="sm:col-span-3">
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" style={{ width: `${averageProgress}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-400">Average progress: {averageProgress}%</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-5 shadow-soft">
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="grid gap-2 text-sm text-slate-300 lg:col-span-2">
            Report type
            <select value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
              {reportTypes.map((report) => <option key={report.value} value={report.value}>{report.label}</option>)}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-300">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus | 'all')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
              <option value="all">All statuses</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-300">
            Stage
            <select value={stage} onChange={(event) => setStage(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
              <option value="all">All stages</option>
              {timelineStages.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-300">
            Province
            <select value={province} onChange={(event) => setProvince(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
              <option value="all">All provinces</option>
              {filterOptions.provinces.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-300">
            Delivery partner
            <select value={installer} onChange={(event) => setInstaller(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
              <option value="all">All delivery partners</option>
              {filterOptions.installers.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-300">
            Date field
            <select value={dateField} onChange={(event) => setDateField(event.target.value as DateField)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
              {dateFields.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-300">
            From
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50" />
          </label>

          <label className="grid gap-2 text-sm text-slate-300">
            To
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50" />
          </label>

          <label className="grid gap-2 text-sm text-slate-300 lg:col-span-2">
            Search
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Site, town, manager, delivery partner, project ID..."
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 py-3 pl-11 pr-4 text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50"
              />
            </div>
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-slate-400">{selectedReport.description}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={!canExportReports || !filteredProjects.length} onClick={() => downloadExcel(filteredProjects, reportName)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
              <FileText className="h-4 w-4" />
              Excel report
            </button>
            <button type="button" disabled={!canExportReports || !filteredProjects.length} onClick={() => openPdfReport(filteredProjects, reportName)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
              <FileText className="h-4 w-4" />
              PDF report
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/50 shadow-soft">
        <div className="flex flex-col gap-2 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Report preview</h3>
            <p className="mt-1 text-sm text-slate-400">{reportName} with {filteredProjects.length} matching project{filteredProjects.length === 1 ? '' : 's'}.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="px-5 py-4 font-medium">Project</th>
                <th className="px-5 py-4 font-medium">Site</th>
                <th className="px-5 py-4 font-medium">Type</th>
                <th className="px-5 py-4 font-medium">Location</th>
                <th className="px-5 py-4 font-medium">Manager</th>
                <th className="px-5 py-4 font-medium">Delivery partner</th>
                <th className="px-5 py-4 font-medium">Stage</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Target</th>
                <th className="px-5 py-4 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {isLoading ? (
                <tr><td colSpan={10} className="px-5 py-8 text-center text-slate-400">Loading projects...</td></tr>
              ) : filteredProjects.length > 0 ? filteredProjects.map((project) => (
                <tr key={project.id} className="text-slate-300">
                  <td className="px-5 py-4 text-white">{project.id}</td>
                  <td className="px-5 py-4">{project.branch}</td>
                  <td className="px-5 py-4">{project.projectTypeName}</td>
                  <td className="px-5 py-4">{project.town}, {project.province}</td>
                  <td className="px-5 py-4">{project.manager}</td>
                  <td className="px-5 py-4">{project.installer}</td>
                  <td className="px-5 py-4">{project.currentStage}</td>
                  <td className="px-5 py-4">{statusLabels[project.status]}</td>
                  <td className="px-5 py-4">{project.targetDate}</td>
                  <td className="px-5 py-4">{project.progress}%</td>
                </tr>
              )) : (
                <tr><td colSpan={10} className="px-5 py-8 text-center text-slate-400">No projects match the selected report filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
