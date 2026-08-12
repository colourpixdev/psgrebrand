import { useState } from 'react';
import type { ProjectStage, TaskItem, UserRecord } from '../../types/domain';

type TimelineProps = {
  stages: readonly ProjectStage[];
  activeStage: ProjectStage;
  tasks: TaskItem[];
  users: UserRecord[];
  canCompleteStages: boolean;
  canAssignStages: boolean;
  canManageStages: boolean;
  isUpdating: boolean;
  onToggleStage: (stage: ProjectStage, completed: boolean) => void;
  onAssignStage: (stage: ProjectStage, assigneeEmail: string) => void;
  onAddStage: (stage: string) => void;
  onRemoveStage: (stage: ProjectStage) => void;
};

export function Timeline({ stages, activeStage, tasks, users, canCompleteStages, canAssignStages, canManageStages, isUpdating, onToggleStage, onAssignStage, onAddStage, onRemoveStage }: TimelineProps) {
  const activeIndex = stages.indexOf(activeStage);
  const [newStageName, setNewStageName] = useState('');

  return (
    <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/8 p-6 shadow-soft backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-white">Timeline</h3>
      <p className="mt-1 text-sm text-slate-400">Tick a stage as done, or remove stages that don't apply and add your own.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {stages.map((stage, index) => {
          const stageTask = tasks.find((task) => task.stage === stage);
          const active = stage === activeStage;
          const complete = Boolean(stageTask?.completed) || index < activeIndex;
          const assigneeEmail = stageTask?.assigneeEmail ?? '';

          return (
            <article
              key={stage}
              className={`rounded-2xl border p-4 text-sm ${
                active ? 'border-cyan-300/50 bg-cyan-400/15 text-cyan-100' : complete ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100' : 'border-cyan-200/10 bg-slate-950/45 text-slate-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={complete}
                  disabled={!canCompleteStages || isUpdating}
                  onChange={(event) => onToggleStage(stage, event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 accent-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-white">{stage}</p>
                      {active && !complete ? <span className="rounded-full border border-cyan-300/30 bg-cyan-500/15 px-2 py-0.5 text-[0.68rem] font-semibold text-cyan-100">Busy</span> : null}
                      {complete ? <span className="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-2 py-0.5 text-[0.68rem] font-semibold text-emerald-100">Done</span> : null}
                    </div>
                    {canManageStages ? (
                      <button
                        type="button"
                        disabled={isUpdating || stages.length <= 1}
                        onClick={() => onRemoveStage(stage)}
                        className="shrink-0 rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-1 text-[0.68rem] font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <label className="mt-3 grid gap-1 text-xs text-slate-400">
                    Assigned to
                    <select
                      value={assigneeEmail}
                      disabled={!canAssignStages || isUpdating}
                      onChange={(event) => onAssignStage(stage, event.target.value)}
                      className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">Unassigned</option>
                      {users.map((item) => <option key={item.email} value={item.email}>{item.name}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {canManageStages ? (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-5">
          <input
            value={newStageName}
            onChange={(event) => setNewStageName(event.target.value)}
            placeholder="Add a custom stage..."
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-300 focus:border-cyan-300/50"
          />
          <button
            type="button"
            disabled={isUpdating || !newStageName.trim() || stages.includes(newStageName.trim())}
            onClick={() => {
              onAddStage(newStageName.trim());
              setNewStageName('');
            }}
            className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add stage
          </button>
        </div>
      ) : null}
    </div>
  );
}
