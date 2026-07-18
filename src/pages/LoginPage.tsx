import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { roleLabels } from '../constants/portal';
import type { Role } from '../types/domain';

const roles: Role[] = ['colourpix_admin', 'psg_head_office', 'psg_branch_manager', 'sign_company'];

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { signInAs, signInWithEmailPassword } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [setupBannerDismissed, setSetupBannerDismissed] = useState(false);
  const enablePreviewAuth = import.meta.env.DEV || import.meta.env.VITE_ENABLE_PREVIEW_AUTH === 'true';

  const seededAuthEmails = [
    'beverley@colourpix.co.za',
    'francois@colourpix.co.za',
    'head.office@psg.co.za',
    'john.smith@psg.co.za',
    'ops@abcsignage.co.za',
  ];

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      await signInWithEmailPassword(values.email, values.password);
      navigate('/');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to sign in. Check your credentials and Supabase config.');
    }
  });

  return (
    <div className="grid min-h-[calc(100vh-3rem)] place-items-center px-4 py-8">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/6 p-8 shadow-soft backdrop-blur-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-sky-300">Secure access</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">PSG Signage Rollout Portal</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
          Sign in with Supabase credentials, or use the role buttons below to preview the dashboard without a backend.
        </p>

        <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold">Seeded demo accounts</p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setSetupBannerDismissed(true)}
              className="shrink-0 rounded-lg p-1 opacity-60 transition hover:opacity-100"
            >
              <X width={14} height={14} />
            </button>
          </div>
          {!setupBannerDismissed && (
            <>
              <p className="mt-1 leading-6 text-amber-50/90">
                If this Supabase project is reset, recreate these sign-in accounts with{' '}
                <code className="rounded bg-amber-900/50 px-1 py-0.5 text-xs">npm run seed:auth</code>{' '}
                and reset passwords with <code className="rounded bg-amber-900/50 px-1 py-0.5 text-xs">npm run reset:passwords</code>.
              </p>
              <ul className="mt-3 grid gap-1 text-xs text-amber-50/90 md:grid-cols-2">
                {seededAuthEmails.map((email) => (
                  <li key={email}>{email}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-amber-50/70">
                Default password: <code className="rounded bg-amber-900/50 px-1 py-0.5">Rebrand2026!</code> — change after first login.
              </p>
            </>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-8 rounded-3xl border border-white/10 bg-slate-950/55 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-300">
              Email
              <input
                type="email"
                autoComplete="email"
                {...register('email')}
                className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50"
                placeholder="user@psg.co.za"
              />
              {errors.email ? <span className="text-xs text-red-300">{errors.email.message}</span> : null}
            </label>

            <label className="grid gap-2 text-sm text-slate-300">
              Password
              <input
                type="password"
                autoComplete="current-password"
                {...register('password')}
                className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50"
                placeholder="••••••••"
              />
              {errors.password ? <span className="text-xs text-red-300">{errors.password.message}</span> : null}
            </label>
          </div>

          {formError ? <p className="mt-4 text-sm text-red-300">{formError}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 inline-flex items-center justify-center rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {enablePreviewAuth ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {roles.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  signInAs(role);
                  navigate('/');
                }}
                className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 text-left transition hover:-translate-y-0.5 hover:border-sky-400/40 hover:bg-slate-900/80"
              >
                <p className="text-sm text-slate-400">Role</p>
                <p className="mt-2 text-lg font-semibold text-white">{roleLabels[role]}</p>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
