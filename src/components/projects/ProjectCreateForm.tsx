import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { createProject, type CreateProjectInput } from '../../services/portalService';
import { getAllBranches } from '../../services/branchService';
import { timelineStages } from '../../constants/portal';
import { defaultGraphicsPartner, defaultWorkspace } from '../../constants/workspaces';
import { defaultProjectTemplate, projectTemplateOptions } from '../../constants/projectTemplates';

const optionalText = z.string().optional().default('');
const optionalEmail = z.string().trim().refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid manager email');

const projectSchema = z.object({
  id: z.string().trim().min(3, 'Project ID is required'),
  projectType: z.enum(['signage_rollout', 'general_rollout', 'service_delivery']),
  workspaceName: optionalText,
  clientCompany: optionalText,
  graphicsPartner: optionalText,
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
  status: z.enum(['completed', 'busy', 'in_progress', 'awaiting_approval', 'delayed', 'on_hold', 'cancelled']),
  targetDate: optionalText,
  installationDate: optionalText,
  completionDate: optionalText,
  progress: z.coerce.number().min(0).max(100),
  notes: optionalText,
});

type ProjectFormValues = z.infer<typeof projectSchema>;

function generateProjectId() {
  return `RHQ-${Math.floor(Date.now() % 100000).toString().padStart(5, '0')}`;
}

