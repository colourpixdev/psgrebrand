import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getProjects } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsForUser } from '../utils/permissions';

export function SearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  const q = query.trim().toLowerCase();
  const scopedProjects = filterProjectsForUser(projects, user);

  const filtered = q
    ? scopedProjects.filter(
        (p) =>
          p.branch.toLowerCase().includes(q) ||
          p.town.toLowerCase().includes(q) ||
          p.province.toLowerCase().includes(q) ||
          p.installer.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.currentStage.toLowerCase().includes(q) ||
          p.status.toLowerCase().includes(q) ||
          p.manager.toLowerCase().includes(q),
      )
    : scopedProjects;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <h2 className="text-2xl font-semibold text-white">Search</h2>
        <p className="mt-2 text-sm text-slate-400">Search by branch, town, province, installer, status, or project ID.</p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Hermanus, delayed, ABC Signage, PSG-00123…"
          className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 md:max-w-lg"
        />
        {q ? (
          <p className="mt-2 text-xs text-slate-400">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{q}"
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.length > 0 ? (
          filtered.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`} className="block rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-soft transition hover:border-sky-400/40 hover:bg-white/5">
              <p className="text-lg font-semibold text-white">{project.branch}</p>
              <p className="mt-1 text-sm text-slate-400">{project.id}</p>
              <p className="mt-3 text-sm text-slate-300">{project.town}, {project.province}</p>
              <p className="text-sm text-slate-300">Installer: {project.installer}</p>
              <p className="text-sm text-slate-300">Stage: {project.currentStage}</p>
              <p className="text-sm text-slate-300">Status: {project.status}</p>
            </Link>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-sm text-slate-400 lg:col-span-2">
            {q ? `No projects match "${q}".` : 'No projects found.'}
          </div>
        )}
      </div>
    </div>
  );
}
