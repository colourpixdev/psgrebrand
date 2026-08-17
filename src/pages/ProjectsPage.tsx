import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { ProjectCard } from '../components/projects/ProjectCard';
import { getProjects } from '../services/portalService';
import { ProjectCreateForm } from '../components/projects/ProjectCreateForm';
import { useAuth } from '../contexts/AuthContext';
import { can, filterProjectsForUser } from '../utils/permissions';
import { isTaskOutstanding } from '../utils/taskStatus';

export function ProjectsPage() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });
  const projects = filterProjectsForUser(data ?? [], user);
  const outstandingTasks = projects.reduce((count, project) => count + project.tasks.filter(isTaskOutstanding).length, 0);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <h2 className="text-2xl font-semibold text-slate-900">Projects</h2>
        <p className="mt-2 text-sm text-slate-400">{projects.length} projects · {outstandingTasks} outstanding tasks</p>
      </section>

      {can(user, 'create_project') ? <ProjectCreateForm /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.length > 0 ? projects.map((project) => (
          <ProjectCard key={project.id} project={project} user={user} />
        )) : (
          <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-sm text-slate-400 md:col-span-2 xl:col-span-3">
            No projects are available for your role.
          </div>
        )}
      </section>
    </div>
  );
}
