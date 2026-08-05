import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { getAllBranches } from '../services/branchService';
import { getProjects } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsForUser } from '../utils/permissions';
import type { Project } from '../types/domain';
import { ReportsPage } from './ReportsPage';

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

  const delayedCount = useMemo(() => scopedProjects.filter((project) => project.status === 'delayed' || project.status === 'on_hold').length, [scopedProjects]);

  function submitQuickSearch(event: FormEvent) {
    event.preventDefault();
    navigate(`/search?q=${encodeURIComponent(quickSearch.trim())}`);
  }

  return (
    <div className="space-y-6">
      <section className="border-b border-white/10 pb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">PSG Rebrand</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">{greeting()}, {user?.name?.split(' ')[0] || 'there'}</h2>
        <p className="mt-2 text-sm text-slate-400">National rollout progress and reporting workspace.</p>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-6">
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
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">At Risk</p>
          <p className="mt-2 text-2xl font-semibold text-amber-200">{delayedCount}</p>
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

      <ReportsPage />
    </div>
  );
}
