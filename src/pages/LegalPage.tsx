import { productBrand } from '../constants/branding';

const sections = [
  {
    title: 'Software Ownership',
    body: 'RolloutHQ™, including all source code, user interface design, database structure, workflow logic, documentation, reports, AI functionality, branding and supporting software remains the intellectual property of Francois Botha unless transferred by written agreement.',
  },
  {
    title: 'License',
    body: 'This application is licensed to Francois Botha. The licence does not transfer ownership away from the software owner. The software may not be copied, redistributed, modified or sublicensed without written permission from the owner.',
  },
  {
    title: 'Audit',
    body: 'All significant actions performed within the system are recorded for accountability and operational history.',
  },
  {
    title: 'Project Data Retention',
    body: 'RolloutHQ™ is an operational workspace and project database, but it is not guaranteed to be a permanent archive after a project is marked completed by the workspace owner, service partner, or RolloutHQ. Completed records, files, communications, and related project data may be archived, exported, or removed as part of operational cleanup. Users remain responsible for keeping independent copies of documents they are legally, financially, or operationally required to retain.',
  },
  {
    title: 'AI Disclaimer',
    body: 'Artificial Intelligence features provide recommendations only. Users remain responsible for reviewing and approving any suggested project updates before they become official records.',
  },
];

export function LegalPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <p className="text-sm uppercase tracking-[0.32em] text-teal-200/80">Legal</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">{productBrand.name} licence and use terms</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Licensed to {productBrand.licensee}. Current workspace context: {productBrand.workspace} for {productBrand.customer}.</p>
      </section>

      <section className="grid gap-4">
        {sections.map((section) => (
          <article key={section.title} className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{section.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-200">{section.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}