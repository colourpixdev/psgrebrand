import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { defaultGraphicsPartner, defaultWorkspace, privateRolloutRequestInbox } from '../../constants/workspaces';
import { productBrand } from '../../constants/branding';
import type { UserRecord } from '../../types/domain';

const requestTypes = ['project_quote', 'new_workspace', 'user_access'] as const;

const quoteRequestSchema = z.object({
  requestType: z.enum(requestTypes),
  name: z.string().trim().min(2, 'Enter your name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  organisation: z.string().trim().min(2, 'Enter your organisation'),
  workspaceName: z.string().trim().min(2, 'Enter the workspace name'),
  projectName: z.string().trim().min(2, 'Enter the project name'),
  location: z.string().trim().min(2, 'Enter a project location'),
  roleRequested: z.string().trim().min(2, 'Enter the access or role needed'),
  brief: z.string().trim().min(10, 'Add a short project brief'),
});

type QuoteRequestValues = z.infer<typeof quoteRequestSchema>;
type RequestType = QuoteRequestValues['requestType'];

const requestTypeLabels: Record<RequestType, string> = {
  project_quote: 'Request a project quote',
  new_workspace: 'Start a new workspace',
  user_access: 'Request user access',
};

const requestTypeDescriptions: Record<RequestType, string> = {
  project_quote: 'For a new project inside an existing workspace.',
  new_workspace: 'For a new client, programme, or managed project workspace.',
  user_access: 'For a user who needs access to an existing workspace.',
};

export function QuoteRequestForm({
  user,
  workspaceName = defaultWorkspace.name,
  organisation = defaultWorkspace.clientCompany,
  allowedRequestTypes = requestTypes,
  defaultRequestType = 'project_quote',
  compact = false,
}: {
  user?: UserRecord | null;
  workspaceName?: string;
  organisation?: string;
  allowedRequestTypes?: readonly RequestType[];
  defaultRequestType?: RequestType;
  compact?: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const resolvedDefaultType = allowedRequestTypes.includes(defaultRequestType) ? defaultRequestType : allowedRequestTypes[0] ?? 'project_quote';
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<QuoteRequestValues>({
    resolver: zodResolver(quoteRequestSchema),
    defaultValues: {
      requestType: resolvedDefaultType,
      name: user?.name ?? '',
      email: user?.email ?? '',
      organisation,
      workspaceName,
      projectName: '',
      location: user?.branch ?? '',
      roleRequested: user?.role ?? 'Client contact',
      brief: '',
    },
  });

  const onSubmit = handleSubmit((values) => {
    const requestLabel = requestTypeLabels[values.requestType];
    const subject = `RolloutHQ ${requestLabel.toLowerCase()} - ${values.organisation}`;
    const body = [
      `Request type: ${requestLabel}`,
      '',
      `Name: ${values.name}`,
      `Email: ${values.email}`,
      `Organisation: ${values.organisation}`,
      `Workspace: ${values.workspaceName}`,
      `Project: ${values.projectName}`,
      `Location / branch / site: ${values.location}`,
      `Access or role needed: ${values.roleRequested}`,
      `Preferred service partner: ${defaultGraphicsPartner}`,
      '',
      'Project brief:',
      values.brief,
      '',
      `${productBrand.name} keeps projects grouped inside workspace databases so users can view project history, quote requests, approvals, files, questions, and completion records in one place.`,
    ].join('\n');

    window.location.href = `mailto:${encodeURIComponent(privateRolloutRequestInbox)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setNotice('Your email app should open with this request addressed to the private RolloutHQ request channel.');
  });

  return (
    <form onSubmit={onSubmit} className={compact ? 'grid gap-4' : 'rounded-3xl border border-teal-400/15 bg-teal-400/8 p-5'}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Request a quote, workspace, or access</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">New and existing clients can request project work while keeping every record tied to the right workspace.</p>
        </div>
        <span className="rounded-full border border-teal-300/25 bg-teal-300/10 px-3 py-1 text-xs font-semibold text-teal-100">Private request channel</span>
      </div>

      <fieldset className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-3 text-sm text-slate-200 md:grid-cols-3">
        <legend className="px-1 text-xs uppercase tracking-[0.24em] text-slate-500">Request type</legend>
        {allowedRequestTypes.map((requestType) => (
          <label key={requestType} className="grid gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <span className="flex items-center gap-3">
              <input type="radio" value={requestType} {...register('requestType')} className="accent-teal-300" />
              {requestTypeLabels[requestType]}
            </span>
            <span className="pl-6 text-xs leading-5 text-slate-500">{requestTypeDescriptions[requestType]}</span>
          </label>
        ))}
      </fieldset>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-300">
          Full name
          <input {...register('name')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-teal-300/50" placeholder="Your name" />
          {errors.name ? <span className="text-xs text-red-300">{errors.name.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Work email
          <input type="email" autoComplete="email" {...register('email')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-teal-300/50" placeholder="name@company.co.za" />
          {errors.email ? <span className="text-xs text-red-300">{errors.email.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Organisation
          <input {...register('organisation')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-teal-300/50" placeholder="Client company, branch, or supplier" />
          {errors.organisation ? <span className="text-xs text-red-300">{errors.organisation.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Workspace name
          <input {...register('workspaceName')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-teal-300/50" placeholder="Workspace name" />
          {errors.workspaceName ? <span className="text-xs text-red-300">{errors.workspaceName.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Project name
          <input {...register('projectName')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-teal-300/50" placeholder="Store refresh, rollout, service request, public wayfinding..." />
          {errors.projectName ? <span className="text-xs text-red-300">{errors.projectName.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Location, branch, or site
          <input {...register('location')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-teal-300/50" placeholder="Cape Town, Sandton branch, N1 site..." />
          {errors.location ? <span className="text-xs text-red-300">{errors.location.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
          Access or role needed
          <input {...register('roleRequested')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-teal-300/50" placeholder="Client admin, project manager, delivery partner, viewer..." />
          {errors.roleRequested ? <span className="text-xs text-red-300">{errors.roleRequested.message}</span> : null}
        </label>
      </div>

      <label className="mt-4 grid gap-2 text-sm text-slate-300">
        Project brief
        <textarea rows={3} {...register('brief')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-teal-300/50" placeholder="Tell us what needs to be quoted, where it is, and any timing or approval requirements." />
        {errors.brief ? <span className="text-xs text-red-300">{errors.brief.message}</span> : null}
      </label>

      {notice ? <p className="mt-4 text-sm text-teal-100">{notice}</p> : null}

      <button type="submit" disabled={isSubmitting} className="mt-5 inline-flex items-center justify-center rounded-2xl bg-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? 'Preparing request...' : 'Send request'}
      </button>
    </form>
  );
}