import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getAllBranches } from '../services/branchService';
import { getProjects } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsForUser } from '../utils/permissions';
import { ReportsPage } from './ReportsPage';


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
  const {
    data: branches = [],
    isLoading: isLoadingBranches,
    isError: isBranchesError,
    error: branchesError,
  } = useQuery({ queryKey: ['branches'], queryFn: getAllBranches });
  const {
    data: projects = [],
    isLoading: isLoadingProjects,
    isError: isProjectsError,
    error: projectsError,
  } = useQuery({ queryKey: ['projects'], queryFn: getProjects });

  const scopedProjects = useMemo(() => filterProjectsForUser(projects, user), [projects, user]);
  const isLoading = isLoadingBranches || isLoadingProjects;
  const loadError = isBranchesError ? branchesError : isProjectsError ? projectsError : null;

  const stats = useMemo(() => {
    const active = scopedProjects.filter((project) => project.status !== 'completed' && project.status !== 'cancelled').length;
    const awaitingApproval = scopedProjects.filter((project) => project.currentStage === 'Awaiting Approval').length;
    const installationsToday = scopedProjects.filter((project) => project.installationDate && project.installationDate.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
    const completed = scopedProjects.filter((project) => project.status === 'completed').length;

    return { active, awaitingApproval, installationsToday, completed };
  }, [scopedProjects]);

  const delayedCount = useMemo(() => scopedProjects.filter((project) => project.status === 'delayed' || project.status === 'on_hold').length, [scopedProjects]);

  return (
    <div className="space-y-6">
      <section className="border-b border-white/10 pb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">PSG Branch Rebrand</p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{greeting()}, {user?.name?.split(' ')[0] || 'there'}</h2>
            <p className="mt-2 text-sm text-slate-600">Track PSG branch rebrand progress across South Africa and Namibia.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-slate-400">Metrics are scoped to your assigned branches.</p>
          </div>
        </div>
      </section>

      {loadError ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-red-100">
          Error loading dashboard: {String((loadError as any)?.message ?? loadError)}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6 text-slate-100">Loading dashboard...</div>
      ) : (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-200 font-medium">Total Branches</p>
            <p className="mt-2 text-3xl font-bold text-white">{branches.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-200 font-medium">Active Projects</p>
            <p className="mt-2 text-3xl font-bold text-white">{stats.active}</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-200 font-medium">Awaiting Approval</p>
            <p className="mt-2 text-3xl font-bold text-white">{stats.awaitingApproval}</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-200 font-medium">Installations Today</p>
            <p className="mt-2 text-3xl font-bold text-white">{stats.installationsToday}</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-200 font-medium">Completed</p>
            <p className="mt-2 text-3xl font-bold text-white">{stats.completed}</p>
          </div>
        </section>
      )}

      <ReportsPage />
    </div>
  );
}
