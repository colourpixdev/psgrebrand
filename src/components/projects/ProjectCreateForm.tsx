import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { createProject, getProjects, type CreateProjectInput } from '../../services/portalService';
import { getAllBranches } from '../../services/branchService';
import { timelineStages } from '../../constants/portal';
import { defaultGraphicsPartner, defaultWorkspace } from '../../constants/workspaces';
import { defaultProjectTemplate, projectTemplateOptions } from '../../constants/projectTemplates';
import { defaultTaskPool } from '../../constants/taskPool';
import { useSaveFeedback } from '../../contexts/SaveFeedbackContext';
import { DatePickerInput } from '../DatePickerInput';
import { getBranchCodeForBranch } from '../../utils/branchProjectIds';

const optionalText = z.string().optional().default('');
const optionalEmail = z.string().trim().refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid manager email');

const projectSchema = z.object({
  projectType: z.enum(['signage_rollout', 'general_rollout', 'service_delivery']),
  branchId: z.string().trim().min(1, 'Select an existing branch'),
  province: optionalText,
  town: optionalText,
  physicalAddress: z.string().trim().min(8, 'Exact physical address is required for map placement'),
  branch: optionalText,
  manager: optionalText,
  managerEmail: optionalEmail,
  installer: optionalText,
  designer: optionalText,
  currentStage: z.string().min(1, 'Stage is required'),
  status: z.enum(['on_schedule', 'completed', 'delayed']),
  targetDate: optionalText,
  briefRequestedDate: optionalText,
  installationDate: optionalText,
  selectedTaskIds: z.array(z.string()).default([]),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

type ProjectSaveError = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
  status?: unknown;
};

function projectSaveErrorDetails(error: unknown) {
  if (typeof error === 'string') {
    return [{ label: 'Message', value: error }];
  }

  if (!error || typeof error !== 'object') {
    return [{ label: 'Message', value: 'The save request failed without a diagnostic message.' }];
  }

  const candidate = error as ProjectSaveError;
  const details = [
    { label: 'Message', value: candidate.message },
    { label: 'Database code', value: candidate.code },
    { label: 'Database details', value: candidate.details },
    { label: 'Database hint', value: candidate.hint },
    { label: 'HTTP status', value: candidate.status },
  ].filter((item): item is { label: string; value: string | number } => typeof item.value === 'string' || typeof item.value === 'number');

  return details.length > 0
    ? details
    : [{ label: 'Message', value: 'The save request failed without a diagnostic message.' }];
}

function projectSaveNextStep(error: unknown) {
  const candidate = error && typeof error === 'object' ? error as ProjectSaveError : {};
  const text = [candidate.message, candidate.details, candidate.hint, candidate.code]
    .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    .join(' ')
    .toLowerCase();

  if (candidate.code === '42501' || text.includes('row-level security') || text.includes('permission denied')) {
    return 'Your signed-in role is not allowed to insert projects. An administrator must grant this role insert access in Supabase.';
  }

  if (candidate.code === '23505' || text.includes('duplicate key')) {
    return 'The generated project reference is already in use. Refresh the project list and try saving again; the branch itself may not already have a project.';
  }

  if (candidate.code === '23503' || text.includes('foreign key')) {
    return 'The selected branch no longer exists in the live database. Refresh the page, select an existing branch, and try again.';
  }

  if (text.includes('schema cache') || text.includes('could not find the')) {
    return 'The live database schema does not match the deployed app. Refresh the Supabase schema cache or apply the project schema repair.';
  }

  if (text.includes('failed to fetch') || text.includes('network')) {
    return 'The app could not reach Supabase. Check your connection and try again.';
  }

  return 'Use the diagnostic above to identify the database or account configuration that rejected the save.';
}

export function ProjectCreateForm() {
  const queryClient = useQueryClient();
  const { showSuccess } = useSaveFeedback();
  const [searchParams] = useSearchParams();
  const preselectedBranchId = searchParams.get('branchId') ?? '';
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const { data: branches = [], isLoading: isLoadingBranches } = useQuery({
    queryKey: ['branches'],
    queryFn: getAllBranches,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });
  const preselectedBranch = branches.find((branch) => branch.id === preselectedBranchId);
  const existingBranchProject = projects.find((project) => project.branchId === preselectedBranchId && project.status !== 'cancelled');

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      projectType: defaultProjectTemplate.id,
      branchId: '',
      province: '',
      town: '',
      physicalAddress: '',
      branch: '',
      manager: '',
      managerEmail: '',
      installer: '',
      designer: '',
      currentStage: 'New Project',
      status: 'on_schedule',
      targetDate: '',
      briefRequestedDate: '',
      installationDate: '',
      selectedTaskIds: [],
    },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateProjectInput) => createProject(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['portal-summary'] });
      setSuccessMessage('Project was added successfully.');
      showSuccess('Project created.');
      const selected = branches.find((branch) => branch.id === watch('branchId'));

      reset({
        projectType: defaultProjectTemplate.id,
        branchId: selected?.id ?? '',
        province: selected?.province ?? '',
        town: selected?.town ?? '',
        physicalAddress: selected?.physicalAddress ?? '',
        branch: selected?.name ?? '',
        manager: '',
        managerEmail: '',
        installer: '',
        designer: '',
        currentStage: 'New Project',
        status: 'on_schedule',
        targetDate: '',
        briefRequestedDate: '',
        installationDate: '',
        selectedTaskIds: [],
      });
    },
  });

  const selectedBranchId = watch('branchId');

  useEffect(() => {
    if (!preselectedBranchId) {
      return;
    }

    const selectedBranch = branches.find((branch) => branch.id === preselectedBranchId);
    if (!selectedBranch) {
      return;
    }

    setValue('branchId', selectedBranch.id);
  }, [branches, preselectedBranchId, setValue]);

  useEffect(() => {
    if (!selectedBranchId) {
      return;
    }

    const selectedBranch = branches.find((branch) => branch.id === selectedBranchId);
    if (!selectedBranch) {
      return;
    }

    setValue('branch', selectedBranch.name);
    setValue('province', selectedBranch.province);
    setValue('town', selectedBranch.town);
    setValue('physicalAddress', selectedBranch.physicalAddress);
  }, [branches, selectedBranchId, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setSuccessMessage(null);
    setSubmitError(null);

    try {
      const selectedBranch = branches.find((branch) => branch.id === values.branchId);

      if (!selectedBranch) {
        throw new Error('The selected branch is unavailable. Refresh the page, select the branch again, and retry saving.');
      }

      const branchCode = getBranchCodeForBranch(selectedBranch, {});

      await mutation.mutateAsync({
        ...values,
        id: undefined,
        branchCode,
        currentStage: values.currentStage as CreateProjectInput['currentStage'],
        workspaceName: defaultWorkspace.name,
        clientCompany: defaultWorkspace.clientCompany,
        graphicsPartner: defaultGraphicsPartner,
        branch: selectedBranch.name,
        province: selectedBranch.province,
        town: selectedBranch.town,
        physicalAddress: selectedBranch.physicalAddress,
      });
    } catch (error) {
      setSubmitError(error);
    }
  });

  const projectSaveError = submitError ?? mutation.error;
  const projectSaveDetails = projectSaveError ? projectSaveErrorDetails(projectSaveError) : [];

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{preselectedBranch ? `Create ${preselectedBranch.name} rebrand workspace` : 'Create rebrand workspace'}</h3>
          <p className="mt-1 text-sm text-slate-400">A branch has one active rebrand workspace. Start with the branch, then add only the details you have today.</p>
        </div>
        <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{preselectedBranch ? 'Branch selected' : `Workspace: ${defaultWorkspace.name}`}</p>
      </div>

      {existingBranchProject ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          <span>This branch already has an active rebrand workspace.</span>
          <Link to={`/projects/${existingBranchProject.id}`} className="font-semibold text-amber-50 underline underline-offset-2">Open workspace</Link>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-300">
          Branch
          <select {...register('branchId')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" disabled={isLoadingBranches || Boolean(preselectedBranchId)}>
            <option value="">Select branch</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          {errors.branchId ? <span className="text-xs text-red-300">{errors.branchId.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Project type
          <select {...register('projectType')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none">
            {projectTemplateOptions.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
          {errors.projectType ? <span className="text-xs text-red-300">{errors.projectType.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Branch manager or contact <span className="text-xs text-slate-500">Optional</span>
          <input {...register('manager')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Contact email <span className="text-xs text-slate-500">Optional</span>
          <input {...register('managerEmail')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.managerEmail ? <span className="text-xs text-red-300">{errors.managerEmail.message}</span> : null}
        </label>
        <label className="grid gap-2 text-sm text-slate-300">
          Installer <span className="text-xs text-slate-500">Optional</span>
          <input {...register('installer')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
        </label>
        <label className="grid gap-2 text-sm text-slate-300">
          Designer <span className="text-xs text-slate-500">Optional</span>
          <input {...register('designer')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Stage
          <select {...register('currentStage')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none">
            {timelineStages.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Status
          <select {...register('status')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none">
            <option value="on_schedule">On Schedule</option>
            <option value="completed">Completed</option>
            <option value="delayed">Delayed</option>
            <option value="busy">Busy</option>
            <option value="awaiting_approval">Awaiting approval</option>
            <option value="completed">Completed</option>
            <option value="delayed">Delayed</option>
            <option value="on_hold">On hold</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>

        <Controller
          name="targetDate"
          control={control}
          render={({ field }) => (
            <DatePickerInput
              label="Target date"
              value={field.value}
              onChange={field.onChange}
              placeholder="Select target date"
            />
          )}
        />

        <Controller
          name="briefRequestedDate"
          control={control}
          render={({ field }) => (
            <DatePickerInput
              label="Brief requested date"
              value={field.value}
              onChange={field.onChange}
              placeholder="Select brief requested date"
            />
          )}
        />

        <Controller
          name="installationDate"
          control={control}
          render={({ field }) => (
            <DatePickerInput
              label="Installation date"
              value={field.value}
              onChange={field.onChange}
              placeholder="Select installation date"
            />
          )}
        />



        <fieldset className="md:col-span-2">
          <legend className="mb-3 text-sm font-semibold text-slate-300">Initial tasks (optional)</legend>
          <p className="mb-3 text-xs text-slate-400">Select tasks to add to this project, or start with none and add tasks later.</p>
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-900/30 p-4">
            {defaultTaskPool.map((task) => (
              <label key={task.id} className="flex items-center gap-2 text-sm text-slate-300 hover:text-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  value={task.id}
                  {...register('selectedTaskIds')}
                  className="rounded border border-white/10 bg-slate-900/50 text-emerald-500 cursor-pointer"
                />
                <span>{task.text}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {projectSaveError ? (
          <div role="alert" className="md:col-span-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            <p className="font-semibold">Project was not saved.</p>
            <dl className="mt-2 grid gap-1 text-xs text-red-100/90">
              {projectSaveDetails.map((detail) => <div key={detail.label}><dt className="inline font-semibold">{detail.label}: </dt><dd className="inline break-words">{detail.value}</dd></div>)}
            </dl>
            <p className="mt-2 text-xs text-red-100">Next step: {projectSaveNextStep(projectSaveError)}</p>
          </div>
        ) : null}
        {successMessage ? <p className="md:col-span-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{successMessage}</p> : null}

        <div className="md:col-span-2 flex justify-end">
          <button type="submit" disabled={mutation.isPending || Boolean(existingBranchProject)} className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
            {mutation.isPending ? 'Saving workspace...' : 'Create rebrand workspace'}
          </button>
        </div>
      </form>
    </section>
  );
}
