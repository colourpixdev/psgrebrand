import { reportCards } from '../services/portalService';

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <h2 className="text-2xl font-semibold text-white">Reports</h2>
        <p className="mt-2 text-sm text-slate-400">Generate completed project, delayed project, and installer performance exports in Excel, PDF, or CSV.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((card) => (
          <div key={card} className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-soft">
            <h3 className="text-lg font-semibold text-white">{card}</h3>
            <p className="mt-2 text-sm text-slate-400">Ready for export and filtered reporting.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
