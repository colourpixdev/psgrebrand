import { useQuery } from '@tanstack/react-query';
import { ProjectCard } from '../components/projects/ProjectCard';
import { KanbanBoard } from '../components/projects/KanbanBoard';
import { getProjects } from '../services/portalService';
import { ProjectCreateForm } from '../components/projects/ProjectCreateForm';

export function ProjectsPage() {
  const { data } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <h2 className="text-2xl font-semibold text-white">Projects</h2>
        <p className="mt-2 text-sm text-slate-400">Browse every branch rollout, then drill into the project record for files, comments, and timeline details.</p>
      </section>

      <ProjectCreateForm />

      <KanbanBoard projects={data ?? []} />

      <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {(data ?? []).length > 0 ? (data ?? []).map((project) => (
          <ProjectCard key={project.id} project={project} />
        )) : (
          <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-sm text-slate-400 lg:col-span-2 2xl:col-span-3">
            No projects in Supabase yet. Use the form above to add the first rollout.
          </div>
        )}
      </section>
    </div>
  );
}
