import { CheckCircle2, Database, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasSupabaseConfig } from '../lib/supabase';

const enablePreviewAuth = import.meta.env.DEV || import.meta.env.VITE_ENABLE_PREVIEW_AUTH === 'true';

export function SettingsPage() {
  const { user, roleLabel } = useAuth();

  const authMode = hasSupabaseConfig ? 'Supabase Auth' : 'Local preview fallback';
  const authStatus = hasSupabaseConfig ? 'Connected' : 'Preview mode';

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <h2 className="text-2xl font-semibold text-white">Settings</h2>
        <p className="mt-2 text-sm text-slate-400">Configure authentication, password reset, audit logging, and Supabase environment settings.</p>
      </section>

      <section className="rounded-[2rem] border border-sky-400/20 bg-sky-500/10 p-6 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-sky-200">Authentication layer</p>
            <h3 className="mt-2 text-xl font-semibold text-white">{authMode}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Sign-in flows through Supabase Auth when environment keys are present, then resolves the user profile and portal role from the profiles table.
              Without Supabase config, the portal keeps the local preview experience available for demos.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-300/25 bg-slate-950/40 px-3 py-1 text-sm font-medium text-sky-100">
            <ShieldCheck width={16} height={16} />
            {authStatus}
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
            <KeyRound className="text-sky-200" width={22} height={22} />
            <p className="mt-3 text-sm font-semibold text-white">Credentials</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">Email and password sign-in uses Supabase sessions and falls back to a local role preview only when enabled.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
            <Database className="text-sky-200" width={22} height={22} />
            <p className="mt-3 text-sm font-semibold text-white">Profiles</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">Portal access is hydrated from name, email, branch, and role values in the Supabase profiles table.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
            <CheckCircle2 className="text-sky-200" width={22} height={22} />
            <p className="mt-3 text-sm font-semibold text-white">Current session</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">{user ? `${user.name} is signed in as ${roleLabel}.` : 'No authenticated user is currently loaded.'}</p>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <dt className="text-slate-400">Supabase config</dt>
            <dd className="mt-1 font-medium text-white">{hasSupabaseConfig ? 'URL and publishable key found' : 'Missing URL or publishable key'}</dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <dt className="text-slate-400">Preview roles</dt>
            <dd className="mt-1 font-medium text-white">{enablePreviewAuth ? 'Enabled for this build' : 'Disabled for this build'}</dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
            <dt className="text-slate-400">Required env</dt>
            <dd className="mt-1 font-medium text-white">VITE_SUPABASE_URL + publishable key</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-soft">
          <h3 className="text-lg font-semibold text-white">Authentication</h3>
          <p className="mt-2 text-sm text-slate-400">Connect this scaffold to Supabase Auth and replace the local preview sign-in flow.</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-soft">
          <h3 className="text-lg font-semibold text-white">Security</h3>
          <p className="mt-2 text-sm text-slate-400">Use row-level security and audit logging for all project changes and file uploads.</p>
        </div>
      </div>
    </div>
  );
}
