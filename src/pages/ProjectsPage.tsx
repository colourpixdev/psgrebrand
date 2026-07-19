import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  const { data } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });
  const projects = filterProjectsForUser(data ?? [], user);
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
