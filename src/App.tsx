import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LayoutDashboard, KanbanSquare, FileText, Shield, Search, Users, MapPinned, ShieldCheck, LifeBuoy, UserCircle } from 'lucide-react';
import { AppShell } from './layouts/AppShell';
import { LoginPage } from './pages/LoginPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import { canAccessRoute } from './utils/permissions';
import { productBrand } from './constants/branding';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const MapPage = lazy(() => import('./pages/MapPage').then((module) => ({ default: module.MapPage })));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage').then((module) => ({ default: module.ProjectDetailPage })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then((module) => ({ default: module.ProjectsPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then((module) => ({ default: module.SearchPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const UsersPage = lazy(() => import('./pages/UsersPage').then((module) => ({ default: module.UsersPage })));
const SupportPage = lazy(() => import('./pages/SupportPage').then((module) => ({ default: module.SupportPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((module) => ({ default: module.AboutPage })));
const LegalPage = lazy(() => import('./pages/LegalPage').then((module) => ({ default: module.LegalPage })));
const AccessControlsPage = lazy(() => import('./pages/AccessControlsPage').then((module) => ({ default: module.AccessControlsPage })));
const BranchesPage = lazy(() => import('./pages/BranchesPage').then((module) => ({ default: module.BranchesPage })));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage').then((module) => ({ default: module.AuthCallbackPage })));

const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: KanbanSquare },
  { to: '/branches', label: 'Branches', icon: MapPinned },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/map', label: 'Map', icon: MapPinned },
  { to: '/support', label: 'Support', icon: LifeBuoy },
  { to: '/profile', label: 'Profile', icon: UserCircle },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/access-controls', label: 'Access Controls', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Shield },
  { to: '/about', label: 'About', icon: ShieldCheck },
  { to: '/legal', label: 'Legal', icon: FileText },
];

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/projects': 'Projects',
  '/branches': 'Branches',
  '/reports': 'Reports',
  '/users': 'Users',
  '/access-controls': 'Access Controls',
  '/settings': 'Settings',
  '/search': 'Search',
  '/map': 'Map',
  '/support': 'Support',
  '/profile': 'Profile',
  '/about': 'About',
  '/legal': 'Legal',
  '/login': 'Sign in',
  '/auth/callback': 'Authenticating...',
};

function RouteLoading() {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-soft">
      Loading workspace...
    </div>
  );
}

function AppRoutes() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [supabaseStatus, setSupabaseStatus] = useState<string | null>(null);

  useEffect(() => {
    const matchedRoute = location.pathname.startsWith('/projects/') ? '/projects' : location.pathname;
    const pageTitle = routeTitles[matchedRoute] ?? productBrand.description;
    document.title = `${pageTitle} | ${productBrand.name}`;
  }, [location.pathname]);

  useEffect(() => {
    let isMounted = true;

    if (!supabase) {
      setSupabaseStatus('Supabase is not configured. Add your project URL and publishable key to load live workspace data.');
      return () => {
        isMounted = false;
      };
    }

    if (!user) {
      setSupabaseStatus(null);
      return () => {
        isMounted = false;
      };
    }

    if (user.role !== 'colourpix_admin' && user.role !== 'psg_head_office') {
      setSupabaseStatus('Supabase connected. Role-scoped project access active.');
      return () => {
        isMounted = false;
      };
    }

    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .then(({ count, error }) => {
        if (!isMounted) {
          return;
        }

        if (error) {
          setSupabaseStatus(`Supabase connected, but the projects query failed: ${error.message}`);
          return;
        }

        const projectCount = count ?? 0;
        setSupabaseStatus(`Supabase connected. Live projects available: ${projectCount}.`);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 px-4 text-sm text-slate-300">
        Loading secure session...
      </div>
    );
  }

  if (!user && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  if (location.pathname === '/login') {
    if (user) {
      return <Navigate to="/" replace />;
    }

    return <LoginPage />;
  }

  if (location.pathname === '/auth/callback') {
    return <AuthCallbackPage />;
  }

  if (!canAccessRoute(user, location.pathname)) {
    return <Navigate to="/" replace />;
  }

  const visibleNavigation = navigation.filter((item) => canAccessRoute(user, item.to));

  return (
    <AppShell
      navigation={visibleNavigation}
      statusBanner={
        supabaseStatus ? (
          <div className="mb-6 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100 shadow-soft">
            {supabaseStatus}
          </div>
        ) : null
      }
    >
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/access-controls" element={<AccessControlsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/legal" element={<LegalPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
