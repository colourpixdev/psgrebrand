import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { createProject, getProjects, type CreateProjectInput } from '../../services/portalService';
import { getAllBranches } from '../../services/branchService';
import { timelineStages } from '../../constants/portal';
import { defaultGraphicsPartner, defaultWorkspace } from '../../constants/workspaces';
import { defaultProjectTemplate, projectTemplateOptions } from '../../constants/projectTemplates';
import { buildBranchCodeMap, createNextProjectId, getBranchCodeForBranch } from '../../utils/branchProjectIds';

const optionalText = z.string().optional().default('');
const optionalEmail = z.string().trim().refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid manager email');

const projectSchema = z.object({
  id: z.string().trim().min(3, 'Project ID is required'),
  projectType: z.enum(['signage_rollout', 'general_rollout', 'service_delivery']),
  branchId: z.string().trim().min(1, 'Select an existing branch'),
  branchCode: z.string().trim().min(3, 'Branch code is required'),
  province: optionalText,
  town: optionalText,
  physicalAddress: z.string().trim().min(8, 'Exact physical address is required for map placement'),
  branch: optionalText,
  manager: optionalText,
  managerEmail: optionalEmail,
  installer: optionalText,
  designer: optionalText,
  currentStage: z.string().min(1, 'Stage is required'),
  status: z.enum(['completed', 'busy', 'in_progress', 'awaiting_approval', 'delayed', 'on_hold', 'cancelled']),
  targetDate: optionalText,
  installationDate: optionalText,
  completionDate: optionalText,
  progress: z.coerce.number().min(0).max(100),
  notes: optionalText,
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export function ProjectCreateForm() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preselectedBranchId = searchParams.get('branchId') ?? '';
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: branches = [], isLoading: isLoadingBranches } = useQuery({
    queryKey: ['branches'],
    queryFn: getAllBranches,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  const codeByBranchId = useMemo(() => buildBranchCodeMap(branches), [branches]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      id: '',
      projectType: defaultProjectTemplate.id,
      branchId: '',
      branchCode: '',
      province: '',
      town: '',
      physicalAddress: '',
      branch: '',
      manager: '',
      managerEmail: '',
      installer: '',
      designer: '',
      currentStage: 'New Project',
      status: 'in_progress',
      targetDate: '',
      installationDate: '',
      completionDate: '',
      progress: 0,
      notes: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateProjectInput) => createProject(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['portal-summary'] });
      setSuccessMessage('Project was added successfully.');
      const selected = branches.find((branch) => branch.id === watch('branchId'));
      const nextCode = selected ? getBranchCodeForBranch(selected, codeByBranchId) : '';
      const nextProjectId = nextCode ? createNextProjectId(nextCode, projects) : '';

      reset({
        id: nextProjectId,
        projectType: defaultProjectTemplate.id,
        branchId: selected?.id ?? '',
        branchCode: nextCode,
        province: selected?.province ?? '',
        town: selected?.town ?? '',
        physicalAddress: selected?.physicalAddress ?? '',
        branch: selected?.name ?? '',
        manager: '',
        managerEmail: '',
        installer: '',
        designer: '',
        currentStage: 'New Project',
        status: 'in_progress',
        targetDate: '',
        installationDate: '',
        completionDate: '',
        progress: 0,
        notes: '',
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

    const branchCode = getBranchCodeForBranch(selectedBranch, codeByBranchId);
    const branchProjects = projects.filter((project) => project.branchId === selectedBranch.id || project.branchCode === branchCode || project.branch.toLowerCase() === selectedBranch.name.toLowerCase());
    const projectId = createNextProjectId(branchCode, branchProjects);

    setValue('id', projectId);
    setValue('branchCode', branchCode);
    setValue('branch', selectedBranch.name);
    setValue('province', selectedBranch.province);
    setValue('town', selectedBranch.town);
    setValue('physicalAddress', selectedBranch.physicalAddress);
  }, [branches, codeByBranchId, projects, selectedBranchId, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setSuccessMessage(null);
    const selectedBranch = branches.find((branch) => branch.id === values.branchId);

    if (!selectedBranch) {
      throw new Error('Select a valid existing branch before saving the project.');
    }

    await mutation.mutateAsync({
      ...values,
      currentStage: values.currentStage as CreateProjectInput['currentStage'],
      workspaceName: defaultWorkspace.name,
      clientCompany: defaultWorkspace.clientCompany,
      graphicsPartner: defaultGraphicsPartner,
      branch: selectedBranch.name,
      province: selectedBranch.province,
      town: selectedBranch.town,
      physicalAddress: selectedBranch.physicalAddress,
    });
  });

  const mutationError = mutation.error instanceof Error ? mutation.error.message : null;

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Add project</h3>
          <p className="mt-1 text-sm text-slate-400">Projects are now generated from branch codes. Start with the branch, then add only the details you have today.</p>
        </div>
        <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">Single workspace: {defaultWorkspace.name}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-300">
          Branch
          <select {...register('branchId')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" disabled={isLoadingBranches}>
            <option value="">Select branch</option>
            {branches.map((branch) => {
              const branchCode = getBranchCodeForBranch(branch, codeByBranchId);
              return <option key={branch.id} value={branch.id}>{branchCode} - {branch.name}</option>;
            })}
          </select>
          {errors.branchId ? <span className="text-xs text-red-300">{errors.branchId.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Project ID
          <input {...register('id')} readOnly className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white outline-none" />
          {errors.id ? <span className="text-xs text-red-300">{errors.id.message}</span> : <span className="text-xs text-slate-500">Auto-generated from branch code.</span>}
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
          Branch code
          <input {...register('branchCode')} readOnly className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white outline-none" />
          {errors.branchCode ? <span className="text-xs text-red-300">{errors.branchCode.message}</span> : null}
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
          Delivery partner <span className="text-xs text-slate-500">Optional</span>
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
            <option value="in_progress">In progress</option>
            <option value="busy">Busy</option>
            <option value="awaiting_approval">Awaiting approval</option>
            <option value="completed">Completed</option>
            <option value="delayed">Delayed</option>
            <option value="on_hold">On hold</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Target date
          <input {...register('targetDate')} type="date" className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Installation date
          <input {...register('installationDate')} type="date" className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Completion date
          <input {...register('completionDate')} type="date" className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Progress
          <input {...register('progress')} type="number" min={0} max={100} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
        </label>

        <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
          Notes
          <textarea {...register('notes')} rows={4} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none" />
        </label>

        {mutationError ? <p className="md:col-span-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{mutationError}</p> : null}
        {successMessage ? <p className="md:col-span-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{successMessage}</p> : null}

        <div className="md:col-span-2 flex justify-end">
          <button type="submit" disabled={mutation.isPending} className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50">
            {mutation.isPending ? 'Saving project...' : 'Create project'}
          </button>
        </div>
      </form>
    </section>
  );
}
