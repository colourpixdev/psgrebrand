import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createProject, type CreateProjectInput } from '../../services/portalService';
import { timelineStages } from '../../constants/portal';

const projectSchema = z.object({
  id: z.string().min(3, 'Project ID is required'),
  province: z.string().min(2, 'Province is required'),
  town: z.string().min(2, 'Town is required'),
  branch: z.string().min(2, 'Branch is required'),
  manager: z.string().min(2, 'Manager is required'),
  managerEmail: z.string().email('Enter a valid manager email'),
  installer: z.string().min(2, 'Installer is required'),
  designer: z.string().min(2, 'Designer is required'),
  currentStage: z.string().min(1, 'Stage is required'),
  status: z.enum(['completed', 'in_progress', 'awaiting_approval', 'delayed', 'on_hold', 'cancelled']),
  targetDate: z.string().min(1, 'Target date is required'),
  installationDate: z.string().min(1, 'Installation date is required'),
  completionDate: z.string().min(1, 'Completion date is required'),
  progress: z.coerce.number().min(0).max(100),
  notes: z.string().min(1, 'Notes are required'),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

function generateProjectId() {
  return `PSG-${Math.floor(Date.now() % 100000).toString().padStart(5, '0')}`;
}

export function ProjectCreateForm() {
  const queryClient = useQueryClient();
  const defaultProjectId = useMemo(() => generateProjectId(), []);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      id: defaultProjectId,
      province: '',
      town: '',
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
        province: '',
        town: '',
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

  const onSubmit = handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
  });

  const mutationError = mutation.error instanceof Error ? mutation.error.message : null;
  const isRlsError = mutationError?.toLowerCase().includes('row-level security');

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Add project</h3>
          <p className="mt-1 text-sm text-slate-400">Create a new rollout directly in Supabase.</p>
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
          Branch
          <input {...register('branch')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.branch ? <span className="text-xs text-red-300">{errors.branch.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Province
          <input {...register('province')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.province ? <span className="text-xs text-red-300">{errors.province.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Town
          <input {...register('town')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.town ? <span className="text-xs text-red-300">{errors.town.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Manager
          <input {...register('manager')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.manager ? <span className="text-xs text-red-300">{errors.manager.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Manager email
          <input type="email" {...register('managerEmail')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.managerEmail ? <span className="text-xs text-red-300">{errors.managerEmail.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Installer
          <input {...register('installer')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.installer ? <span className="text-xs text-red-300">{errors.installer.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Designer
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
          Target date
          <input {...register('targetDate')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" placeholder="15 August" />
          {errors.targetDate ? <span className="text-xs text-red-300">{errors.targetDate.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Installation date
          <input {...register('installationDate')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" placeholder="22 August" />
          {errors.installationDate ? <span className="text-xs text-red-300">{errors.installationDate.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Completion date
          <input {...register('completionDate')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" placeholder="25 August" />
          {errors.completionDate ? <span className="text-xs text-red-300">{errors.completionDate.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Progress
          <input type="number" min="0" max="100" {...register('progress')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.progress ? <span className="text-xs text-red-300">{errors.progress.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
          Notes
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
          {isSubmitting || mutation.isPending ? 'Saving project...' : 'Add project'}
        </button>
      </form>
    </section>
  );
}