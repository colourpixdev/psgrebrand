import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { LifeBuoy } from 'lucide-react';
import { MetricCard } from '../components/dashboard/MetricCard';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import { TaskList } from '../components/dashboard/TaskList';
import { getProjects } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsForUser } from '../utils/permissions';
import { productBrand } from '../constants/branding';
import { QuoteRequestForm } from '../components/workspaces/QuoteRequestForm';

export function DashboardPage() {
  const { user } = useAuth();
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });
  const scopedProjects = filterProjectsForUser(projects, user);
  const recentActivity = scopedProjects.flatMap((project) => project.activity).slice(0, 4);
  const todayTasks = [...new Set(scopedProjects.flatMap((project) => project.tasks.filter((task) => !task.completed).map((task) => task.text)))].slice(0, 3);
  const activeWorkspaces = [...new Set(scopedProjects.map((project) => project.workspaceName))];
  const clientCompanies = [...new Set(scopedProjects.map((project) => project.clientCompany))];
  const projectTypes = [...new Set(scopedProjects.map((project) => project.projectTypeName))];
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
        <p className="text-sm uppercase tracking-[0.32em] text-teal-200/80">{productBrand.workspace}</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Configurable workspaces for repeatable project delivery.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Track requests, approvals, suppliers, files, questions, voice updates, decisions, and closeout records in one live workspace tailored to each client.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Workspace database</p>
          <h3 className="mt-3 text-xl font-semibold text-white">Your projects are grouped as one larger operating record.</h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            A workspace is the shared database for all projects, quotes, files, questions, activity, and completion history that belong to the same client programme.
          </p>
          <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Visible workspaces</p>
              <p className="mt-2 font-medium text-white">{user?.canAccessAllWorkspaces ? 'All workspaces' : activeWorkspaces.join(', ') || productBrand.workspace}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Client context</p>
              <p className="mt-2 font-medium text-white">{clientCompanies.join(', ') || productBrand.customer}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Project types</p>
              <p className="mt-2 font-medium text-white">{projectTypes.join(', ') || 'Signage rollout'}</p>
            </div>
          </div>
          <p className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/8 px-4 py-3 text-xs leading-5 text-amber-50/85">
            Data retention disclaimer: completed project records may be archived or removed after completion by Colourpix or RolloutHQ. Users should keep their own copies of critical documents where required.
          </p>
          <Link to="/support" className="mt-4 flex items-center gap-3 rounded-2xl border border-teal-300/20 bg-teal-300/10 px-4 py-3 text-sm font-semibold text-teal-100 transition hover:border-teal-200/40 hover:bg-teal-300/15">
            <LifeBuoy className="h-4 w-4" />
            Contact the workspace administrator or RolloutHQ support
          </Link>
        </div>

        <QuoteRequestForm
          user={user}
          workspaceName={activeWorkspaces[0] ?? productBrand.workspace}
          organisation={clientCompanies[0] ?? productBrand.customer}
          allowedRequestTypes={['project_quote']}
          defaultRequestType="project_quote"
        />
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
