import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { FileGrid } from '../components/uploads/FileGrid';
import { Timeline } from '../components/timeline/Timeline';
import { timelineStages } from '../constants/portal';
import { getProjectById } from '../services/portalService';

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectById(projectId ?? ''),
    enabled: Boolean(projectId),
  });

  if (isLoading) {
    return <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-soft">Loading project...</div>;
  }

  if (!project) {
    return <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-soft">No project data found in Supabase yet.</div>;
  }

  const selectedProject = project;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Project ID {selectedProject.id}</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">{selectedProject.branch}</h2>
        <p className="mt-2 text-sm text-slate-400">
          {selectedProject.town}, {selectedProject.province} · Manager {selectedProject.manager} · Installer {selectedProject.installer}
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-4 text-sm text-slate-300">
          <div>Current Status: <span className="text-white">{selectedProject.currentStage}</span></div>
          <div>Target Date: <span className="text-white">{selectedProject.targetDate}</span></div>
          <div>Installation Date: <span className="text-white">{selectedProject.installationDate}</span></div>
          <div>Completion Date: <span className="text-white">{selectedProject.completionDate}</span></div>
        </div>
      </section>

      <Timeline stages={timelineStages} activeStage={selectedProject.currentStage} />

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <FileGrid files={selectedProject.files} />
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-white">Notes</h3>
            <p className="mt-4 text-sm leading-6 text-slate-300">{selectedProject.notes}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-white">Communication Log</h3>
            <div className="mt-4 space-y-4">
              {selectedProject.comments.map((comment) => (
                <div key={`${comment.date}-${comment.author}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <p className="font-medium text-white">{comment.author}</p>
                    <p className="text-slate-500">{comment.date}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{comment.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
