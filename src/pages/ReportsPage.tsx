import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Search } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { getProjects } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { can, filterProjectsForUser } from '../utils/permissions';
import { isTaskOutstanding } from '../utils/taskStatus';
import type { Project, ProjectStatus } from '../types/domain';

type ReportType = 'single-branch-detail' | 'multi-branch-overview' | 'operational-blockers';

const statusLabels: Record<ProjectStatus, string> = {
  pending: 'Pending',
  open: 'Started',
  completed: 'Completed',
  busy: 'Busy',
  in_progress: 'In progress',
  awaiting_approval: 'Awaiting approval',
  delayed: 'Delayed',
  on_hold: 'On hold',
  cancelled: 'Cancelled',
};

const reportTypes: Array<{ value: ReportType; label: string; description: string }> = [
  { value: 'multi-branch-overview', label: 'PSG National Rebrand Rollout Report', description: 'A clear view of every permitted branch, its current stage, status, and target date.' },
];

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
  const pendingTasks = project.tasks.filter(isTaskOutstanding);
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

function projectReportRows(projects: Project[]) {
  return projects.map((project) => {
    const pendingTasks = project.tasks.filter(isTaskOutstanding).length;
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
      project.targetDate,
      pendingTasks,
      project.files.length,
      participants,
      project.updatedAt,
    ];
  });
}

function downloadExcel(projects: Project[], reportName: string) {
  const headers = ['Branch reference', 'Branch', 'Type', 'Town', 'Province', 'Manager', 'Stage', 'Status', 'Target', 'Pending tasks', 'Files', 'Participants', 'Updated'];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...projectReportRows(projects)]);
  worksheet['!cols'] = [
    { wch: 18 }, { wch: 30 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 34 },
    { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 42 }, { wch: 24 },
  ];
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  worksheet['!autofilter'] = { ref: `A1:M${projects.length + 1}` };
  const headerStyle = { fill: { fgColor: { rgb: '0F4C5C' } }, font: { bold: true, color: { rgb: 'FFFFFF' } }, alignment: { vertical: 'center', wrapText: true } };
  headers.forEach((_, index) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: index })];
    if (cell) cell.s = headerStyle;
  });
  projectReportRows(projects).forEach((_, rowIndex) => {
    headers.forEach((_, columnIndex) => {
      const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex })];
      if (cell) {
        cell.s = { fill: { fgColor: { rgb: rowIndex % 2 === 0 ? 'F1F7F8' : 'FFFFFF' } }, alignment: { vertical: 'top', wrapText: columnIndex === 12 } };
      }
    });
  });
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rollout overview');
  XLSX.writeFile(workbook, `${formatFileName(reportName)}.xlsx`, { bookType: 'xlsx' });
}

