import { useQuery } from '@tanstack/react-query';
import { getUsersResult } from '../services/userService';
import { UserCreateForm } from '../components/users/UserCreateForm';

export function UsersPage() {
  const { data } = useQuery({
    queryKey: ['users'],
    queryFn: getUsersResult,
  });

  const profilesNotConfigured = data?.profilesConfigured === false;
  const users = data?.users ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <h2 className="text-2xl font-semibold text-white">Users</h2>
        <p className="mt-2 text-sm text-slate-400">Manage Colourpix administrators, PSG staff, and sign company access permissions.</p>
      </section>

      {profilesNotConfigured ? (
        <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm text-amber-50 shadow-soft">
          <p className="font-semibold">Profiles table setup required</p>
          <p className="mt-2 leading-6 text-amber-50/90">
            Run <code className="rounded bg-amber-900/50 px-1 py-0.5 text-xs">supabase/create-profiles.sql</code> in the Supabase SQL Editor, then run{' '}
            <code className="rounded bg-amber-900/50 px-1 py-0.5 text-xs">npm run seed:profiles</code> to populate the user profiles.
          </p>
        </div>
      ) : (
        <UserCreateForm />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {profilesNotConfigured ? null : users.length > 0 ? users.map((user) => (
          <div key={user.email} className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-soft">
            <p className="text-lg font-semibold text-white">{user.name}</p>
            <p className="mt-1 text-sm text-slate-400">{user.email}</p>
            <p className="mt-4 text-sm text-slate-300">Role: {user.role}</p>
            <p className="text-sm text-slate-300">Branch: {user.branch ?? 'All branches'}</p>
          </div>
        )) : (
          <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-sm text-slate-400 lg:col-span-2">
            No user profiles in Supabase yet. Use the form above to add the first user profile.
          </div>
        )}
      </div>
    </div>
  );
}
