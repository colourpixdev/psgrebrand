import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Search, Shield } from 'lucide-react';
import { getProjects } from '../services/portalService';
import { getAllBranches } from '../services/branchService';
import { useAuth } from '../contexts/AuthContext';
import { can, filterProjectsForUser } from '../utils/permissions';
import type { Project, ProjectStatus, Role } from '../types/domain';

type ReportType = 'single-branch-detail' | 'multi-branch-overview' | 'operational-blockers';

const statusLabels: Record<ProjectStatus, string> = {
  completed: 'Completed',
  busy: 'Busy',
  in_progress: 'In progress',
  awaiting_approval: 'Awaiting approval',
  delayed: 'Delayed',
  on_hold: 'On hold',
  cancelled: 'Cancelled',
};

const reportTypes: Array<{ value: ReportType; label: string; description: string }> = [
  { value: 'single-branch-detail', label: 'Single branch report', description: 'A complete branch report with all projects, assignees, tasks, files, and journal activity.' },
  { value: 'multi-branch-overview', label: 'Multi-branch overview', description: 'A wide portfolio report for meetings across all branches and teams.' },
  { value: 'operational-blockers', label: 'Operational blockers and ownership', description: 'Shows stalled work, missing ownership, quote blockers, and overdue tasks for action planning.' },
];

const roleReportGuidance: Record<Role, string[]> = {
  colourpix_admin: ['Operational blockers and ownership', 'Single branch report', 'Multi-branch overview'],
  psg_head_office: ['Single branch report', 'Operational blockers and ownership', 'Multi-branch overview'],
  psg_branch_manager: ['Single branch report', 'My assigned tasks view', 'Status follow-up list'],
  sign_company: ['My installation tasks', 'Operational blockers and ownership', 'Single branch report'],
};

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function includesText(value: string, query: string) {
  return value.toLowerCase().includes(query);
}

function isPastDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp < Date.now() : false;
}

