import React from 'react';
import type { Project } from '../types/domain';

type Props = {
  project?: Project | null;
};

export default function CurrentTaskCard({ project }: Props) {
  if (!project) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-400">No active project selected.</div>
    );
  }

  const outstanding = project.tasks.find((t) => !t.completed);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Current task</p>
      <div className="mt-3">
        <p className="font-semibold text-white">{outstanding ? outstanding.text : 'No outstanding tasks'}</p>
        <p className="mt-1 text-xs text-slate-400">{outstanding ? `Assigned: ${outstanding.assignees?.map((a) => a.name).join(', ') || outstanding.assigneeName || 'unassigned'}` : 'All tasks complete'}</p>
        <p className="mt-2 text-xs text-slate-500">Stage: {project.currentStage} · Updated: {project.updatedAt || 'Unknown'}</p>
      </div>
    </div>
  );
}
