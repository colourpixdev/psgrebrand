import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { getAllBranches } from '../services/branchService';
import { getProjects } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsForUser } from '../utils/permissions';
import type { Project } from '../types/domain';

function byUpdatedAtDesc(a: Project, b: Project) {
  return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
}

function isToday(dateValue: string) {
  if (!dateValue) {
    return false;
  }

  const today = new Date().toISOString().slice(0, 10);
  return dateValue.slice(0, 10) === today;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

function latestUpdateSummary(project: Project) {
  const latestActivity = [...project.activity].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
  return latestActivity?.detail || latestActivity?.title || project.currentStage;
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quickSearch, setQuickSearch] = useState('');
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: getAllBranches });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: getProjects });
  const scopedProjects = filterProjectsForUser(projects, user);

  const stats = useMemo(() => {
    const active = scopedProjects.filter((project) => project.status !== 'completed' && project.status !== 'cancelled').length;
    const awaitingApproval = scopedProjects.filter((project) => project.currentStage === 'Awaiting Approval').length;
    const installationsToday = scopedProjects.filter((project) => isToday(project.installationDate)).length;
    const completed = scopedProjects.filter((project) => project.status === 'completed').length;

    return { active, awaitingApproval, installationsToday, completed };
  }, [scopedProjects]);

  const myActions = useMemo(() => [
    { label: 'Awaiting quotation', count: scopedProjects.filter((project) => project.currentStage === 'Quotation Requested').length, query: 'Quotation Requested' },
    { label: 'Measurements required', count: scopedProjects.filter((project) => project.currentStage === 'Site Survey' || project.currentStage === 'Awaiting Information').length, query: 'Measurements' },
    { label: 'Artwork approval outstanding', count: stats.awaitingApproval, query: 'Awaiting Approval' },
    { label: 'Install booked today', count: stats.installationsToday, query: 'Installation Scheduled' },
  ], [scopedProjects, stats.awaitingApproval, stats.installationsToday]);

  const recentlyUpdated = useMemo(() => [...scopedProjects].sort(byUpdatedAtDesc).slice(0, 5), [scopedProjects]);

  function submitQuickSearch(event: FormEvent) {
    event.preventDefault();
    navigate(`/search?q=${encodeURIComponent(quickSearch.trim())}`);
  }

  return (
    <div className="space-y-6">
      <section className="border-b border-white/10 pb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">PSG Rebrand</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">{greeting()}, {user?.name?.split(' ')[0] || 'there'}</h2>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Total Branches</p>
          <p className="mt-2 text-2xl font-semibold text-white">{branches.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Projects Active</p>
          <p className="mt-2 text-2xl font-semibold text-white">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Awaiting Approval</p>
          <p className="mt-2 text-2xl font-semibold text-white">{stats.awaitingApproval}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Installations Today</p>
          <p className="mt-2 text-2xl font-semibold text-white">{stats.installationsToday}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Completed</p>
          <p className="mt-2 text-2xl font-semibold text-white">{stats.completed}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/45 p-5 shadow-soft">
        <h3 className="font-semibold text-white">My Actions</h3>
        <div className="mt-3 divide-y divide-white/10">
          {myActions.map((action) => (
            <Link
              key={action.label}
              to={`/search?q=${encodeURIComponent(action.query)}`}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 transition hover:text-sky-100"
            >
              <span className="text-sm text-slate-200">{action.label}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-semibold text-slate-300">{action.count}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/45 p-5 shadow-soft">
        <h3 className="font-semibold text-white">Recently Updated</h3>
        <div className="mt-3 divide-y divide-white/10">
          {recentlyUpdated.length > 0 ? recentlyUpdated.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`} className="block py-3 first:pt-0 transition hover:text-sky-100">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{project.branch}</p>
                <p className="shrink-0 text-xs text-slate-500">{project.updatedAt || 'Unknown'}</p>
              </div>
              <p className="mt-1 text-xs text-slate-400">{latestUpdateSummary(project)}</p>
            </Link>
          )) : <p className="py-4 text-sm text-slate-400">No recent updates yet.</p>}
        </div>
      </section>

      <form onSubmit={submitQuickSearch} className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <label className="flex items-center gap-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="search"
            value={quickSearch}
            onChange={(event) => setQuickSearch(event.target.value)}
            placeholder="Search any branch..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
        </label>
      </form>
    </div>
  );
}
