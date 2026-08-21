import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getProjects } from '../services/portalService';
import { ProjectFollowButton } from '../components/projects/ProjectFollowButton';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsForUser } from '../utils/permissions';
import type { ProjectStatus } from '../types/domain';

const statusLabels: Record<ProjectStatus, string> = {
  completed: 'Completed',
  busy: 'In progress',
  in_progress: 'In progress',
  awaiting_approval: 'Awaiting approval',
  delayed: 'Delayed',
  on_hold: 'On hold',
  cancelled: 'Cancelled',
};

const statusTone: Record<ProjectStatus, string> = {
  completed: 'bg-emerald-100 text-emerald-800',
  busy: 'bg-sky-100 text-sky-800',
  in_progress: 'bg-sky-100 text-sky-800',
  awaiting_approval: 'bg-amber-100 text-amber-800',
  delayed: 'bg-red-100 text-red-800',
  on_hold: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-stone-200 text-stone-700',
};

function formatTargetDate(value: string) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ProjectsPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [province, setProvince] = useState('all');
  const [stage, setStage] = useState('all');
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all');
  const [completion, setCompletion] = useState<'all' | 'completed' | 'outstanding'>('all');
  const { data } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });
  const projects = useMemo(() => filterProjectsForUser(data ?? [], user), [data, user]);
  const provinces = useMemo(() => [...new Set(projects.map((project) => project.province).filter(Boolean))].sort(), [projects]);
  const stages = useMemo(() => [...new Set(projects.map((project) => project.currentStage).filter(Boolean))].sort(), [projects]);
  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesQuery = !normalizedQuery || [project.branch, project.town, project.province].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesProvince = province === 'all' || project.province === province;
      const matchesStage = stage === 'all' || project.currentStage === stage;
      const matchesStatus = status === 'all' || project.status === status;
      const matchesCompletion = completion === 'all'
        || (completion === 'completed' && project.status === 'completed')
        || (completion === 'outstanding' && project.status !== 'completed');

      return matchesQuery && matchesProvince && matchesStage && matchesStatus && matchesCompletion;
    });
  }, [completion, projects, province, query, stage, status]);

  return (
    <div className="space-y-6">
      <section className="border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-semibold text-slate-900">Projects</h2>
        <p className="mt-2 text-sm text-slate-600">Track each branch rebrand by stage, status and target date.</p>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm text-slate-600 xl:col-span-2">
            <span className="mb-1.5 block font-medium text-slate-800">Find a branch</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search branch, town or province" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
          </label>
          <label className="text-sm text-slate-600">
            <span className="mb-1.5 block font-medium text-slate-800">Province</span>
            <select value={province} onChange={(event) => setProvince(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100">
              <option value="all">All provinces</option>
              {provinces.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            <span className="mb-1.5 block font-medium text-slate-800">Stage</span>
            <select value={stage} onChange={(event) => setStage(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100">
              <option value="all">All stages</option>
              {stages.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            <span className="mb-1.5 block font-medium text-slate-800">Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus | 'all')} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100">
              <option value="all">All statuses</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Showing {filteredProjects.length} of {projects.length}</span>
            <span aria-hidden="true">·</span>
            <select value={completion} onChange={(event) => setCompletion(event.target.value as typeof completion)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-sky-500">
              <option value="all">All projects</option>
              <option value="outstanding">Outstanding</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          {(query || province !== 'all' || stage !== 'all' || status !== 'all' || completion !== 'all') ? <button type="button" onClick={() => { setQuery(''); setProvince('all'); setStage('all'); setStatus('all'); setCompletion('all'); }} className="text-sm font-medium text-sky-700 hover:text-sky-800">Clear filters</button> : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr><th className="px-4 py-3 font-semibold">Branch</th><th className="px-4 py-3 font-semibold">Stage</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Target date</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.map((project) => (
                <tr key={project.id} className="transition hover:bg-sky-50/50">
                  <td className="px-4 py-4"><Link to={`/projects/${project.id}`} className="font-semibold text-slate-900 hover:text-sky-700">{project.branch}</Link><span className="mt-1 block text-xs text-slate-500">{project.town} · {project.province}</span></td>
                  <td className="px-4 py-4 text-slate-700">{project.currentStage}</td>
                  <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[project.status]}`}>{statusLabels[project.status]}</span></td>
                  <td className="px-4 py-4 text-slate-700">{formatTargetDate(project.targetDate)}</td>
                  <td className="px-4 py-4 text-right"><div className="flex items-center justify-end gap-3"><ProjectFollowButton projectId={project.id} userEmail={user?.email} /><Link to={`/projects/${project.id}`} className="font-medium text-sky-700 hover:text-sky-800">Open</Link></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredProjects.length === 0 ? <div className="border-t border-slate-100 p-8 text-center text-sm text-slate-500">No projects match these filters.</div> : null}
      </section>
    </div>
  );
}
