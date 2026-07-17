import { useQuery } from '@tanstack/react-query';
import { getProjects } from '../services/portalService';

export function MapPage() {
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <h2 className="text-2xl font-semibold text-white">Map View</h2>
        <p className="mt-2 text-sm text-slate-400">A future map layer can render branch locations with live completion status across South Africa and Namibia.</p>
      </section>

      <div className="rounded-[2rem] border border-dashed border-white/15 bg-slate-950/40 p-6 shadow-soft">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-semibold text-white">{project.branch}</p>
              <p className="mt-1 text-sm text-slate-400">{project.town}, {project.province}</p>
              <p className="mt-2 text-sm text-slate-300">{project.currentStage}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
