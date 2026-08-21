import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ProjectFollowButton } from '../components/projects/ProjectFollowButton';
import { getAllBranches } from '../services/branchService';
import { getProjects } from '../services/portalService';
import { getFollowChangedEventName, getFollowedProjectIds } from '../services/projectFollowService';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsForUser } from '../utils/permissions';


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
  const [followedProjectIds, setFollowedProjectIds] = useState<string[]>(() => getFollowedProjectIds(user?.email));
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
  useEffect(() => {
    const refreshFollowedProjects = () => setFollowedProjectIds(getFollowedProjectIds(user?.email));
    refreshFollowedProjects();
    window.addEventListener(getFollowChangedEventName(), refreshFollowedProjects);
    return () => window.removeEventListener(getFollowChangedEventName(), refreshFollowedProjects);
  }, [user?.email]);
  const isLoading = isLoadingBranches || isLoadingProjects;
  const loadError = isBranchesError ? branchesError : isProjectsError ? projectsError : null;
  const isInternalManagement = user ? ['colourpix_admin', 'psg_head_office'].includes(user.role) : true;

  const stats = useMemo(() => {
    const total = scopedProjects.length;
    const completed = scopedProjects.filter((project) => project.status === 'completed').length;
    const inProgress = scopedProjects.filter((project) => project.status === 'in_progress' || project.status === 'busy').length;
    const atRisk = scopedProjects.filter((project) => project.status === 'delayed' || project.status === 'on_hold').length;
    const notStarted = scopedProjects.filter((project) => project.currentStage === 'New Project' && project.status !== 'completed').length;
    const awaitingApproval = scopedProjects.filter((project) => project.currentStage === 'Awaiting Approval').length;
    const installationsToday = scopedProjects.filter((project) => project.installationDate && project.installationDate.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

    return { total, completed, inProgress, atRisk, notStarted, awaitingApproval, installationsToday };
  }, [scopedProjects]);

  const attentionProjects = useMemo(() => {
    return scopedProjects
      .filter((project) => project.status === 'delayed' || project.status === 'on_hold' || project.currentStage === 'Awaiting Approval')
      .sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''))
      .slice(0, 5);
  }, [scopedProjects]);

  const recentActivity = useMemo(() => {
    return [...scopedProjects]
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, 5);
  }, [scopedProjects]);

  const followedProjects = useMemo(() => {
    const followed = new Set(followedProjectIds);
    return scopedProjects.filter((project) => followed.has(project.id));
  }, [followedProjectIds, scopedProjects]);

  const branchList = useMemo(() => {
    const uniqueBranches = [...new Set(scopedProjects.map((project) => project.branch).filter(Boolean))];
    return uniqueBranches.slice(0, 6);
  }, [scopedProjects]);

  return (
    <div className="space-y-6">
      <section className="border-b border-slate-200 pb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">PSG Branch Rebrand</p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{greeting()}, {user?.name?.split(' ')[0] || 'there'}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {isInternalManagement
                ? 'Track rollout health, project updates and operational follow-up.'
                : 'See the current status of the PSG branch rebrand and the latest progress.'}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-slate-500">{scopedProjects.length} project{scopedProjects.length === 1 ? '' : 's'} in scope</p>
          </div>
        </div>
      </section>

      {loadError ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          Error loading dashboard: {String((loadError as any)?.message ?? loadError)}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">Loading dashboard...</div>
      ) : (
        <>
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">Followed branches</h3>
              <span className="text-sm text-slate-500">{followedProjects.length} tracked</span>
            </div>
            {followedProjects.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {followedProjects.map((project) => (
                  <div key={project.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/projects/${project.id}`} className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900 hover:text-sky-700">{project.branch}</p>
                        <p className="mt-1 text-sm text-slate-600">{project.currentStage} · {project.status}</p>
                      </Link>
                      <ProjectFollowButton projectId={project.id} userEmail={user?.email} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Follow branches from the Branches or Projects page to keep them here.</p>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Total branches</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{branches.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Completed</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{stats.completed}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">In progress</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{stats.inProgress}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">At risk</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{stats.atRisk}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Not started</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{stats.notStarted}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Awaiting approval</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{stats.awaitingApproval}</p>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-slate-900">{isInternalManagement ? 'My attention' : 'Recently updated'}</h3>
              </div>

              {isInternalManagement ? (
                <div className="space-y-3">
                  {attentionProjects.length > 0 ? attentionProjects.map((project) => (
                    <Link key={project.id} to={`/projects/${project.id}`} className="block rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-sky-200 hover:bg-sky-50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{project.branch}</p>
                          <p className="mt-1 text-sm text-slate-600">{project.projectTypeName || 'Rebrand project'} · {project.currentStage}</p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-amber-700">
                          {project.status === 'delayed' || project.status === 'on_hold' ? 'At risk' : 'Action needed'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">Target: {project.targetDate || 'Not set'}</p>
                    </Link>
                  )) : (
                    <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">No immediate follow-up items are flagged right now.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.length > 0 ? recentActivity.map((project) => (
                    <Link key={project.id} to={`/projects/${project.id}`} className="block rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-sky-200 hover:bg-sky-50">
                      <p className="font-medium text-slate-900">{project.branch}</p>
                      <p className="mt-1 text-sm text-slate-600">{project.currentStage} · {project.status}</p>
                      <p className="mt-2 text-sm text-slate-500">Updated {project.updatedAt || 'recently'}</p>
                    </Link>
                  )) : (
                    <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">No recent updates available.</p>
                  )}
                </div>
              )}
            </section>

            {!isInternalManagement ? <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-slate-900">Relevant branches</h3>
              </div>

              <div className="space-y-3">
                {branchList.length > 0 ? branchList.map((branch) => (
                  <div key={branch} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="font-medium text-slate-900">{branch}</p>
                    <p className="mt-1 text-sm text-slate-600">Visible to your role</p>
                  </div>
                )) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">No branches are currently visible.</p>
                )}
              </div>
            </section> : null}
          </div>
        </>
      )}
    </div>
  );
}
