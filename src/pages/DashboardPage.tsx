import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ProjectFollowButton } from '../components/projects/ProjectFollowButton';
import { getAllBranches } from '../services/branchService';
import { getProjects, updateProjectTask } from '../services/portalService';
import { getFollowChangedEventName, getFollowedProjectIds, syncFollowedProjects } from '../services/projectFollowService';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsForUser } from '../utils/permissions';
import type { Branch, Project } from '../types/domain';


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

function getAssignedAttentionStage(project: Project, userEmail: string | undefined, userName?: string) {
  const normalizedEmail = userEmail?.trim().toLowerCase();
  const normalizedName = userName?.trim().toLowerCase();
  if (!normalizedEmail && !normalizedName) {
    return undefined;
  }

  return project.tasks.find((task) => {
    const emails = [task.assigneeEmail, ...(task.assignees ?? []).map((assignee) => assignee.email)];
    const names = [task.assigneeName, ...(task.assignees ?? []).map((assignee) => assignee.name)];
    return emails.some((email) => normalizedEmail && email?.trim().toLowerCase() === normalizedEmail)
      || names.some((name) => normalizedName && name?.trim().toLowerCase() === normalizedName);
  });
}

export function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [followedProjectIds, setFollowedProjectIds] = useState<string[]>(() => getFollowedProjectIds(user?.email));
  const [markDoneMessage, setMarkDoneMessage] = useState<string | null>(null);
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
  } = useQuery({ queryKey: ['projects'], queryFn: getProjects, refetchInterval: 10000, refetchOnWindowFocus: true });

  const scopedProjects = useMemo(() => filterProjectsForUser(projects, user), [projects, user]);
  useEffect(() => {
    const refreshFollowedProjects = () => setFollowedProjectIds(getFollowedProjectIds(user?.email));
    const syncFromServer = () => void syncFollowedProjects(user?.email).then(setFollowedProjectIds);
    refreshFollowedProjects();
    syncFromServer();
    window.addEventListener(getFollowChangedEventName(), refreshFollowedProjects);
    window.addEventListener('focus', syncFromServer);
    document.addEventListener('visibilitychange', syncFromServer);
    const refreshInterval = window.setInterval(syncFromServer, 10000);
    return () => {
      window.removeEventListener(getFollowChangedEventName(), refreshFollowedProjects);
      window.removeEventListener('focus', syncFromServer);
      document.removeEventListener('visibilitychange', syncFromServer);
      window.clearInterval(refreshInterval);
    };
  }, [user?.email]);
  const isLoading = isLoadingBranches || isLoadingProjects;
  const loadError = isBranchesError ? branchesError : isProjectsError ? projectsError : null;
  const isInternalManagement = user ? ['colourpix_admin', 'psg_head_office'].includes(user.role) : true;

  const stats = useMemo(() => {
    const total = scopedProjects.length;

    const completed = scopedProjects.filter((project) => project.status === 'completed').length;
    const atRisk = scopedProjects.filter((project) => project.status === 'delayed' || project.status === 'on_hold').length;
    const awaitingApproval = scopedProjects.filter((project) =>
      project.status === 'awaiting_approval' || project.currentStage === 'Awaiting Approval'
    ).length;

    const notStarted = scopedProjects.filter((project) => {
      if (project.status === 'completed' || project.status === 'delayed' || project.status === 'on_hold') {
        return false;
      }

      if (project.status === 'awaiting_approval' || project.currentStage === 'Awaiting Approval') {
        return false;
      }

      return project.currentStage === 'New Project';
    }).length;

    const inProgress = scopedProjects.filter((project) => {
      if (project.status === 'completed' || project.status === 'delayed' || project.status === 'on_hold') {
        return false;
      }

      if (project.status === 'awaiting_approval' || project.currentStage === 'Awaiting Approval') {
        return false;
      }

      if (project.currentStage === 'New Project') {
        return false;
      }

      return true;
    }).length;

    const installationsToday = scopedProjects.filter((project) => project.installationDate && project.installationDate.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

    return { total, completed, inProgress, atRisk, notStarted, awaitingApproval, installationsToday };
  }, [scopedProjects]);

  const attentionProjects = useMemo(() => {
    const userEmail = user?.email?.trim().toLowerCase();
    return scopedProjects
      .filter((project) => Boolean(getAssignedAttentionStage(project, userEmail, user?.name)))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, 5);
  }, [scopedProjects, user]);

  const followedBranches = useMemo(() => {
    const followed = new Set(followedProjectIds);
    const branchById = new Map(branches.map((branch) => [branch.id, branch]));
    scopedProjects.forEach((project) => {
      if (!followed.has(project.branchId) && !followed.has(project.id)) {
        return;
      }

      if (!branchById.has(project.branchId)) {
        branchById.set(project.branchId, {
          id: project.branchId,
          name: project.branch,
          division: 'Wealth',
          province: project.province,
          town: project.town,
          physicalAddress: project.physicalAddress,
          createdAt: project.updatedAt,
          updatedAt: project.updatedAt,
        } satisfies Branch);
      }
    });

    return [...branchById.values()].filter((branch) => followed.has(branch.id) || scopedProjects.some((project) => project.branchId === branch.id && followed.has(project.id)));
  }, [branches, followedProjectIds, scopedProjects]);

  const myBranches = useMemo(() => {
    const normalizedEmail = user?.email?.trim().toLowerCase();
    const normalizedName = user?.name?.trim().toLowerCase();
    const branchById = new Map(branches.map((branch) => [branch.id, branch]));

    scopedProjects.forEach((project) => {
      const coordinatorMatches = project.managerEmail?.trim().toLowerCase() === normalizedEmail
        || project.manager?.trim().toLowerCase() === normalizedName;
      if (!coordinatorMatches || branchById.has(project.branchId)) {
        return;
      }

      branchById.set(project.branchId, {
        id: project.branchId,
        name: project.branch,
        division: 'Wealth',
        province: project.province,
        town: project.town,
        physicalAddress: project.physicalAddress,
        createdAt: project.updatedAt,
        updatedAt: project.updatedAt,
      } satisfies Branch);
    });

    return [...branchById.values()].filter((branch) => scopedProjects.some((project) => {
      const coordinatorMatches = project.managerEmail?.trim().toLowerCase() === normalizedEmail
        || project.manager?.trim().toLowerCase() === normalizedName;
      return project.branchId === branch.id && coordinatorMatches;
    }));
  }, [branches, scopedProjects, user]);

  const branchList = useMemo(() => {
    const uniqueBranches = [...new Set(scopedProjects.map((project) => project.branch).filter(Boolean))];
    return uniqueBranches.slice(0, 6);
  }, [scopedProjects]);

  const markTaskDoneMutation = useMutation({
    mutationFn: async (project: Project) => {
      setMarkDoneMessage(null);
      const assignedTask = getAssignedAttentionStage(project, user?.email?.trim().toLowerCase(), user?.name);
      if (!assignedTask) {
        throw new Error('This project has no stage assigned to you.');
      }

      return updateProjectTask({
        projectId: project.id,
        taskId: assignedTask.id,
        text: assignedTask.text,
        status: 'busy',
        completed: false,
        assignees: [{ name: 'Francois', email: 'francois@colourpix.co.za', designation: 'Colourpix administrator' }],
        handoffAfterCompletion: { name: 'Francois', email: 'francois@colourpix.co.za', designation: 'Colourpix administrator' },
        actor: user?.name ?? 'Workspace user',
        actorEmail: user?.email,
      });
    },
    onSuccess: async (_updatedProject, project) => {
      queryClient.setQueryData<Project[]>(['projects'], (currentProjects) => currentProjects?.filter((item) => item.id !== project.id));
      setMarkDoneMessage('Task marked as done and handed to Francois.');
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error) => {
      setMarkDoneMessage(error instanceof Error ? error.message : 'Unable to mark this task as done.');
    },
  });

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
              <div><h3 className="text-lg font-semibold text-slate-900">Followed branches</h3><p className="mt-1 text-sm text-slate-600">Branches you are tracking appear here.</p></div>
              <span className="text-sm text-slate-500">{followedBranches.length} tracked</span>
            </div>
            {followedBranches.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {followedBranches.map((branch) => {
                  const project = scopedProjects.find((candidate) => candidate.branchId === branch.id);
                  const legacyProjectIds = scopedProjects.filter((candidate) => candidate.branchId === branch.id).map((candidate) => candidate.id);
                  return <div key={branch.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={project ? `/projects/${project.id}` : `/branches/${branch.id}`} className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900 hover:text-sky-700">{branch.name}</p>
                        {project ? <p className="mt-1 text-sm text-slate-600">{project.currentStage} · {project.status}</p> : null}
                      </Link>
                      <div className="flex shrink-0 items-center gap-2">
                        <ProjectFollowButton projectId={branch.id} legacyProjectIds={legacyProjectIds} userEmail={user?.email} noun="branch" />
                        <ProjectFollowButton projectId={branch.id} legacyProjectIds={legacyProjectIds} userEmail={user?.email} noun="branch" unfollowOnly />
                      </div>
                    </div>
                  </div>
                })}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Follow branches from the Branches or Projects page to keep them here.</p>
            )}
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div><h3 className="text-lg font-semibold text-slate-900">My branches</h3><p className="mt-1 text-sm text-slate-600">Branches where you are the marketing coordinator.</p></div>
              <span className="text-sm text-slate-500">{myBranches.length}</span>
            </div>
            {myBranches.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {myBranches.map((branch) => {
                  const project = scopedProjects.find((candidate) => candidate.branchId === branch.id && (candidate.managerEmail?.trim().toLowerCase() === user?.email?.trim().toLowerCase() || candidate.manager?.trim().toLowerCase() === user?.name?.trim().toLowerCase()));
                  return (
                    <div key={branch.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <Link to={project ? `/projects/${project.id}` : `/branches/${branch.id}`} className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-900 hover:text-sky-700">{branch.name}</p>
                          {project ? <p className="mt-1 text-sm text-slate-600">{project.currentStage} · {project.status}</p> : null}
                        </Link>
                        <ProjectFollowButton projectId={branch.id} userEmail={user?.email} noun="branch" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No branches are assigned to you as marketing coordinator.</p>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Total branches</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
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
                <h3 className="text-lg font-semibold text-slate-900">For attention</h3>
              </div>

              <div className="space-y-3">
                {attentionProjects.length > 0 ? attentionProjects.map((project) => {
                  const assignedTask = getAssignedAttentionStage(project, user?.email?.trim().toLowerCase(), user?.name);
                  return (
                    <div key={project.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-sky-200 hover:bg-sky-50">
                      <div className="flex items-start justify-between gap-3">
                        <Link to={`/projects/${project.id}`} className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900">{project.branch}</p>
                          <p className="mt-1 text-sm text-slate-600">{assignedTask?.text} · {project.currentStage}</p>
                        </Link>
                        <span className="rounded-full bg-[#0b1f3a] px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white ring-1 ring-white/30">
                          {project.status === 'delayed' || project.status === 'on_hold' ? 'At risk' : 'Action needed'}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-slate-600">Target: {project.targetDate || 'Not set'}</p>
                        <button
                          type="button"
                          disabled={markTaskDoneMutation.isPending || !assignedTask}
                          onClick={() => markTaskDoneMutation.mutate(project)}
                          className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {markTaskDoneMutation.isPending ? 'Saving...' : 'Mark as done'}
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">No immediate follow-up items are flagged right now.</p>
                )}
              </div>
              {markDoneMessage ? <p className={`mt-3 text-sm ${markDoneMessage.startsWith('Task marked') ? 'text-emerald-700' : 'text-red-600'}`}>{markDoneMessage}</p> : null}
            </section>

          </div>
        </>
      )}
    </div>
  );
}