function isOperationalBlocker(project: Project) {
  const pendingTasks = project.tasks.filter((task) => !task.completed);
  const missingManager = !project.manager || project.manager.toLowerCase() === 'not captured';
  const awaitingQuoteOrApproval = ['Quotation Requested', 'Awaiting Approval'].includes(project.currentStage);
  return project.status === 'delayed'
    || project.status === 'on_hold'
    || awaitingQuoteOrApproval
    || isPastDate(project.targetDate)
    || missingManager
    || pendingTasks.length >= 4;
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

function toCsvCell(value: string | number) {
  const normalized = String(value ?? '').replace(/\r?\n|\r/g, ' ');
  return `"${normalized.replace(/"/g, '""')}"`;
}

function projectCsvRows(projects: Project[]) {
  return projects.map((project) => {
    const pendingTasks = project.tasks.filter((task) => !task.completed).length;
    const participants = project.tasks.flatMap((task) => task.assignees?.map((assignee) => `${assignee.name} (${assignee.designation})`) ?? []).join('; ');
    return [
      project.id,
      project.branch,
      project.projectTypeName,
      project.town,
      project.province,
      project.manager,
      project.currentStage,
      statusLabels[project.status],
      `${project.progress}%`,
      project.targetDate,
      pendingTasks,
      project.files.length,
      participants,
      project.updatedAt,
    ];
  });
}

function downloadExcel(projects: Project[], reportName: string) {
  const headers = ['Project ID', 'Branch', 'Type', 'Town', 'Province', 'Manager', 'Stage', 'Status', 'Progress', 'Target', 'Pending tasks', 'Files', 'Participants', 'Updated'];
  const rows = projectCsvRows(projects);
  const csv = ['\uFEFF', headers.map(toCsvCell).join(','), ...rows.map((row) => row.map(toCsvCell).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${formatFileName(reportName)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function branchDetailHtml(projects: Project[], reportName: string, branchName: string) {
  const cards = projects.map((project) => {
    const pendingTasks = project.tasks.filter((task) => !task.completed);
    const participants = project.tasks.flatMap((task) => task.assignees ?? []);

    return `
      <section class="card">
        <h2>${escapeHtml(project.id)} - ${escapeHtml(project.projectTypeName)}</h2>
        <p><strong>Stage:</strong> ${escapeHtml(project.currentStage)} | <strong>Status:</strong> ${escapeHtml(statusLabels[project.status])} | <strong>Progress:</strong> ${escapeHtml(project.progress)}%</p>
        <p><strong>Address:</strong> ${escapeHtml(project.physicalAddress || `${project.town}, ${project.province}`)}</p>
        <p><strong>Manager:</strong> ${escapeHtml(project.manager || 'Not assigned')}</p>
        <p><strong>Pending tasks:</strong> ${escapeHtml(pendingTasks.length)}</p>
        <ul>
          ${pendingTasks.map((task) => `<li>${escapeHtml(task.text)} ${task.assignees?.length ? `- ${escapeHtml(task.assignees.map((assignee) => `${assignee.name} (${assignee.designation})`).join(', '))}` : ''}</li>`).join('') || '<li>No pending tasks</li>'}
        </ul>
        <p><strong>Participants:</strong> ${participants.length ? escapeHtml(participants.map((participant) => `${participant.name} (${participant.designation})`).join(', ')) : 'None listed'}</p>
        <p><strong>Files:</strong> ${project.files.length ? escapeHtml(project.files.map((file) => file.name).join(', ')) : 'No files uploaded'}</p>
        <p><strong>Latest journal items:</strong></p>
        <ul>
          ${(project.activity.slice(0, 5).map((item) => `<li>${escapeHtml(item.title)} - ${escapeHtml(item.detail)}</li>`).join('')) || '<li>No journal entries</li>'}
        </ul>
      </section>
    `;
  }).join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(reportName)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 28px; }
          h1 { margin-bottom: 2px; }
          .meta { color: #4b5563; margin-bottom: 20px; }
          .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; margin-bottom: 14px; }
          ul { margin: 8px 0 0 16px; }
          li { margin: 4px 0; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(reportName)}</h1>
        <p class="meta">Branch: ${escapeHtml(branchName)} | Projects: ${escapeHtml(projects.length)} | Generated: ${escapeHtml(new Date().toLocaleDateString())}</p>
        ${cards}
        <script>window.addEventListener('load', () => setTimeout(() => window.print(), 150));</script>
      </body>
    </html>
  `;
}

function openPdfReport(projects: Project[], reportName: string, reportType: ReportType, selectedBranchName: string) {
  const html = reportType === 'single-branch-detail'
    ? branchDetailHtml(projects, reportName, selectedBranchName)
    : `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(reportName)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
          table { border-collapse: collapse; width: 100%; font-size: 11px; }
          th, td { border: 1px solid #d1d5db; padding: 7px; text-align: left; vertical-align: top; }
          th { background: #e5e7eb; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(reportName)}</h1>
        <p>${projects.length} project${projects.length === 1 ? '' : 's'} exported on ${new Date().toLocaleDateString()}</p>
        <table>
          <thead><tr>${['Project ID', 'Branch', 'Type', 'Town', 'Province', 'Manager', 'Stage', 'Status', 'Progress', 'Target'].map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
          <tbody>${projects.map((project) => `<tr>${[
      project.id,
      project.branch,
      project.projectTypeName,
      project.town,
      project.province,
      project.manager,
      project.currentStage,
      statusLabels[project.status],
      `${project.progress}%`,
      project.targetDate,
    ].map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <script>window.addEventListener('load', () => setTimeout(() => window.print(), 150));</script>
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function ReportsPage() {
  const { user, roleLabel } = useAuth();
  const [reportType, setReportType] = useState<ReportType>('single-branch-detail');
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all');
  const [branchName, setBranchName] = useState('all');
  const [query, setQuery] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: getAllBranches,
  });

  const scopedProjects = useMemo(() => filterProjectsForUser(projects, user), [projects, user]);
  const selectedReport = reportTypes.find((report) => report.value === reportType) ?? reportTypes[0];
  const guidance = user ? roleReportGuidance[user.role] : ['Single branch report', 'Multi-branch overview', 'Operational blockers and ownership'];
  const normalizedQuery = query.trim().toLowerCase();
  const availableBranches = useMemo(() => uniqueSorted(branches.map((branch) => branch.name)), [branches]);

  const filteredProjects = useMemo(() => scopedProjects.filter((project) => {
    const matchesSearch = !normalizedQuery || [
      project.id,
      project.branch,
      project.town,
      project.province,
      project.manager,
      project.installer,
      project.currentStage,
      project.status,
    ].some((value) => includesText(value, normalizedQuery));

    if (!matchesSearch) {
      return false;
    }

    if (status !== 'all' && project.status !== status) {
      return false;
    }

    if (branchName !== 'all' && project.branch !== branchName) {
      return false;
    }

    if (reportType === 'operational-blockers') {
      return isOperationalBlocker(project);
    }

    return true;
  }), [branchName, normalizedQuery, reportType, scopedProjects, status]);

  const displayedProjects = useMemo(() => {
    if (reportType === 'single-branch-detail') {
      if (branchName === 'all') {
        return [];
      }

      return filteredProjects;
    }

    return filteredProjects;
  }, [branchName, filteredProjects, reportType]);

  const canExportReports = can(user, 'export_reports');
  const exportProjects = displayedProjects.length > 0 ? displayedProjects : scopedProjects;
  const reportName = `${selectedReport.label} report`;
  const delayedCount = displayedProjects.filter((project) => project.status === 'delayed' || project.status === 'on_hold').length;
  const completedCount = displayedProjects.filter((project) => project.status === 'completed').length;
  const averageProgress = displayedProjects.length
    ? Math.round(displayedProjects.reduce((sum, project) => sum + project.progress, 0) / displayedProjects.length)
    : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Reports</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Generate branch-first reports that are practical for daily operations and management meetings.</p>
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
              <p className="mt-1 text-sm text-slate-400">Fast exports for day-to-day tracking and review meetings.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {guidance.map((item) => <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">{item}</div>)}
          </div>
        </div>

        <div className="grid gap-3 rounded-[2rem] border border-white/10 bg-slate-950/50 p-5 shadow-soft sm:grid-cols-3">
          <div>
            <p className="text-sm text-slate-400">Matching projects</p>
            <p className="mt-2 text-3xl font-semibold text-white">{displayedProjects.length}</p>
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
            Branch
            <select value={branchName} onChange={(event) => setBranchName(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
              <option value="all">All branches</option>
              {availableBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-300">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus | 'all')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
              <option value="all">All statuses</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-300 lg:col-span-4">
            Search
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Branch, town, manager, project ID..."
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 py-3 pl-11 pr-4 text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50"
              />
            </div>
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-slate-400">{selectedReport.description}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={!canExportReports || (reportType === 'single-branch-detail' && branchName === 'all')} onClick={() => downloadExcel(exportProjects, reportName)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
              <FileText className="h-4 w-4" />
              Excel report
            </button>
            <button type="button" disabled={!canExportReports || (reportType === 'single-branch-detail' && branchName === 'all')} onClick={() => openPdfReport(exportProjects, reportName, reportType, branchName)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
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
            <p className="mt-1 text-sm text-slate-400">{reportName} with {displayedProjects.length} matching project{displayedProjects.length === 1 ? '' : 's'}.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="px-5 py-4 font-medium">Project</th>
                <th className="px-5 py-4 font-medium">Branch</th>
                <th className="px-5 py-4 font-medium">Type</th>
                <th className="px-5 py-4 font-medium">Location</th>
                <th className="px-5 py-4 font-medium">Manager</th>
                <th className="px-5 py-4 font-medium">Stage</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Target</th>
                <th className="px-5 py-4 font-medium">Progress</th>
                <th className="px-5 py-4 font-medium">Outstanding tasks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {isLoading ? (
                <tr><td colSpan={10} className="px-5 py-8 text-center text-slate-400">Loading projects...</td></tr>
              ) : displayedProjects.length > 0 ? displayedProjects.map((project) => (
                <tr key={project.id} className="text-slate-300 transition hover:bg-white/5">
                  <td className="px-5 py-4 text-white"><Link to={`/projects/${project.id}`} className="font-semibold text-sky-100 hover:text-sky-200">{project.id}</Link></td>
                  <td className="px-5 py-4"><Link to="/branches" className="hover:text-sky-100">{project.branch}</Link></td>
                  <td className="px-5 py-4">{project.projectTypeName}</td>
                  <td className="px-5 py-4">{project.town}, {project.province}</td>
                  <td className="px-5 py-4">{project.manager}</td>
                  <td className="px-5 py-4">{project.currentStage}</td>
                  <td className="px-5 py-4">{statusLabels[project.status]}</td>
                  <td className="px-5 py-4">{project.targetDate}</td>
                  <td className="px-5 py-4">{project.progress}%</td>
                  <td className="px-5 py-4">{project.tasks.filter((task) => !task.completed).length}</td>
                </tr>
              )) : (
                <tr><td colSpan={10} className="px-5 py-8 text-center text-slate-400">{reportType === 'single-branch-detail' && branchName === 'all' ? 'Select a specific branch for a single-branch report.' : 'No projects match the selected filters.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
