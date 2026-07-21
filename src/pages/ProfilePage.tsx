import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, CheckCircle2, UserCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { defaultWorkspace } from '../constants/workspaces';
import { getInitials, getProfileIdentity } from '../utils/profileIdentity';

const profileSchema = z.object({
  displayName: z.string().trim().min(2, 'Display name is required'),
  title: z.string().trim().optional(),
  company: z.string().trim().optional(),
  avatarUrl: z.string().trim().url('Enter a valid image URL').or(z.literal('')),
  logoUrl: z.string().trim().url('Enter a valid image URL').or(z.literal('')),
});

type ProfileValues = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const { user, roleLabel, updateProfileIdentity } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const identity = getProfileIdentity(user);
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: identity,
  });

  useEffect(() => {
    reset(getProfileIdentity(user));
  }, [reset, user]);

  const preview = watch();
  const initials = getInitials(preview.displayName || user?.name);
  const companyInitials = getInitials(preview.company || user?.company || user?.branch || defaultWorkspace.clientCompany);

  const onSubmit = handleSubmit(async (values) => {
    const saveTarget = await updateProfileIdentity({
      displayName: values.displayName,
      title: values.title ?? '',
      company: values.company ?? '',
      avatarUrl: values.avatarUrl,
      logoUrl: values.logoUrl,
    });

    setNotice(saveTarget === 'supabase' ? 'Profile identity saved to your account.' : 'Profile identity saved on this device.');
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(2,6,23,0.72))] p-6 shadow-soft">
        <p className="text-sm uppercase tracking-[0.32em] text-teal-200/80">Profile</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Control how you appear to other project users.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Add a personal avatar, company name, or organisation mark so Colourpix, PSG Wealth Insure, and delivery partners can recognise who is involved in each project record.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-6 shadow-soft">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Preview</p>
          <div className="mt-5 flex items-start gap-4">
            {preview.avatarUrl ? (
              <img src={preview.avatarUrl} alt="Profile avatar preview" className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/10" />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-lg font-semibold text-teal-100">{initials}</div>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-xl font-semibold text-white">{preview.displayName || user?.name || 'Workspace user'}</h3>
              <p className="mt-1 text-sm text-slate-400">{preview.title || roleLabel}</p>
              <p className="mt-1 text-sm text-slate-500">{preview.company || user?.company || user?.branch || defaultWorkspace.clientCompany}</p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              {preview.logoUrl ? (
                <img src={preview.logoUrl} alt="Organisation logo preview" className="h-12 w-12 rounded-xl object-contain ring-1 ring-white/10" />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-sky-300/20 bg-sky-300/10 text-sm font-semibold text-sky-100">{companyInitials}</div>
              )}
              <div>
                <p className="text-sm font-semibold text-white">{preview.company || 'Organisation identity'}</p>
                <p className="text-xs leading-5 text-slate-500">Shown as participant identity where profile marks are supported.</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-sm text-slate-300">
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <UserCircle className="mt-0.5 h-5 w-5 text-teal-200" />
              <p>Each user should own their avatar and display details.</p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <Building2 className="mt-0.5 h-5 w-5 text-sky-200" />
              <p>Workspace administrators should approve organisation marks that appear in shared project spaces.</p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-200" />
              <p>RolloutHQ owners should retain platform-level control over roles, workspace creation, and global support routing.</p>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-6 shadow-soft">
          <h3 className="text-lg font-semibold text-white">Edit profile identity</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">These fields are saved to your profile and cached on this device for offline preview.</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-300">
              Display name
              <input {...register('displayName')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-teal-300/50" placeholder="Your display name" />
              {errors.displayName ? <span className="text-xs text-red-300">{errors.displayName.message}</span> : null}
            </label>

            <label className="grid gap-2 text-sm text-slate-300">
              Title or responsibility
              <input {...register('title')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-teal-300/50" placeholder="Project manager, site contact, supplier..." />
            </label>

            <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
              Company or organisation
              <input {...register('company')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-teal-300/50" placeholder="PSG Wealth Insure, Colourpix, delivery partner..." />
            </label>

            <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
              Avatar image URL
              <input {...register('avatarUrl')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-teal-300/50" placeholder="https://..." />
              {errors.avatarUrl ? <span className="text-xs text-red-300">{errors.avatarUrl.message}</span> : null}
            </label>

            <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
              Organisation mark URL
              <input {...register('logoUrl')} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-teal-300/50" placeholder="https://..." />
              {errors.logoUrl ? <span className="text-xs text-red-300">{errors.logoUrl.message}</span> : null}
            </label>
          </div>

          {notice ? <p className="mt-4 text-sm text-teal-100">{notice}</p> : null}

          <button type="submit" disabled={isSubmitting} className="mt-5 rounded-2xl bg-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? 'Saving...' : 'Save profile identity'}
          </button>
        </form>
      </section>
    </div>
  );
}
