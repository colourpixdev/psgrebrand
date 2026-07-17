import type { Project } from '../../types/domain';
import { kanbanColumns } from '../../constants/portal';

const columnMatch: Record<string, string[]> = {
  'Awaiting Survey': ['New Project', 'Awaiting Information', 'Site Survey', 'Measurements Received'],
  Artwork: ['Artwork In Progress', 'Artwork Sent'],
  Approval: ['Awaiting Approval', 'Approved'],
  Production: ['Quotation Requested', 'Quotation Received', 'PO Issued', 'Production'],
  Installation: ['Installation Scheduled', 'Installation In Progress', 'Installed', 'Photos Uploaded', 'Client Signoff'],
  Completed: ['Completed'],
};

export function KanbanBoard({ projects }: { projects: Project[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-6">
      {kanbanColumns.map((column) => {
        const matches = projects.filter((project) => columnMatch[column].includes(project.currentStage));
        return (
          <section key={column} className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{column}</h3>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-200">{matches.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {matches.map((project) => (
                <div key={project.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                  <p className="font-medium text-white">{project.branch}</p>
                  <p className="mt-1 text-slate-400">{project.currentStage}</p>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
