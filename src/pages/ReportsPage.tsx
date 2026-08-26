import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Search } from 'lucide-react';
import { getProjects } from '../services/portalService';
import { getAllBranches } from '../services/branchService';
import { getUsers } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import { can, filterProjectsForUser } from '../utils/permissions';
import { isTaskOutstanding } from '../utils/taskStatus';
import type { Branch, Project, ProjectStatus, TaskItem } from '../types/domain';

type ReportType = 'single-branch-detail' | 'multi-branch-overview' | 'operational-blockers';

const statusLabels: Record<ProjectStatus, string> = {
  on_schedule: 'On Schedule',
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

const taskStatusLabels: Record<NonNullable<TaskItem['status']>, string> = { pending: 'Pending', open: 'Started', busy: 'Busy', done: 'Completed', waiting: 'Waiting', blocked: 'Blocked' };

function currentStageTask(project: Project) {
  return project.tasks.find((task) => !task.completed) ?? project.tasks[project.tasks.length - 1];
}

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

function formatReportDate(value: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  const hasTime = value.includes('T') || value.includes(':');
  const datePart = new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  }).format(date);

  if (!hasTime) {
    return datePart;
  }

  const timePart = new Intl.DateTimeFormat('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Johannesburg',
  }).format(date).replace(' ', '');

  return `${datePart} - ${timePart}`;
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

function projectSpreadsheetRows(projects: Project[]) {
  return projects.map((project) => {
    const stageTask = currentStageTask(project);
    const pendingTasks = project.tasks.filter(isTaskOutstanding).length;
    const participants = project.tasks.flatMap((task) => task.assignees?.map((assignee) => `${assignee.name} (${assignee.designation})`) ?? []).join('; ');
    return [
      project.id,
      project.branch,
      project.town,
      project.manager,
      formatReportDate(project.projectStartDate ?? ''),
      formatReportDate(project.targetDate),
      project.currentStage,
      stageTask ? taskStatusLabels[stageTask.status ?? 'pending'] : 'Not set',
      formatReportDate(stageTask?.startedDate ?? ''),
      formatReportDate(stageTask?.dueDate ?? ''),
      pendingTasks,
      project.files.length,
      participants,
      formatReportDate(project.updatedAt),
    ];
  });
}

