import React, { useState } from 'react';
import type { Project } from '../../types/domain';

type Props = {
  project: Project;
  canSave?: boolean;
  onSave: (taskId: string | undefined, message: string) => void;
};

export default function QuickUpdate({ project, canSave = true, onSave }: Props) {
  const [taskId, setTaskId] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  return (
    <div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr]">
        <label className="grid gap-2 text-sm text-slate-200">
          Related task
          <select
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/50"
          >
            <option value="">General project update</option>
            {project.tasks.map((task) => (
              <option key={task.id} value={task.id}>{task.text}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm text-slate-200">
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
          disabled={!message.trim() || !canSave}
          onClick={() => {
            onSave(taskId || undefined, message.trim());
            setMessage('');
            setTaskId('');
          }}
          className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save quick update
        </button>
        <p className="text-xs text-slate-300">This update is added to the project journal and linked to the selected task.</p>
      </div>
    </div>
  );
}
