import { useQuery } from '@tanstack/react-query';
import { getUsers } from '../services/userService';
import { UserCreateForm } from '../components/users/UserCreateForm';

export function UsersPage() {
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <h2 className="text-2xl font-semibold text-white">Users</h2>
        <p className="mt-2 text-sm text-slate-400">Manage Colourpix administrators, PSG staff, and sign company access permissions.</p>
      </section>

      <UserCreateForm />

      <div className="grid gap-4 lg:grid-cols-2">
        {users.length > 0 ? users.map((user) => (
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
