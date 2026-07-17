export function SettingsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <h2 className="text-2xl font-semibold text-white">Settings</h2>
        <p className="mt-2 text-sm text-slate-400">Configure authentication, password reset, audit logging, and Supabase environment settings.</p>
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
