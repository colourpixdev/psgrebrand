import { useQuery } from '@tanstack/react-query';
import { MetricCard } from '../components/dashboard/MetricCard';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import { TaskList } from '../components/dashboard/TaskList';
import { getProjects } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsForUser } from '../utils/permissions';

export function DashboardPage() {
  const { user } = useAuth();
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });
  const scopedProjects = filterProjectsForUser(projects, user);
  const recentActivity = scopedProjects.flatMap((project) => project.activity).slice(0, 4);
  const todayTasks = [...new Set(scopedProjects.flatMap((project) => project.tasks.filter((task) => !task.completed).map((task) => task.text)))].slice(0, 3);
  const metrics = [
    { label: 'Projects', value: scopedProjects.length },
    { label: 'Completed', value: scopedProjects.filter((project) => project.status === 'completed').length },
    { label: 'In Progress', value: scopedProjects.filter((project) => ['in_progress', 'awaiting_approval'].includes(project.status)).length },
    { label: 'Awaiting Approval', value: scopedProjects.filter((project) => project.status === 'awaiting_approval').length },
    { label: 'Delayed', value: scopedProjects.filter((project) => project.status === 'delayed').length },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(14,165,233,0.18),rgba(2,6,23,0.65))] p-6 shadow-soft">
        <p className="text-sm uppercase tracking-[0.32em] text-sky-200/80">PSG Rollout Dashboard</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Single source of truth for every signage project.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Track quotations, approvals, installs, photos, comments, and signoff in one live workspace instead of swapping Excel sheets by email.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <ActivityFeed items={recentActivity} />
        <TaskList tasks={todayTasks} />
      </section>
    </div>
  );
}
