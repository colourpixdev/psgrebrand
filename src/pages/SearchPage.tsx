import { useQuery } from '@tanstack/react-query';
import { getProjects } from '../services/portalService';

export function SearchPage() {
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <h2 className="text-2xl font-semibold text-white">Search</h2>
        <p className="mt-2 text-sm text-slate-400">Search by branch, town, province, installer, status, or project ID.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {projects.map((project) => (
          <div key={project.id} className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-soft">
            <p className="text-lg font-semibold text-white">{project.branch}</p>
            <p className="mt-1 text-sm text-slate-400">{project.id}</p>
            <p className="mt-3 text-sm text-slate-300">{project.town}, {project.province}</p>
            <p className="text-sm text-slate-300">Installer: {project.installer}</p>
            <p className="text-sm text-slate-300">Status: {project.currentStage}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
