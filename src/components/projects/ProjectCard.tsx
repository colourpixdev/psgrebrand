import { Link } from 'react-router-dom';
import type { Project } from '../../types/domain';

const statusTone: Record<Project['status'], string> = {
  completed: 'bg-emerald-400/15 text-emerald-200 ring-emerald-400/30',
  in_progress: 'bg-sky-400/15 text-sky-200 ring-sky-400/30',
  awaiting_approval: 'bg-amber-400/15 text-amber-200 ring-amber-400/30',
  delayed: 'bg-red-400/15 text-red-200 ring-red-400/30',
  on_hold: 'bg-slate-400/15 text-slate-200 ring-slate-400/30',
  cancelled: 'bg-stone-400/15 text-stone-200 ring-stone-400/30',
};

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="block rounded-3xl border border-white/10 bg-slate-950/60 p-5 transition hover:-translate-y-0.5 hover:border-sky-400/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{project.id}</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{project.branch}</h3>
          <p className="text-sm text-slate-400">
            {project.town}, {project.province}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusTone[project.status]}`}>{project.currentStage}</span>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-300">
        <p>Manager: {project.manager}</p>
        <p>Installer: {project.installer}</p>
        <p>Target: {project.targetDate}</p>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" style={{ width: `${project.progress}%` }} />
      </div>
    </Link>
  );
}
