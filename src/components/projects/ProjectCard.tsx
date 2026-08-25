import { Link } from 'react-router-dom';
import { isTaskOutstanding } from '../../utils/taskStatus';
import type { Project, UserRecord } from '../../types/domain';

const statusTone: Record<Project['status'], string> = {
  on_schedule: 'bg-sky-100 text-sky-800 ring-sky-200',
  pending: 'bg-slate-200 text-slate-700 ring-slate-300',
  open: 'bg-sky-100 text-sky-800 ring-sky-200',
  completed: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  busy: 'bg-sky-100 text-sky-800 ring-sky-200',
  in_progress: 'bg-sky-100 text-sky-800 ring-sky-200',
  awaiting_approval: 'bg-amber-100 text-amber-800 ring-amber-200',
  delayed: 'bg-red-100 text-red-800 ring-red-200',
  on_hold: 'bg-slate-200 text-slate-700 ring-slate-300',
  cancelled: 'bg-stone-200 text-stone-700 ring-stone-300',
};

function isQuestionRequester(question: Project['comments'][number], user: UserRecord | null | undefined) {
  return question.requesterEmail ? question.requesterEmail === user?.email : question.author === user?.name;
}

export function ProjectCard({ project, user }: { project: Project; user?: UserRecord | null }) {
  const openQuestions = project.comments.filter((comment) => comment.kind === 'question' && comment.status !== 'answered').length;
  const unreadAnswers = project.comments.filter((comment) => comment.kind === 'question' && comment.status === 'answered' && comment.unreadForRequester && isQuestionRequester(comment, user)).length;
  const outstandingTasks = project.tasks.filter(isTaskOutstanding).length;

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Branch</p>
          <h3 className="mt-2 truncate text-lg font-semibold text-slate-900">{project.branch}</h3>
          <p className="mt-1 text-sm text-slate-600">{project.town} · {project.province}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ring-1 ${statusTone[project.status]}`}>
          {project.status.replace('_', ' ')}
        </span>
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Stage</span>
          <span className="font-medium text-slate-800">{project.currentStage}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Target</span>
          <span className="font-medium text-slate-800">{project.targetDate || 'Not set'}</span>
        </div>
      </div>

      {(openQuestions > 0 || unreadAnswers > 0 || outstandingTasks > 0) ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {outstandingTasks > 0 ? <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-slate-700">{outstandingTasks} tasks</span> : null}
          {openQuestions > 0 ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-amber-700">{openQuestions} open</span> : null}
          {unreadAnswers > 0 ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-emerald-700">{unreadAnswers} answered</span> : null}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <Link to={`/projects/${project.id}`} className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700">
          Open project
        </Link>
        <Link to={`/branches/${encodeURIComponent(project.branchId ?? project.branch)}`} className="inline-flex items-center rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100 hover:text-sky-800">
          Branch view
        </Link>
      </div>
    </article>
  );
}
