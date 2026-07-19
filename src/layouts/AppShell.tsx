import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { LogOut, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { productBrand } from '../constants/branding';
import { RolloutLogo } from '../components/brand/RolloutLogo';
import { AppFooter } from '../components/brand/AppFooter';
import { UserAgreementDialog } from '../components/brand/UserAgreementDialog';

interface NavigationItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export function AppShell({ navigation, children, statusBanner }: { navigation: NavigationItem[]; children: ReactNode; statusBanner?: ReactNode }) {
  const { user, roleLabel, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(2,6,23,0.88),rgba(15,23,42,0.98))] text-slate-100">
      <UserAgreementDialog user={user} />
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <aside className="border-b border-white/10 bg-slate-950/70 p-5 backdrop-blur xl:w-72 lg:border-b-0 lg:border-r">
          <div className="mb-8 flex items-center gap-3">
            <RolloutLogo />
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-teal-200/80">{productBrand.name}</p>
              <h1 className="text-sm font-semibold leading-5 text-white">{productBrand.description}</h1>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-teal-400/15 bg-teal-400/8 p-4 text-xs text-slate-300">
            <p className="font-medium text-white">{productBrand.workspace}</p>
            <p className="mt-1 text-slate-400">Client workspace for {productBrand.customer}</p>
          </div>

          <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start gap-3">
              <Shield className="mt-1 h-5 w-5 text-emerald-300" />
              <div>
                <p className="text-sm font-medium">{user?.name ?? 'Signed out'}</p>
                <p className="text-xs text-slate-400">{roleLabel}</p>
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
                      isActive ? 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/25' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => {
              signOut();
              navigate('/login');
            }}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </aside>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
          {statusBanner}
          {children}
          <AppFooter />
        </main>
      </div>
    </div>
  );
}