export function ProjectCreateForm() {
  const queryClient = useQueryClient();
  const defaultProjectId = useMemo(() => generateProjectId(), []);
  const [searchParams] = useSearchParams();
  const preselectedBranchId = searchParams.get('branchId') ?? '';

  const { data: branches = [], isLoading: isLoadingBranches } = useQuery({
    queryKey: ['branches'],
    queryFn: getAllBranches,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      id: defaultProjectId,
      projectType: defaultProjectTemplate.id,
      workspaceName: defaultWorkspace.name,
      clientCompany: defaultWorkspace.clientCompany,
      graphicsPartner: defaultGraphicsPartner,
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
      status: 'in_progress',
      targetDate: '',
      installationDate: '',
      completionDate: '',
      progress: 0,
      notes: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ProjectFormValues) => createProject(values as CreateProjectInput),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['portal-summary'] });
      reset({
        id: generateProjectId(),
        projectType: defaultProjectTemplate.id,
        workspaceName: defaultWorkspace.name,
        clientCompany: defaultWorkspace.clientCompany,
        graphicsPartner: defaultGraphicsPartner,
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

  useEffect(() => {
    if (!preselectedBranchId) {
      return;
    }

    const selectedBranch = branches.find((branch) => branch.id === preselectedBranchId);

    if (!selectedBranch) {
      return;
    }

    setValue('branchId', selectedBranch.id);
    setValue('branch', selectedBranch.name);
    setValue('province', selectedBranch.province);
    setValue('town', selectedBranch.town);
    setValue('physicalAddress', selectedBranch.physicalAddress);
  }, [branches, preselectedBranchId, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    const selectedBranch = branches.find((branch) => branch.id === values.branchId);

    if (!selectedBranch) {
      throw new Error('Select a valid existing branch before saving the project.');
    }

    await mutation.mutateAsync({
      ...values,
      branch: selectedBranch.name,
      province: selectedBranch.province,
      town: selectedBranch.town,
      physicalAddress: selectedBranch.physicalAddress,
    });
  });

  const mutationError = mutation.error instanceof Error ? mutation.error.message : null;
  const isRlsError = mutationError?.toLowerCase().includes('row-level security');

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Add project</h3>
          <p className="mt-1 text-sm text-slate-400">Add a project with only the details you have now. Dates and operational contacts can be filled in later.</p>
        </div>
        <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">Database write path</p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-300">
          Project ID
          <input {...register('id')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.id ? <span className="text-xs text-red-300">{errors.id.message}</span> : null}
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
          Workspace <span className="text-xs text-slate-500">Optional</span>
          <input {...register('workspaceName')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.workspaceName ? <span className="text-xs text-red-300">{errors.workspaceName.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Client company <span className="text-xs text-slate-500">Optional</span>
          <input {...register('clientCompany')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.clientCompany ? <span className="text-xs text-red-300">{errors.clientCompany.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Service partner <span className="text-xs text-slate-500">Optional</span>
          <input {...register('graphicsPartner')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.graphicsPartner ? <span className="text-xs text-red-300">{errors.graphicsPartner.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Branch
          <select {...register('branchId')} disabled={isLoadingBranches} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none disabled:opacity-60">
            <option value="">{isLoadingBranches ? 'Loading branches...' : 'Select a branch'}</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
          {errors.branchId ? <span className="text-xs text-red-300">{errors.branchId.message}</span> : null}
        </label>

        <input type="hidden" {...register('branch')} />

        <label className="grid gap-2 text-sm text-slate-300">
          Province <span className="text-xs text-slate-500">Optional</span>
          <input {...register('province')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.province ? <span className="text-xs text-red-300">{errors.province.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Town <span className="text-xs text-slate-500">Optional</span>
          <input {...register('town')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.town ? <span className="text-xs text-red-300">{errors.town.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
          Exact physical address
          <input {...register('physicalAddress')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" placeholder="Street number, street name, suburb, town, province, country" />
          <span className="text-xs leading-5 text-slate-500">This address is geocoded before saving so the project pin appears at the correct map location.</span>
          {errors.physicalAddress ? <span className="text-xs text-red-300">{errors.physicalAddress.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Manager <span className="text-xs text-slate-500">Optional</span>
          <input {...register('manager')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.manager ? <span className="text-xs text-red-300">{errors.manager.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Manager email <span className="text-xs text-slate-500">Optional</span>
          <input type="email" {...register('managerEmail')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.managerEmail ? <span className="text-xs text-red-300">{errors.managerEmail.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Delivery partner <span className="text-xs text-slate-500">Optional</span>
          <input {...register('installer')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.installer ? <span className="text-xs text-red-300">{errors.installer.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Designer <span className="text-xs text-slate-500">Optional</span>
          <input {...register('designer')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.designer ? <span className="text-xs text-red-300">{errors.designer.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Current stage
          <select {...register('currentStage')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none">
            {timelineStages.map((stage) => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
          {errors.currentStage ? <span className="text-xs text-red-300">{errors.currentStage.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Status
          <select {...register('status')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none">
            <option value="busy">Busy</option>
            <option value="in_progress">In progress</option>
            <option value="awaiting_approval">Awaiting approval</option>
            <option value="completed">Completed</option>
            <option value="delayed">Delayed</option>
            <option value="on_hold">On hold</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {errors.status ? <span className="text-xs text-red-300">{errors.status.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Target date <span className="text-xs text-slate-500">Optional</span>
          <input {...register('targetDate')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" placeholder="15 August" />
          {errors.targetDate ? <span className="text-xs text-red-300">{errors.targetDate.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Installation date <span className="text-xs text-slate-500">Optional</span>
          <input {...register('installationDate')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" placeholder="22 August" />
          {errors.installationDate ? <span className="text-xs text-red-300">{errors.installationDate.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Completion date <span className="text-xs text-slate-500">Optional</span>
          <input {...register('completionDate')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" placeholder="25 August" />
          {errors.completionDate ? <span className="text-xs text-red-300">{errors.completionDate.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Progress
          <input type="number" min="0" max="100" {...register('progress')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.progress ? <span className="text-xs text-red-300">{errors.progress.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
          Notes <span className="text-xs text-slate-500">Optional</span>
          <textarea {...register('notes')} rows={4} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.notes ? <span className="text-xs text-red-300">{errors.notes.message}</span> : null}
        </label>

        {mutationError ? (
          <p className="text-sm text-red-300 md:col-span-2">
            {mutationError}
            {isRlsError ? ' Run supabase/repair-live-database.sql in the Supabase SQL Editor to enable authenticated project writes.' : null}
          </p>
        ) : null}

        <button type="submit" disabled={isSubmitting || mutation.isPending} className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2">
          {isSubmitting || mutation.isPending ? 'Checking address and saving...' : 'Add project'}
        </button>
      </form>
    </section>
  );
}