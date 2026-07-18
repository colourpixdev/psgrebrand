import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inviteUser } from '../../services/userService';
import { roleLabels } from '../../constants/portal';

const userSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  role: z.enum(['colourpix_admin', 'psg_head_office', 'psg_branch_manager', 'sign_company']),
  branch: z.string().trim().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

export function UserCreateForm() {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'psg_head_office',
      branch: '',
    },
  });

  const mutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      reset({ name: '', email: '', role: 'psg_head_office', branch: '' });
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
  });

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Invite user</h3>
          <p className="mt-1 text-sm text-slate-400">Send a Supabase Auth invite and create the matching access profile in one controlled step.</p>
        </div>
        <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">Admin invite flow</p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-300">
          Name
          <input {...register('name')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.name ? <span className="text-xs text-red-300">{errors.name.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Email
          <input type="email" {...register('email')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" />
          {errors.email ? <span className="text-xs text-red-300">{errors.email.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Role
          <select {...register('role')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none">
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {errors.role ? <span className="text-xs text-red-300">{errors.role.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Branch
          <input {...register('branch')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none" placeholder="Optional" />
          {errors.branch ? <span className="text-xs text-red-300">{errors.branch.message}</span> : null}
        </label>

        {mutation.error ? <p className="text-sm text-red-300 md:col-span-2">{mutation.error.message}</p> : null}

        <button type="submit" disabled={isSubmitting || mutation.isPending} className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2">
          {isSubmitting || mutation.isPending ? 'Sending invite...' : 'Send invite'}
        </button>
      </form>
    </section>
  );
}