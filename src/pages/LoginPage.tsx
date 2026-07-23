import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { roleLabels } from '../constants/portal';
import type { Role } from '../types/domain';
import { productBrand, psgPrimaryLogoUrl } from '../constants/branding';
import { RolloutLogo } from '../components/brand/RolloutLogo';

const roles: Role[] = ['colourpix_admin', 'psg_head_office', 'psg_branch_manager', 'sign_company'];

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
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
      <div className="grid w-full max-w-6xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/6 p-8 shadow-soft backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <RolloutLogo />
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-teal-300">Secure access</p>
              <h2 className="mt-3 text-4xl font-semibold text-white">{productBrand.name}</h2>
              <p className="mt-2 text-base text-slate-200">Private workspace instance</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">This sign-in page is for invited users working inside an active client workspace.</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-white px-3 py-1.5">
                  <img
                    src={`${import.meta.env.BASE_URL}brand/colourpix-logo.svg`}
                    alt="Colourpix logo"
                    className="h-6 w-auto"
                  />
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100">
                  <img
                    src={psgPrimaryLogoUrl}
                    alt="PSG logo"
                    className="h-5 w-5"
                  />
                  PSG participant
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Current workspace</p>
              <p className="mt-1 font-medium text-white">{productBrand.workspace}</p>
            </div>
            <p className="text-sm leading-6 text-slate-400">Sign in to see the projects, requests, files, questions, and project journal entries that belong to your workspace.</p>
          </div>

          <form onSubmit={onSubmit} className="mt-6 rounded-3xl border border-white/10 bg-slate-950/55 p-5">
            <div>
              <p className="text-sm font-semibold text-white">Sign in to your workspace</p>
              <p className="mt-1 text-sm text-slate-400">Use your work email and password to continue.</p>
            </div>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-2 text-sm text-slate-300">
                Email
                <input
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50"
                  placeholder="name@company.co.za"
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
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {enablePreviewAuth ? (
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">Local demo accounts</p>
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
                  <ul className="mt-3 grid gap-1 text-xs text-amber-50/90">
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
          ) : null}

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

          <footer className="mt-8 border-t border-white/10 pt-5 text-xs text-slate-500">
            <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
              <span>{productBrand.poweredBy}</span>
              <span>Copyright {productBrand.copyright}</span>
            </div>
          </footer>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-6 shadow-soft backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-teal-200/80">Workspace access</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">This is a private client workspace instance.</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Sign in with the account assigned to your active workspace. Public enquiries and commercial onboarding are handled outside this operational environment before users are invited here.
          </p>
          <div className="mt-5 grid gap-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-semibold text-white">Invited users only</p>
              <p className="mt-1 text-slate-400">Access is managed by the workspace administrator for the client programme.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-semibold text-white">Operational records stay here</p>
              <p className="mt-1 text-slate-400">Projects, files, questions, approvals, updates, and reports remain tied to this workspace instance.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
