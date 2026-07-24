import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getAllBranches } from '../services/branchService';
import { getProjects } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsForUser } from '../utils/permissions';
import { buildBranchCodeMap, getBranchCodeForBranch } from '../utils/branchProjectIds';
import type { Project } from '../types/domain';

type JournalEntry = {
  projectId: string;
  branch: string;
  title: string;
  detail: string;
  date: string;
  timestamp: string;
};

function byUpdatedAtDesc(a: Project, b: Project) {
  return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
}

function journalEntries(projects: Project[]): JournalEntry[] {
  return projects.flatMap((project) => [
    ...project.activity.map((activity, index) => ({
      projectId: project.id,
      branch: project.branch,
      title: activity.title,
      detail: activity.detail,
      date: activity.date,
      timestamp: project.updatedAt || `activity-${index}`,
    })),
    ...project.comments.map((comment, index) => ({
      projectId: project.id,
      branch: project.branch,
      title: comment.kind === 'question' ? 'Message request' : 'Journal message',
      detail: comment.message,
      date: comment.requestedAt || comment.date,
      timestamp: comment.requestedAt || comment.date || `${project.updatedAt}-${index}`,
    })),
  ]).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 8);
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: getAllBranches });
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });
  const scopedProjects = filterProjectsForUser(projects, user);
  const branchCodeById = useMemo(() => buildBranchCodeMap(branches), [branches]);
  const userEmail = user?.email.toLowerCase() ?? '';
  const userName = user?.name.toLowerCase() ?? '';

  const officeRows = useMemo(() => branches.map((branch) => {
    const branchProjects = scopedProjects
      .filter((project) => project.branchId === branch.id || project.branch.toLowerCase() === branch.name.toLowerCase())
      .sort(byUpdatedAtDesc);
    const primaryContact = branch.contacts?.[0];

    return {
      branch,
      branchCode: getBranchCodeForBranch(branch, branchCodeById),
      currentProject: branchProjects[0],
      outstandingTasks: branchProjects.reduce((count, project) => count + project.tasks.filter((task) => !task.completed).length, 0),
      contact: primaryContact?.name || branch.contactName || 'Not set',
      designation: primaryContact?.designation,
    };
  }), [branchCodeById, branches, scopedProjects]);

  const myTasks = scopedProjects.flatMap((project) => project.tasks
    .filter((task) => {
      if (task.completed) {
        return false;
      }

      const assignedByPrimary = (task.assigneeEmail?.toLowerCase() ?? '') === userEmail || (task.assigneeName?.toLowerCase() ?? '') === userName;
      const assignedByList = task.assignees?.some((assignee) => assignee.email.toLowerCase() === userEmail || assignee.name.toLowerCase() === userName) ?? false;
      return assignedByPrimary || assignedByList;
    })
    .map((task) => ({ ...task, projectId: project.id, branch: project.branch })))
    .slice(0, 5);
  const journal = journalEntries(scopedProjects);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">PSG Rebrand</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Office rollout control board</h2>
        </div>
        <Link to="/branches" className="text-sm font-semibold text-sky-200 transition hover:text-sky-100">Manage offices</Link>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45 shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <h3 className="font-semibold text-white">Office register</h3>
            <p className="mt-1 text-sm text-slate-400">{officeRows.length} office locations</p>
          </div>
          <Link to="/projects" className="text-sm font-semibold text-emerald-200 transition hover:text-emerald-100">Add project</Link>
        </div>
        {officeRows.length > 0 ? <div className="divide-y divide-white/10">
          {officeRows.map(({ branch, branchCode, currentProject, outstandingTasks, contact, designation }) => (
            <Link key={branch.id} to={`/branches/${branch.id}`} className="grid gap-2 px-5 py-4 transition hover:bg-white/5 md:grid-cols-[90px_1.25fr_1fr_1.1fr_110px] md:items-center">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-200">{branchCode}</p>
              <div><p className="font-semibold text-white">{branch.name}</p><p className="mt-1 text-sm text-slate-400">{branch.division} · {branch.city || branch.town}, {branch.province}</p></div>
              <div className="text-sm text-slate-300"><p>{contact}</p>{designation ? <p className="mt-1 text-xs text-slate-500">{designation}</p> : null}</div>
              <div><p className="text-sm font-medium text-slate-200">{currentProject?.currentStage || 'No project started'}</p><p className="mt-1 text-xs text-slate-500">{currentProject ? currentProject.id : branch.physicalAddress}</p></div>
              <p className="text-sm text-slate-300 md:text-right">{outstandingTasks} open task{outstandingTasks === 1 ? '' : 's'}</p>
            </Link>
          ))}
        </div> : <p className="px-5 py-10 text-sm text-slate-400">No offices have been added yet.</p>}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-white">My action queue</h3><span className="text-sm text-slate-400">{myTasks.length}</span></div>
          <div className="mt-4 space-y-2">
            {myTasks.length > 0 ? myTasks.map((task) => <Link key={`${task.projectId}-${task.id}`} to={`/projects/${task.projectId}`} className="block border-b border-white/10 py-3 last:border-0 transition hover:text-sky-100"><p className="text-sm font-medium text-white">{task.text}</p><p className="mt-1 text-xs text-slate-400">{task.branch}</p></Link>) : <p className="py-4 text-sm text-slate-400">No assigned tasks waiting.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-white">Daily journal and messages</h3><span className="text-sm text-slate-400">Latest updates</span></div>
          <div className="mt-4 divide-y divide-white/10">
            {journal.length > 0 ? journal.map((entry, index) => <Link key={`${entry.projectId}-${entry.timestamp}-${index}`} to={`/projects/${entry.projectId}`} className="block py-3 first:pt-0 transition hover:text-sky-100"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-white">{entry.title}</p><p className="shrink-0 text-xs text-slate-500">{entry.date}</p></div><p className="mt-1 text-xs text-slate-400">{entry.branch} · {entry.detail}</p></Link>) : <p className="py-4 text-sm text-slate-400">No journal or message updates yet.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
