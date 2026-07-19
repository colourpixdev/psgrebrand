import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, LifeBuoy, Mail, ShieldCheck } from 'lucide-react';
import { getProjects } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsForUser } from '../utils/permissions';
import { productBrand } from '../constants/branding';
import { defaultWorkspace, rolloutSupportContact, workspaceAdminContact } from '../constants/workspaces';

const requestTypes = [
  'project_help',
  'workspace_access',
  'feature_request',
  'report_customization',
  'workflow_template',
  'technical_issue',
] as const;

const supportRequestSchema = z.object({
  requestType: z.enum(requestTypes),
  projectId: z.string().trim().optional(),
  subject: z.string().trim().min(4, 'Add a short subject'),
  details: z.string().trim().min(12, 'Add enough detail for the team to understand the request'),
  expectedOutcome: z.string().trim().min(6, 'Describe the outcome you want'),
  urgency: z.enum(['normal', 'soon', 'urgent']),
});

type SupportRequestValues = z.infer<typeof supportRequestSchema>;
type SupportRequestType = SupportRequestValues['requestType'];

const requestTypeLabels: Record<SupportRequestType, string> = {
  project_help: 'Project or update help',
  workspace_access: 'Workspace access or data question',
  feature_request: 'Functionality request',
  report_customization: 'Report customization',
  workflow_template: 'Workflow or template change',
  technical_issue: 'Technical issue',
};

const requestTypeDescriptions: Record<SupportRequestType, string> = {
  project_help: 'Ask the workspace administrator for project status, corrections, files, or next steps.',
  workspace_access: 'Ask the workspace administrator about access, visibility, user roles, or workspace data.',
  feature_request: 'Send a product request to RolloutHQ support for approval and review.',
  report_customization: 'Request a new report, export, filter, dashboard view, or management format.',
  workflow_template: 'Suggest project stages, labels, templates, or role changes for this workspace.',
  technical_issue: 'Report a broken screen, sign-in issue, upload problem, or unexpected behaviour.',
};

const rolloutRequestTypes = new Set<SupportRequestType>(['feature_request', 'report_customization', 'workflow_template', 'technical_issue']);

function joinEmails(emails: readonly string[]) {
  return emails.join(',');
}