async function downloadExcel(projects: Project[], reportName: string) {
  const XLSX = await import('xlsx-js-style');
  const headers = ['Branch reference', 'Branch', 'Town', 'Manager', 'Project Start Date', 'Project Target Completion', 'Stage', 'Stage Status', 'Stage Start Date', 'Stage Target Date', 'Pending tasks', 'Files', 'Participants', 'Updated'];
  const rows = projectSpreadsheetRows(projects);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet['!cols'] = [
    { wch: 17 }, { wch: 30 }, { wch: 18 }, { wch: 24 }, { wch: 18 }, { wch: 24 }, { wch: 32 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 42 }, { wch: 22 },
  ];
  worksheet['!rows'] = [{ hpt: 30 }, ...rows.map(() => ({ hpt: 24 }))];
  worksheet['!autofilter'] = { ref: `A1:M${rows.length + 1}` };
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };

  for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
    const headerCell = worksheet[XLSX.utils.encode_cell({ r: 0, c: columnIndex })];
    headerCell.s = {
      fill: { fgColor: { rgb: '0F3D56' } },
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { bottom: { style: 'medium', color: { rgb: '38BDF8' } } },
    };
  }

  rows.forEach((_, rowIndex) => {
    for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex })];
      cell.s = {
        fill: { fgColor: { rgb: rowIndex % 2 === 0 ? 'F0F9FF' : 'FFFFFF' } },
        font: { color: { rgb: '172033' }, sz: 10 },
        alignment: { vertical: 'top', wrapText: columnIndex === 11 },
        border: { bottom: { style: 'thin', color: { rgb: 'D7E3EA' } } },
      };
    }
    const statusCell = worksheet[XLSX.utils.encode_cell({ r: rowIndex + 1, c: 7 })];
    statusCell.s = {
      ...statusCell.s,
      font: { bold: true, color: { rgb: '075985' }, sz: 10 },
      alignment: { horizontal: 'center', vertical: 'top', wrapText: true },
    };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rollout report');
  const workbookData = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([workbookData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${formatFileName(reportName)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
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
        <p><strong>Address:</strong> ${escapeHtml(project.physicalAddress || project.town)}</p>
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
          body { font-family: Arial, sans-serif; color: #172033; margin: 0; background: #ffffff; }
          header { border-bottom: 4px solid #0f7894; margin-bottom: 18px; padding-bottom: 12px; }
          h1 { color: #0f3d56; font-size: 24px; margin: 0 0 6px; }
          .meta { color: #64748b; font-size: 11px; margin: 0; }
          table { border-collapse: collapse; width: 100%; font-size: 10px; table-layout: fixed; }
          th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
          th { background: #0f3d56; color: #ffffff; font-size: 10px; }
          tbody tr:nth-child(even) { background: #f0f9ff; }
          tbody tr { page-break-inside: avoid; }
          .footer { color: #64748b; font-size: 9px; margin-top: 14px; text-align: right; }
        </style>
      </head>
      <body>
        <header>
          <h1>${escapeHtml(reportName)}</h1>
          <p class="meta">${projects.length} project${projects.length === 1 ? '' : 's'} · Generated ${escapeHtml(new Date().toLocaleDateString())}</p>
        </header>
        <table>
            <thead><tr>${['Project ID', 'Branch', 'Town', 'Marketing Manager', 'Project Start Date', 'Project Target Completion', 'Stage', 'Stage Status', 'Stage Start Date', 'Stage Target Date'].map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
              <tbody>${projects.map((project) => { const stageTask = currentStageTask(project); return `<tr>${[
      project.id,
      project.branch,
      project.town,
      project.manager,
      project.projectStartDate ?? '',
      project.targetDate,
      project.currentStage,
      stageTask ? taskStatusLabels[stageTask.status ?? 'pending'] : 'Not set',
      stageTask?.startedDate ?? '',
      stageTask?.dueDate ?? '',
    ].map((cell) => `<td>${escapeHtml(cell || 'Not set')}</td>`).join('')}</tr>`; }).join('')}</tbody>
        </table>
        <p class="footer">PSG Rebrand rollout report</p>
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
  const [completion, setCompletion] = useState<'all' | 'completed' | 'outstanding'>('all');
  const [marketingCoordinator, setMarketingCoordinator] = useState('all');
  const [query, setQuery] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: getAllBranches,
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  });
  const scopedProjects = useMemo(() => filterProjectsForUser(projects, user), [projects, user]);
  const selectedReport = reportTypes.find((report) => report.value === reportType) ?? reportTypes[0];
  const normalizedQuery = query.trim().toLowerCase();
  const availableBranches = useMemo(() => uniqueSorted(scopedProjects.map((project) => project.branch)), [scopedProjects]);
  const branchByProject = useMemo(() => new Map<string, Branch>(branches.map((branch) => [branch.id, branch])), [branches]);
  const getProjectBranch = (project: Project) => branchByProject.get(project.branchId) ?? branches.find((branch) => branch.name === project.branch);
  const availableMarketingCoordinators = useMemo(() => uniqueSorted(users.filter((item) => item.role === 'psg_user').map((item) => item.name)), [users]);
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

    if (marketingCoordinator !== 'all' && project.manager !== marketingCoordinator) {
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
  }), [branchName, completion, getProjectBranch, marketingCoordinator, normalizedQuery, reportType, scopedProjects, status]);

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
              {(['on_schedule', 'completed', 'delayed'] as const).map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
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

          <label className="grid gap-2 text-sm text-slate-300">
            Marketing Coordinator
            <select value={marketingCoordinator} onChange={(event) => setMarketingCoordinator(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
              <option value="all">All coordinators</option>
              {availableMarketingCoordinators.map((item) => <option key={item} value={item}>{item}</option>)}
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
                <th className="px-5 py-4 font-medium">Project Start Date</th>
                <th className="px-5 py-4 font-medium">Project Target Completion</th>
                <th className="px-5 py-4 font-medium">Stage</th>
                <th className="px-5 py-4 font-medium">Stage Status</th>
                <th className="px-5 py-4 font-medium">Stage Start Date</th>
                <th className="px-5 py-4 font-medium">Stage Target Date</th>
                <th className="px-5 py-4 font-medium">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {isLoading ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">Loading projects...</td></tr>
              ) : displayedProjects.length > 0 ? displayedProjects.map((project) => (
                <tr key={project.id} className="text-slate-300 transition hover:bg-white/5">
                  {(() => { const stageTask = currentStageTask(project); return <>
                  <td className="px-5 py-4 text-white"><Link to={`/projects/${project.id}`} className="font-medium hover:text-sky-100">{project.branch}</Link></td>
                  <td className="px-5 py-4">{project.projectStartDate || 'Not set'}</td>
                  <td className="px-5 py-4">{project.targetDate || 'Not set'}</td>
                  <td className="px-5 py-4">{project.currentStage}</td>
                  <td className="px-5 py-4">{stageTask ? taskStatusLabels[stageTask.status ?? 'pending'] : 'Not set'}</td>
                  <td className="px-5 py-4">{stageTask?.startedDate || 'Not set'}</td>
                  <td className="px-5 py-4">{stageTask?.dueDate || 'Not set'}</td>
                  <td className="px-5 py-4"><Link to={`/projects/${project.id}`} className="inline-flex items-center rounded-xl border border-sky-300/30 bg-sky-400/10 px-3 py-1.5 font-medium text-sky-200 hover:bg-sky-400/20 hover:text-white">View</Link></td>
                  </>; })()}
                </tr>
              )) : (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">No projects match the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
