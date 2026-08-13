import React, { useEffect, useState } from 'react';
import type { Project } from '../types/domain';

type Props = {
  project?: Project | null;
  canSave?: boolean;
  onSave?: (taskId: string | undefined, message: string) => void;
};

export default function CurrentTaskCard({ project, canSave = true, onSave }: Props) {
  const [taskId, setTaskId] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    setTaskId('');
    setMessage('');
  }, [project?.id]);

  if (!project) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300">No active project selected.</div>
    );
  }

  const outstanding = project.tasks.find((t) => !t.completed);
  const canSubmit = Boolean(message.trim()) && canSave && typeof onSave === 'function';

  return (
    <div className="current-task-card rounded-2xl border border-white/10 bg-slate-950/65 p-4 text-white">
      <p className="text-xs uppercase tracking-[0.12em] text-sky-300">Current task</p>
      <div className="mt-3">
        <p className="font-semibold text-white">{outstanding ? outstanding.text : 'No outstanding tasks'}</p>
        <p className="mt-1 text-xs text-sky-100">
          {outstanding ? `Assigned: ${outstanding.assignees?.map((a) => a.name).join(', ') || outstanding.assigneeName || 'unassigned'}` : 'All tasks complete'}
        </p>
        <p className="mt-2 text-xs text-sky-100">Stage: {project.currentStage} · Updated: {project.updatedAt || 'Unknown'}</p>
      </div>

      {onSave ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-sky-300">Quick update</p>
              <p className="mt-1 text-xs text-sky-100">Capture progress or issues for this branch at the top of the page.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-sky-200">Fast entry</span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr]">
            <label className="grid gap-2 text-sm text-sky-300">
              Related task
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="current-task-select rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50"
              >
                <option value="">General project update</option>
                {project.tasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.text}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-sky-300">
              Update message
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Describe progress, issues, or next steps"
                className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-300 focus:border-sky-400/50"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => {
                if (!canSubmit) {
                  return;
                }

                onSave?.(taskId || undefined, message.trim());
                setTaskId('');
                setMessage('');
              }}
              className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save quick update
            </button>
            <p className="text-xs text-sky-100">This update is added to the project journal and linked to the selected task.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
