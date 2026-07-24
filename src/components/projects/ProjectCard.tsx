import { Link } from 'react-router-dom';
import type { Project, UserRecord } from '../../types/domain';

const statusTone: Record<Project['status'], string> = {
  completed: 'bg-emerald-400/15 text-emerald-200 ring-emerald-400/30',
  busy: 'bg-cyan-400/15 text-cyan-200 ring-cyan-400/30',
  in_progress: 'bg-sky-400/15 text-sky-200 ring-sky-400/30',
  awaiting_approval: 'bg-amber-400/15 text-amber-200 ring-amber-400/30',
  delayed: 'bg-red-400/15 text-red-200 ring-red-400/30',
  on_hold: 'bg-slate-400/15 text-slate-200 ring-slate-400/30',
  cancelled: 'bg-stone-400/15 text-stone-200 ring-stone-400/30',
};

function isQuestionRequester(question: Project['comments'][number], user: UserRecord | null | undefined) {
  return question.requesterEmail ? question.requesterEmail === user?.email : question.author === user?.name;
}

export function ProjectCard({ project, user }: { project: Project; user?: UserRecord | null }) {
  const openQuestions = project.comments.filter((comment) => comment.kind === 'question' && comment.status !== 'answered').length;
  const unreadAnswers = project.comments.filter((comment) => comment.kind === 'question' && comment.status === 'answered' && comment.unreadForRequester && isQuestionRequester(comment, user)).length;
  const outstandingTasks = project.tasks.filter((task) => !task.completed).length;

  return (
    <Link
      to={`/projects/${project.id}`}
      className="block rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition hover:-translate-y-0.5 hover:border-sky-400/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-[0.18em] text-slate-500">{project.branchCode ? `${project.branchCode} - ${project.id}` : project.id}</p>
          <h3 className="mt-2 truncate text-base font-semibold text-white">{project.branch}</h3>
          <p className="text-sm text-slate-400">
            {project.town}, {project.province}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusTone[project.status]}`}>{project.status.replace('_', ' ')}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200">{outstandingTasks} task{outstandingTasks === 1 ? '' : 's'}</span>
        </div>
      </div>

      {openQuestions > 0 || unreadAnswers > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {unreadAnswers > 0 ? <span className="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">{unreadAnswers} new answer{unreadAnswers === 1 ? '' : 's'}</span> : null}
          {openQuestions > 0 ? <span className="rounded-full border border-amber-400/25 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-100">{openQuestions} open question{openQuestions === 1 ? '' : 's'}</span> : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-1 text-sm text-slate-300">
        <p className="truncate">Manager: {project.manager}</p>
        <p className="truncate">{project.deliveryPartnerLabel}: {project.installer}</p>
        <p>Target: {project.targetDate}</p>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" style={{ width: `${project.progress}%` }} />
      </div>
    </Link>
  );
}
