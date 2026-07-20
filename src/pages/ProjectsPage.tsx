import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Mic2, Search } from 'lucide-react';
import { ProjectCard } from '../components/projects/ProjectCard';
import { KanbanBoard } from '../components/projects/KanbanBoard';
import { getProjects, updateProjectWorkflow } from '../services/portalService';
import { ProjectCreateForm } from '../components/projects/ProjectCreateForm';
import { useAuth } from '../contexts/AuthContext';
import { can, canChangeProjectStage, filterProjectsForUser } from '../utils/permissions';
import { timelineStages } from '../constants/portal';
import type { Project, ProjectStage, ProjectStatus } from '../types/domain';

function progressForStage(stage: ProjectStage) {
  const index = timelineStages.indexOf(stage);
  if (index < 0) {
    return 0;
  }

  return Math.round((index / (timelineStages.length - 1)) * 100);
}

function statusForStage(stage: ProjectStage, currentStatus: ProjectStatus): ProjectStatus {
  if (stage === 'Completed') {
    return 'completed';
  }

  if (stage === 'Awaiting Approval') {
    return 'awaiting_approval';
  }

  if (currentStatus === 'delayed' || currentStatus === 'on_hold' || currentStatus === 'cancelled') {
    return currentStatus;
  }

  return 'in_progress';
}

export function ProjectsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [townSearch, setTownSearch] = useState('');
  const { data } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });
  const projects = filterProjectsForUser(data ?? [], user);
  const normalizedTownSearch = townSearch.trim().toLowerCase();
  const quickUpdateProjects = useMemo(() => {
    const matches = normalizedTownSearch
      ? projects.filter((project) => [project.town, project.branch, project.province, project.id].some((value) => value.toLowerCase().includes(normalizedTownSearch)))
      : projects;

    return matches.slice(0, 6);
  }, [normalizedTownSearch, projects]);
  const workflowMutation = useMutation({
    mutationFn: ({ project, stage }: { project: Project; stage: ProjectStage }) => {
      if (!canChangeProjectStage(user, project, stage)) {
        throw new Error('Your role cannot move this project to the selected stage.');
      }

      return updateProjectWorkflow({
        projectId: project.id,
        currentStage: stage,
        status: statusForStage(stage, project.status),
        progress: progressForStage(stage),
        actor: user?.name ?? 'Workspace user',
      });
    },
    onSuccess: async (updatedProject) => {
      queryClient.setQueryData(['project', updatedProject.id], updatedProject);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['portal-summary'] }),
      ]);
    },
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <h2 className="text-2xl font-semibold text-white">Projects</h2>
        <p className="mt-2 text-sm text-slate-400">Browse the projects available in your workspaces, then drill into the project record for files, questions, journal entries, and timeline details.</p>
      </section>

      <section className="rounded-[2rem] border border-sky-400/20 bg-sky-500/10 p-6 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-sky-200">Quick project update</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Search by town, choose the project, then add a note.</h3>
            <p className="mt-1 text-sm leading-6 text-slate-300">This is the fastest path for a site update when someone only knows the town or branch name.</p>
          </div>
          <Link to="/search" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10">
            <Search className="h-4 w-4" />
            Full search
          </Link>
        </div>

        <label className="mt-5 grid gap-2 text-sm text-slate-300">
          Town or project search
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={townSearch}
              onChange={(event) => setTownSearch(event.target.value)}
              placeholder="Start with a town, for example Hermanus..."
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 py-3 pl-11 pr-4 text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50"
            />
          </div>
        </label>

        <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {quickUpdateProjects.length > 0 ? quickUpdateProjects.map((project) => (
            <article key={project.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <Link to={`/projects/${project.id}`} className="block transition hover:text-sky-100">
                <p className="text-sm font-semibold text-white">{project.branch}</p>
                <p className="mt-1 text-xs text-slate-400">{project.town}, {project.province} · {project.id}</p>
                <p className="mt-3 text-xs font-semibold text-sky-200">Open project details</p>
              </Link>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/projects/${project.id}#project-note`} className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-400">
                  <FileText className="h-4 w-4" />
                  Add note
                </Link>
                <Link to={`/projects/${project.id}#voice-note`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10">
                  <Mic2 className="h-4 w-4" />
                  Voice note
                </Link>
              </div>
            </article>
          )) : (
            <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-slate-400 lg:col-span-2 xl:col-span-3">
              No projects match that town or project search.
            </div>
          )}
        </div>
      </section>

      {can(user, 'create_project') ? <ProjectCreateForm /> : null}

      <KanbanBoard
        projects={projects}
        user={user}
        canMove={can(user, 'manage_workflow')}
        movingProjectId={workflowMutation.variables?.project.id ?? null}
        onMoveProject={(project, stage) => workflowMutation.mutate({ project, stage })}
      />

      {workflowMutation.error instanceof Error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{workflowMutation.error.message}</p> : null}

      <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {projects.length > 0 ? projects.map((project) => (
          <ProjectCard key={project.id} project={project} user={user} />
        )) : (
          <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-sm text-slate-400 lg:col-span-2 2xl:col-span-3">
            No projects are available for your role.
          </div>
        )}
      </section>
    </div>
  );
}
