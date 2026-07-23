import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ShieldCheck, Users } from 'lucide-react';
import { roleLabels } from '../constants/portal';
import { getUsersResult, updateUserAccessControls } from '../services/userService';
import type { Role, UserRecord } from '../types/domain';
import { accessControlGroups, applyPolicyOverrides, getBaseRolePolicy, getPolicyValue } from '../utils/permissions';

type AccessDraft = {
  role: Role;
  permissionOverrides: Record<string, boolean>;
};

const roleOptions = Object.keys(roleLabels) as Role[];

function countEnabledCapabilities(role: Role) {
  const policy = getBaseRolePolicy(role);
  return accessControlGroups.reduce((count, group) => {
    return count + group.items.filter((item) => getPolicyValue(policy, item.key)).length;
  }, 0);
}

const roleDescriptions: Record<Role, string> = {
  colourpix_admin: 'Platform owner with full operational control across projects, workflow, files, reports, and user management.',
  psg_head_office: 'Broad PSG oversight with visibility and progress controls, but limited administrative actions.',
  psg_branch_manager: 'Branch-scoped operational visibility focused on assigned projects and local coordination.',
  sign_company: 'Delivery partner role focused on execution updates, files, and task progress.',
};

function getDraft(user: UserRecord): AccessDraft {
  return {
    role: user.role,
    permissionOverrides: user.permissionOverrides ?? {},
  };
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'border-emerald-300/40 bg-emerald-400/70' : 'border-white/15 bg-slate-800'}`}
      aria-pressed={checked}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

export function AccessControlsPage() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, AccessDraft>>({});
  const [savedEmail, setSavedEmail] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsersResult,
  });

  const users = data?.users ?? [];
  const profilesNotConfigured = data?.profilesConfigured === false;

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      users.forEach((user) => {
        if (!next[user.email]) {
          next[user.email] = getDraft(user);
        }
      });
      return next;
    });
  }, [users]);

  const saveMutation = useMutation({
    mutationFn: ({ email, draft }: { email: string; draft: AccessDraft }) => updateUserAccessControls({
      email,
      role: draft.role,
      permissionOverrides: draft.permissionOverrides,
    }),
    onSuccess: async (updatedUser) => {
      setSavedEmail(updatedUser.email);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const userCount = users.length;
  const capabilityCount = useMemo(() => accessControlGroups.reduce((count, group) => count + group.items.length, 0), []);
  const usersByRole = useMemo(() => {
    return users.reduce<Record<Role, number>>((countByRole, user) => {
      countByRole[user.role] = (countByRole[user.role] ?? 0) + 1;
      return countByRole;
    }, {
      colourpix_admin: 0,
      psg_head_office: 0,
      psg_branch_manager: 0,
      sign_company: 0,
    });
  }, [users]);

  function updateDraft(email: string, updater: (draft: AccessDraft) => AccessDraft) {
    setSavedEmail(null);
    setDrafts((current) => ({
      ...current,
      [email]: updater(current[email] ?? getDraft(users.find((user) => user.email === email) ?? users[0])),
    }));
  }

  function setRole(user: UserRecord, role: Role) {
    updateDraft(user.email, (draft) => ({ ...draft, role, permissionOverrides: {} }));
  }

  function setCapability(user: UserRecord, key: string, enabled: boolean) {
    updateDraft(user.email, (draft) => {
      const basePolicy = getBaseRolePolicy(draft.role);
      const baseValue = getPolicyValue(basePolicy, key);
      const permissionOverrides = { ...draft.permissionOverrides };

      if (enabled === baseValue) {
        delete permissionOverrides[key];
      } else {
        permissionOverrides[key] = enabled;
      }

      return { ...draft, permissionOverrides };
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <p className="text-sm uppercase tracking-[0.32em] text-teal-200/80">Restricted administration</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Access Controls</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Follow the same decision structure as the governance document: review current roles, edit user role assignments, then use per-user capability overrides only for exceptions.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-sky-300/20 bg-sky-500/10 p-5 shadow-soft">
          <Users className="text-sky-100" width={22} height={22} />
          <p className="mt-3 text-sm font-semibold text-white">Users</p>
          <p className="mt-1 text-3xl font-semibold text-sky-100">{userCount}</p>
        </div>
        <div className="rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5 shadow-soft">
          <ShieldCheck className="text-emerald-100" width={22} height={22} />
          <p className="mt-3 text-sm font-semibold text-white">Roles</p>
          <p className="mt-1 text-3xl font-semibold text-emerald-100">{roleOptions.length}</p>
        </div>
        <div className="rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5 shadow-soft">
          <CheckCircle2 className="text-amber-100" width={22} height={22} />
          <p className="mt-3 text-sm font-semibold text-white">Capabilities</p>
          <p className="mt-1 text-3xl font-semibold text-amber-100">{capabilityCount}</p>
        </div>
      </section>

      {profilesNotConfigured ? (
        <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm text-amber-50 shadow-soft">
          Profiles are not configured yet. Apply the Supabase profiles schema before managing access controls.
        </div>
      ) : isLoading ? (
        <div className="rounded-3xl border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-soft">Loading users...</div>
      ) : (
        <div className="space-y-5">
          <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-soft">
            <h3 className="text-lg font-semibold text-white">1. Current Roles</h3>
            <p className="mt-1 text-sm text-slate-400">Use this section as a baseline before changing user assignments.</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {roleOptions.map((role) => {
                const enabledCount = countEnabledCapabilities(role);
                const memberCount = usersByRole[role] ?? 0;

                return (
                  <article key={role} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">{roleLabels[role]}</h4>
                      <span className="rounded-full border border-white/10 bg-slate-950/60 px-2 py-0.5 text-[0.68rem] text-slate-300">{memberCount} user{memberCount === 1 ? '' : 's'}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{roleDescriptions[role]}</p>
                    <p className="mt-3 text-xs text-slate-500">{enabledCount} of {capabilityCount} default capabilities enabled</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-soft">
            <h3 className="text-lg font-semibold text-white">2. Users + Assigned Roles</h3>
            <p className="mt-1 text-sm text-slate-400">Primary control surface. Assign each user to the closest default role first.</p>
            <div className="mt-4 space-y-3">
              {users.map((user) => {
                const draft = drafts[user.email] ?? getDraft(user);
                const isSaving = saveMutation.isPending && saveMutation.variables?.email === user.email;
                const overrideCount = Object.keys(draft.permissionOverrides).length;

                return (
                  <article key={user.email} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem_auto] lg:items-end">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{user.name}</h4>
                        <p className="mt-1 text-sm text-slate-400">{user.email}</p>
                        <p className="mt-2 text-xs text-slate-500">{overrideCount} custom override{overrideCount === 1 ? '' : 's'}</p>
                      </div>
                      <label className="grid gap-2 text-sm text-slate-300">
                        Assigned role
                        <select value={draft.role} onChange={(event) => setRole(user, event.target.value as Role)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
                          {roleOptions.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                        </select>
                      </label>
                      <button type="button" disabled={isSaving} onClick={() => saveMutation.mutate({ email: user.email, draft })} className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
                        {isSaving ? 'Saving...' : savedEmail === user.email ? 'Saved' : 'Save role'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-soft">
            <h3 className="text-lg font-semibold text-white">3. Capability Overrides (Advanced)</h3>
            <p className="mt-1 text-sm text-slate-400">Use overrides only when a user needs an exception beyond their assigned role.</p>
            <div className="mt-4 space-y-4">
              {users.map((user) => {
                const draft = drafts[user.email] ?? getDraft(user);
                const basePolicy = getBaseRolePolicy(draft.role);
                const effectivePolicy = applyPolicyOverrides(basePolicy, draft.permissionOverrides);
                const overrideCount = Object.keys(draft.permissionOverrides).length;
                const isSaving = saveMutation.isPending && saveMutation.variables?.email === user.email;

                return (
                  <article key={`${user.email}-overrides`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{user.name}</h4>
                        <p className="text-xs text-slate-500">Role: {roleLabels[draft.role]}</p>
                      </div>
                      <button type="button" disabled={isSaving} onClick={() => saveMutation.mutate({ email: user.email, draft })} className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
                        {isSaving ? 'Saving...' : savedEmail === user.email ? 'Saved' : `Save overrides (${overrideCount})`}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      {accessControlGroups.map((group) => (
                        <section key={`${user.email}-${group.id}`} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                          <h5 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">{group.label}</h5>
                          <div className="mt-4 divide-y divide-white/10">
                            {group.items.map((item) => {
                              const checked = getPolicyValue(effectivePolicy, item.key);
                              const baseChecked = getPolicyValue(basePolicy, item.key);
                              const customized = draft.permissionOverrides[item.key] !== undefined;

                              return (
                                <div key={item.key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-medium text-white">{item.label}</p>
                                      {customized ? <span className="rounded-full border border-sky-300/25 bg-sky-500/15 px-2 py-0.5 text-[0.68rem] font-semibold text-sky-100">Override</span> : null}
                                      <span className="rounded-full border border-white/10 bg-slate-950/50 px-2 py-0.5 text-[0.68rem] text-slate-400">Default {baseChecked ? 'on' : 'off'}</span>
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                                  </div>
                                  <Toggle checked={checked} disabled={isSaving} onChange={(enabled) => setCapability(user, item.key, enabled)} />
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {saveMutation.error instanceof Error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{saveMutation.error.message}</p> : null}
    </div>
  );
}