function branchDetailHtml(projects: Project[], reportName: string, branchName: string, userName?: string) {
  const cards = projects.map((project) => {
    const pendingTasks = project.tasks.filter(isTaskOutstanding);
    const participants = project.tasks.flatMap((task) => task.assignees ?? []);
    // filter out current user's activity when generating reports
    const activityItems = (userName
      ? project.activity.filter((item) => {
        const normalized = userName.trim().toLowerCase();
        const title = (item.title ?? '').toLowerCase();
        const detail = (item.detail ?? '').toLowerCase();
        return !title.includes(normalized) && !detail.includes(normalized);
      })
      : project.activity
    ).slice(0, 5);

    return `
      <section class="card">
        <h2>${escapeHtml(project.id)} - ${escapeHtml(project.projectTypeName)}</h2>
        <p><strong>Stage:</strong> ${escapeHtml(project.currentStage)} | <strong>Status:</strong> ${escapeHtml(statusLabels[project.status])}</p>
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
          ${(activityItems.map((item) => `<li>${escapeHtml(item.title)} - ${escapeHtml(item.detail)}</li>`).join('')) || '<li>No journal entries</li>'}
        </ul>
      </section>
    `;
  }).join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>PSG Rebrand Report</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 28px; }
          .meta { color: #4b5563; margin-bottom: 20px; }
          .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; margin-bottom: 14px; }
          ul { margin: 8px 0 0 16px; }
          li { margin: 4px 0; }
        </style>
      </head>
      <body>
        <p class="meta">Branch: ${escapeHtml(branchName)} | Projects: ${escapeHtml(projects.length)} | Generated: ${escapeHtml(new Date().toLocaleDateString())}</p>
        ${cards}
        <script>window.addEventListener('load', () => setTimeout(() => window.print(), 150));</script>
      </body>
    </html>
  `;
}

function openPdfReport(projects: Project[], reportName: string, reportType: ReportType, selectedBranchName: string, userName?: string) {
  const html = reportType === 'single-branch-detail'
    ? branchDetailHtml(projects, reportName, selectedBranchName, userName)
    : `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>PSG Rebrand Report</title>
        <style>
          @page { size: A4 landscape; margin: 14mm; }
          body { font-family: Arial, sans-serif; color: #173042; margin: 0; background: #f4f8f9; }
          .report { background: white; padding: 24px; }
          .masthead { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 4px solid #0f766e; padding-bottom: 14px; margin-bottom: 20px; }
          h1 { margin: 0; color: #0f4c5c; font-size: 24px; }
          .meta { color: #5b7080; font-size: 12px; margin: 5px 0 0; }
          .summary { display: flex; gap: 10px; margin-bottom: 18px; }
          .metric { flex: 1; border: 1px solid #c9dfe0; background: #eef8f7; padding: 10px 12px; }
          .metric strong { display: block; color: #0f766e; font-size: 18px; }
          table { border-collapse: collapse; width: 100%; font-size: 10px; }
          th, td { border-bottom: 1px solid #d8e4e7; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #0f4c5c; color: white; font-size: 10px; }
          tr:nth-child(even) { background: #f1f7f8; }
          tr { page-break-inside: avoid; }
          .footer { margin-top: 18px; color: #718391; font-size: 10px; }
        </style>
      </head>
      <body><main class="report">
        <header class="masthead"><div><h1>${escapeHtml(reportName)}</h1><p class="meta">PSG Rebrand rollout overview</p></div><p class="meta">Generated ${escapeHtml(new Date().toLocaleDateString())}</p></header>
        <div class="summary"><div class="metric"><strong>${projects.length}</strong>Projects</div><div class="metric"><strong>${projects.filter((project) => project.status === 'completed').length}</strong>Completed</div><div class="metric"><strong>${projects.filter((project) => project.status !== 'completed').length}</strong>Outstanding</div></div>
        <table>
          <thead><tr>${['Project ID', 'Branch', 'Type', 'Town', 'Province', 'Manager', 'Stage', 'Status', 'Target'].map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
          <tbody>${projects.map((project) => `<tr>${[
      project.id,
      project.branch,
      project.projectTypeName,
      project.town,
      project.province,
      project.manager,
      project.currentStage,
      statusLabels[project.status],
      project.targetDate,
    ].map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table><p class="footer">${projects.length} project${projects.length === 1 ? '' : 's'} included in this report.</p></main>
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
  const { user } = useAuth();
  const [reportType, setReportType] = useState<ReportType>('multi-branch-overview');
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all');
  const [branchName, setBranchName] = useState('all');
  const [province, setProvince] = useState('all');
  const [completion, setCompletion] = useState<'all' | 'completed' | 'outstanding'>('all');
  const [query, setQuery] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });
  const scopedProjects = useMemo(() => filterProjectsForUser(projects, user), [projects, user]);
  const selectedReport = reportTypes.find((report) => report.value === reportType) ?? reportTypes[0];
  const normalizedQuery = query.trim().toLowerCase();
  const availableBranches = useMemo(() => uniqueSorted(scopedProjects.map((project) => project.branch)), [scopedProjects]);
  const availableProvinces = useMemo(() => uniqueSorted(scopedProjects.map((project) => project.province)), [scopedProjects]);
  const branchSuggestions = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    return availableBranches.filter((branch) => branch.toLowerCase().includes(normalizedQuery)).slice(0, 8);
  }, [availableBranches, normalizedQuery]);

  const filteredProjects = useMemo(() => scopedProjects.filter((project) => {
    const matchesSearch = !normalizedQuery || [
      project.id,
      project.branch,
      project.town,
      project.province,
      project.manager,
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

    if (province !== 'all' && project.province !== province) {
      return false;
    }

    if (completion === 'completed' && project.status !== 'completed') {
      return false;
    }

    if (completion === 'outstanding' && project.status === 'completed') {
      return false;
    }

    if (reportType === 'operational-blockers') {
      return isOperationalBlocker(project);
    }

    return true;
  }), [branchName, completion, normalizedQuery, province, reportType, scopedProjects, status]);

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

  return (
    <div className="space-y-6">
      <section className="border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-semibold text-slate-900">PSG National Rebrand Rollout Report</h2>
        <p className="mt-2 text-sm text-slate-600">See stage, status and dates across the national branch rollout.</p>
      </section>

      <section className="grid gap-4">
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
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-5 shadow-soft">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="grid gap-2 text-sm text-slate-300">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus | 'all')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
              <option value="all">All statuses</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-300">
            Province
            <select value={province} onChange={(event) => setProvince(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
              <option value="all">All provinces</option>
              {availableProvinces.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-300">
            Completion
            <select value={completion} onChange={(event) => setCompletion(event.target.value as typeof completion)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
              <option value="all">All projects</option>
              <option value="outstanding">Outstanding</option>
              <option value="completed">Completed</option>
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
                placeholder="Branch, town, manager, branch reference..."
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 py-3 pl-11 pr-4 text-white outline-none placeholder:text-slate-300 focus:border-sky-400/50"
              />
            </div>

            {branchSuggestions.length > 0 ? (
              <div className="mt-3 grid gap-2 text-sm text-slate-300">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Branch suggestions</p>
                <div className="grid gap-2 rounded-3xl border border-white/10 bg-slate-950/80 p-3">
                  {branchSuggestions.map((branch) => (
                    <button
                      key={branch}
                      type="button"
                      onClick={() => {
                        setQuery(branch);
                        setBranchName(branch);
                      }}
                      className="w-full rounded-2xl px-3 py-2 text-left text-slate-100 transition hover:bg-slate-900/70"
                    >
                      {branch}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-slate-400">{selectedReport.description}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={!canExportReports} onClick={() => downloadExcel(exportProjects, reportName)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
              <FileText className="h-4 w-4" />
              Excel report
            </button>
            <button type="button" disabled={!canExportReports} onClick={() => openPdfReport(exportProjects, reportName, reportType, branchName, user?.name)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
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
                <th className="px-5 py-4 font-medium">Branch</th>
                <th className="px-5 py-4 font-medium">Province</th>
                <th className="px-5 py-4 font-medium">Stage</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Target date</th>
                <th className="px-5 py-4 font-medium">Completion date</th>
                <th className="px-5 py-4 font-medium">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {isLoading ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">Loading projects...</td></tr>
              ) : displayedProjects.length > 0 ? displayedProjects.map((project) => (
                <tr key={project.id} className="text-slate-300 transition hover:bg-white/5">
                  <td className="px-5 py-4 text-white"><Link to={`/projects/${project.id}`} className="font-medium hover:text-sky-100">{project.branch}</Link></td>
                  <td className="px-5 py-4">{project.province}</td>
                  <td className="px-5 py-4">{project.currentStage}</td>
                  <td className="px-5 py-4">{statusLabels[project.status]}</td>
                  <td className="px-5 py-4">{project.targetDate || 'Not set'}</td>
                  <td className="px-5 py-4">{project.completionDate || 'Not completed'}</td>
                  <td className="px-5 py-4"><Link to={`/projects/${project.id}`} className="inline-flex items-center rounded-xl border border-sky-300/30 bg-sky-400/10 px-3 py-1.5 font-medium text-sky-200 hover:bg-sky-400/20 hover:text-white">View</Link></td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">No projects match the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
