import type { ProjectStage } from '../../types/domain';

export function Timeline({ stages, activeStage }: { stages: readonly ProjectStage[]; activeStage: ProjectStage }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
      <h3 className="text-lg font-semibold text-white">Timeline</h3>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {stages.map((stage) => {
          const active = stage === activeStage;
          const complete = stages.indexOf(stage) < stages.indexOf(activeStage);
          return (
            <div
              key={stage}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                active ? 'border-sky-400/40 bg-sky-500/10 text-sky-100' : complete ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100' : 'border-white/10 bg-slate-950/40 text-slate-300'
              }`}
            >
              {complete ? '✓ ' : active ? '→ ' : '□ '}
              {stage}
            </div>
          );
        })}
      </div>
    </div>
  );
}