export function SupportPage() {
  const { user, roleLabel } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  const visibleProjects = useMemo(() => filterProjectsForUser(projects, user), [projects, user]);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<SupportRequestValues>({
    resolver: zodResolver(supportRequestSchema),
    defaultValues: {
      requestType: 'project_help',
      projectId: '',
      subject: '',
      details: '',
      expectedOutcome: '',
      urgency: 'normal',
    },
  });

  const requestType = watch('requestType');
  const goesToRolloutSupport = rolloutRequestTypes.has(requestType);
  const primaryContact = goesToRolloutSupport ? rolloutSupportContact : workspaceAdminContact;
  const secondaryContact = goesToRolloutSupport ? workspaceAdminContact : rolloutSupportContact;

  const onSubmit = handleSubmit((values) => {
    const selectedProject = visibleProjects.find((project) => project.id === values.projectId);
    const requestLabel = requestTypeLabels[values.requestType];
    const to = joinEmails(primaryContact.emails);
    const cc = joinEmails(secondaryContact.emails);
    const subject = `${productBrand.name} ${requestLabel} - ${values.subject}`;
    const approvalNote = goesToRolloutSupport
      ? 'Approval required: this request should be reviewed by the workspace administrator and client administrator before RolloutHQ implements configuration, report, workflow, or feature changes.'
      : 'Workspace administrator request: RolloutHQ support is copied so recurring needs, support patterns, and possible platform improvements can be tracked.';

    const body = [
      `Request type: ${requestLabel}`,
      `Urgency: ${values.urgency}`,
      '',
      `Submitted by: ${user?.name ?? 'Unknown user'}`,
      `Email: ${user?.email ?? 'Unknown email'}`,
      `Role: ${roleLabel}`,
      `Company / scope: ${user?.company ?? user?.branch ?? 'Not specified'}`,
      '',
      `Workspace: ${selectedProject?.workspaceName ?? defaultWorkspace.name}`,
      `Workspace administrator: ${workspaceAdminContact.name} (${workspaceAdminContact.company})`,
      `RolloutHQ support: ${rolloutSupportContact.name}`,
      selectedProject ? `Project: ${selectedProject.id} - ${selectedProject.branch} (${selectedProject.projectTypeName})` : 'Project: Not linked to a specific project',
      '',
      'Request details:',
      values.details,
      '',
      'Expected outcome:',
      values.expectedOutcome,
      '',
      approvalNote,
    ].join('\n');

    window.location.href = `mailto:${encodeURIComponent(to)}?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setNotice(`Your email app should open with this request addressed to ${primaryContact.name}.`);
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(20,184,166,0.16),rgba(2,6,23,0.72))] p-6 shadow-soft">
        <p className="text-sm uppercase tracking-[0.32em] text-teal-200/80">Support</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Contact the right team without leaving the workspace.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Project questions go to the workspace administrator. Product ideas, report changes, workflow changes, and technical issues go to RolloutHQ support and include the approval context needed before changes are made.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-soft">
          <ShieldCheck className="h-6 w-6 text-teal-200" />
          <p className="mt-4 text-sm uppercase tracking-[0.24em] text-slate-500">Workspace administrator</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{workspaceAdminContact.name}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{workspaceAdminContact.company} manages the current workspace, project records, client questions, delivery partners, and operational data.</p>
        </article>
        <article className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-soft">
          <LifeBuoy className="h-6 w-6 text-sky-200" />
          <p className="mt-4 text-sm uppercase tracking-[0.24em] text-slate-500">RolloutHQ support</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{rolloutSupportContact.name}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">Use this channel for functionality requests, report ideas, workflow/template changes, and support issues that may improve the platform.</p>
        </article>
        <article className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-soft">
          <CheckCircle2 className="h-6 w-6 text-emerald-200" />
          <p className="mt-4 text-sm uppercase tracking-[0.24em] text-slate-500">Approval path</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Client and workspace review</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">Configuration, reporting, and workflow changes should be approved by the workspace administrator and client administrator before implementation.</p>
        </article>
      </section>

      <form onSubmit={onSubmit} className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-6 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Create a support request</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">The form prepares an email with workspace, user, project, routing, and approval details.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-300/25 bg-teal-300/10 px-3 py-1 text-xs font-semibold text-teal-100">
            <Mail className="h-3.5 w-3.5" />
            {goesToRolloutSupport ? 'RolloutHQ support' : 'Workspace administrator'}
          </span>
        </div>

        <fieldset className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200 md:grid-cols-2 xl:grid-cols-3">
          <legend className="px-1 text-xs uppercase tracking-[0.24em] text-slate-500">Request type</legend>
          {requestTypes.map((type) => (
            <label key={type} className="grid gap-1 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
              <span className="flex items-center gap-3">
                <input type="radio" value={type} {...register('requestType')} className="accent-teal-300" />
                {requestTypeLabels[type]}
              </span>
              <span className="pl-6 text-xs leading-5 text-slate-500">{requestTypeDescriptions[type]}</span>
            </label>
          ))}
        </fieldset>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-300">
            Related project
            <select {...register('projectId')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-teal-300/50">
              <option value="">Not linked to a specific project</option>
              {visibleProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.id} - {project.branch}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-300">
            Urgency
            <select {...register('urgency')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-teal-300/50">
              <option value="normal">Normal</option>
              <option value="soon">Soon</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
            Subject
            <input {...register('subject')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-teal-300/50" placeholder="Short summary of the request" />
            {errors.subject ? <span className="text-xs text-red-300">{errors.subject.message}</span> : null}
          </label>
        </div>

        <label className="mt-4 grid gap-2 text-sm text-slate-300">
          Details
          <textarea rows={4} {...register('details')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-teal-300/50" placeholder="Explain what is needed, what happened, or what would make the workspace more useful." />
          {errors.details ? <span className="text-xs text-red-300">{errors.details.message}</span> : null}
        </label>

        <label className="mt-4 grid gap-2 text-sm text-slate-300">
          Expected outcome
          <textarea rows={3} {...register('expectedOutcome')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-teal-300/50" placeholder="Describe the report, workflow, update, answer, or fix you want to see." />
          {errors.expectedOutcome ? <span className="text-xs text-red-300">{errors.expectedOutcome.message}</span> : null}
        </label>

        {notice ? <p className="mt-4 text-sm text-teal-100">{notice}</p> : null}

        <button type="submit" disabled={isSubmitting} className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60">
          <Mail className="h-4 w-4" />
          {isSubmitting ? 'Preparing request...' : 'Prepare email request'}
        </button>
      </form>
    </div>
  );
}
