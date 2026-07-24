import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { getAllBranches } from '../services/branchService';
import { getProjects } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsForUser } from '../utils/permissions';
import { buildBranchCodeMap, getBranchCodeForBranch } from '../utils/branchProjectIds';
import type { Project, TaskAssignee } from '../types/domain';

function byUpdatedAtDesc(a: Project, b: Project) {
  return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
}

function projectParticipants(project: Project) {
  const participants = new Map<string, TaskAssignee>();

  project.tasks.forEach((task) => {
    task.assignees?.forEach((assignee) => {
      participants.set(assignee.email.toLowerCase(), assignee);
    });

    if (task.assigneeEmail && task.assigneeName) {
      const key = task.assigneeEmail.toLowerCase();
      if (!participants.has(key)) {
        participants.set(key, {
          name: task.assigneeName,
          email: task.assigneeEmail,
          designation: 'Participant',
        });
      }
    }
  });

  return [...participants.values()];
}

export function BranchDetailPage() {
  const { branchId } = useParams();
  const { user } = useAuth();

  const { data: branches = [], isLoading: isLoadingBranches } = useQuery({
    queryKey: ['branches'],
    queryFn: getAllBranches,
  });

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  const branch = branches.find((item) => item.id === (branchId ?? ''));
  const scopedProjects = filterProjectsForUser(projects, user);
  const codeByBranchId = useMemo(() => buildBranchCodeMap(branches), [branches]);
  const branchProjects = useMemo(() => {
    if (!branch) {
      return [];
    }

    return scopedProjects
      .filter((project) => project.branchId === branch.id || project.branch.toLowerCase() === branch.name.toLowerCase())
      .sort(byUpdatedAtDesc);
  }, [branch, scopedProjects]);

  const outstandingTasks = branchProjects.reduce((count, project) => count + project.tasks.filter((task) => !task.completed).length, 0);
  const totalFiles = branchProjects.reduce((count, project) => count + project.files.length, 0);

  if (isLoadingBranches || isLoadingProjects) {
    return <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-soft">Loading branch workspace...</div>;
  }

  if (!branch) {
    return <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-soft">Branch not found.</div>;
  }

  const branchCode = getBranchCodeForBranch(branch, codeByBranchId);
  const branchParticipants = branch.contacts?.length
    ? branch.contacts
    : branch.contactName
      ? [{
        name: branch.contactName,
        email: branch.contactEmail,
        phone: branch.contactPhone,
        designation: 'Branch Contact',
      }]
      : [];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Branch {branchCode}</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{branch.name}</h2>
            <p className="mt-2 text-sm text-slate-400">{branch.town}, {branch.province}</p>
            <p className="mt-2 text-sm text-slate-300">{branch.physicalAddress}</p>
          </div>
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-200">
            <p>Projects: <span className="text-white">{branchProjects.length}</span></p>
            <p>Outstanding tasks: <span className="text-white">{outstandingTasks}</span></p>
            <p>Files: <span className="text-white">{totalFiles}</span></p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">Branch participants</h3>
          <Link to="/branches" className="text-sm font-semibold text-sky-200 transition hover:text-sky-100">Manage contacts</Link>
        </div>
        {branchParticipants.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {branchParticipants.map((participant, index) => (
              <div key={`${participant.email ?? participant.name}-${index}`} className="border-l-2 border-sky-400/50 pl-3">
                <p className="font-medium text-white">{participant.name}</p>
                <p className="mt-1 text-sm text-slate-400">{participant.designation}</p>
                {participant.email ? <p className="mt-2 text-xs text-slate-400">{participant.email}</p> : null}
                {participant.phone ? <p className="mt-1 text-xs text-slate-400">{participant.phone}</p> : null}
              </div>
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-slate-400">No branch participants have been added yet.</p>}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">Projects in this branch</h3>
          <Link to={`/projects?branchId=${encodeURIComponent(branch.id)}`} className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">Add project</Link>
        </div>

        <div className="mt-4 space-y-4">
          {branchProjects.length > 0 ? branchProjects.map((project) => {
            const participants = projectParticipants(project);
            const pendingTasks = project.tasks.filter((task) => !task.completed);

            return (
              <article key={project.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Link to={`/projects/${project.id}`} className="text-base font-semibold text-sky-100 transition hover:text-sky-200">{project.id}</Link>
                    <p className="mt-1 text-sm text-slate-300">{project.currentStage} · {project.status.replace('_', ' ')}</p>
                    <p className="mt-1 text-xs text-slate-400">Target {project.targetDate || 'Not set'} · Updated {project.updatedAt || 'Unknown'}</p>
                  </div>
                  <div className="text-sm text-slate-300">
                    <p>Manager: {project.manager || 'Not assigned'}</p>
                    <p>{project.deliveryPartnerLabel}: {project.installer || 'Not assigned'}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Participants</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-200">
                      {participants.length > 0 ? participants.map((participant) => (
                        <p key={`${project.id}-${participant.email}`}>{participant.name} · {participant.designation}</p>
                      )) : <p className="text-slate-400">No participants assigned yet.</p>}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Pending tasks</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-200">
                      {pendingTasks.length > 0 ? pendingTasks.slice(0, 5).map((task) => (
                        <p key={`${project.id}-${task.id}`}>{task.text}</p>
                      )) : <p className="text-slate-400">No pending tasks.</p>}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Files</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-200">
                    {project.files.length > 0 ? project.files.map((file) => <p key={`${project.id}-${file.path ?? file.name}`}>{file.name}</p>) : <p className="text-slate-400">No files uploaded yet.</p>}
                  </div>
                </div>
              </article>
            );
          }) : <p className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-slate-400">No projects are linked to this branch yet.</p>}
        </div>
      </section>
    </div>
  );
}
