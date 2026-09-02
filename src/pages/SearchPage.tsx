import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { getAllBranches } from '../services/branchService';
import { getProjects } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsForUser } from '../utils/permissions';

export function SearchPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: getAllBranches,
  });

  const q = query.trim().toLowerCase();
  const activeBranchIds = useMemo(() => new Set(branches.map((branch) => branch.id)), [branches]);
  const activeBranchNames = useMemo(() => new Set(branches.map((branch) => branch.name.trim().toLowerCase())), [branches]);
  const activeProjects = useMemo(() => projects.filter((project) => {
    const branchId = project.branchId?.trim();
    const branchName = project.branch.trim().toLowerCase();
    return branchId ? activeBranchIds.has(branchId) : activeBranchNames.has(branchName);
  }), [activeBranchIds, activeBranchNames, projects]);
  const scopedProjects = filterProjectsForUser(activeProjects, user);

  const suggestions = useMemo(() => {
    if (!q) {
      return [];
    }

    const branchNames = Array.from(
      new Set(scopedProjects.map((project) => project.branch).filter(Boolean)),
    );

    return branchNames
      .filter((branch) => branch.toLowerCase().includes(q))
      .slice(0, 8);
  }, [q, scopedProjects]);

  const filtered = q
    ? scopedProjects.filter(
        (p) =>
          p.branch.toLowerCase().includes(q) ||
          p.town.toLowerCase().includes(q) ||
          p.province.toLowerCase().includes(q) ||
          p.currentStage.toLowerCase().includes(q) ||
          p.projectTypeName.toLowerCase().includes(q) ||
          p.status.toLowerCase().includes(q) ||
          p.manager.toLowerCase().includes(q),
      )
    : scopedProjects;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <h2 className="text-2xl font-semibold text-slate-900">Search</h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Hermanus, delayed, stage, branch name..."
          className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-300 focus:border-sky-400/50 md:max-w-lg"
        />

        {suggestions.length > 0 ? (
          <div className="mt-4 grid gap-2 text-sm text-slate-300 md:max-w-lg">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Branch suggestions</p>
            <div className="grid gap-2 rounded-3xl border border-white/10 bg-slate-950/80 p-3">
              {suggestions.map((branch) => (
                <button
                  key={branch}
                  type="button"
                  onClick={() => setQuery(branch)}
                  className="w-full rounded-2xl px-3 py-2 text-left text-slate-100 transition hover:bg-slate-900/70"
                >
                  {branch}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {q ? (
          <p className="mt-2 text-xs text-slate-400">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{q}"
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.length > 0 ? (
          filtered.map((project) => (
            <article key={project.id} className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-soft transition hover:border-sky-400/40 hover:bg-white/5">
                <Link to={`/branches/${encodeURIComponent(project.branchId ?? project.branch)}`} className="block">
                <p className="text-lg font-semibold text-white">{project.branch}</p>
                <p className="mt-1 text-sm text-slate-400">{project.id}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-teal-200/80">{project.projectTypeName}</p>
                <p className="mt-3 text-sm text-slate-300">{project.town}, {project.province}</p>
                <p className="text-sm text-slate-300">Stage: {project.currentStage}</p>
                <p className="text-sm text-slate-300">Status: {project.status}</p>
                <span className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white">
                  <FileText className="h-4 w-4" />
                  View project details
                </span>
              </Link>
            </article>
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
