import { Component, lazy, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { LayoutDashboard, KanbanSquare, FileText, Shield, Users, MapPinned, Map } from 'lucide-react';
import { AppShell } from './layouts/AppShell';
import { SaveFeedbackProvider } from './contexts/SaveFeedbackContext';
import { LoginPage } from './pages/LoginPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import { checkSupabaseReachability } from './lib/supabaseHealth';
import { canAccessRoute } from './utils/permissions';
import { productBrand } from './constants/branding';
import { lazyWithChunkReload } from './utils/chunkRecovery';

const DashboardPage = lazyWithChunkReload('dashboard', () => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const MapPage = lazyWithChunkReload('map', () => import('./pages/MapPage').then((module) => ({ default: module.MapPage })));
const ProjectDetailPage = lazyWithChunkReload('project-detail', () => import('./pages/ProjectDetailPage').then((module) => ({ default: module.ProjectDetailPage })));
const ProjectsPage = lazyWithChunkReload('projects', () => import('./pages/ProjectsPage').then((module) => ({ default: module.ProjectsPage })));
const BranchesPage = lazyWithChunkReload('branches', () => import('./pages/BranchesPage').then((module) => ({ default: module.BranchesPage })));
const BranchDetailPage = lazyWithChunkReload('branch-detail', () => import('./pages/BranchDetailPage').then((module) => ({ default: module.BranchDetailPage })));
const SearchPage = lazyWithChunkReload('search', () => import('./pages/SearchPage').then((module) => ({ default: module.SearchPage })));
const SettingsPage = lazyWithChunkReload('settings', () => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const UsersPage = lazyWithChunkReload('users', () => import('./pages/UsersPage').then((module) => ({ default: module.UsersPage })));
const SupportPage = lazyWithChunkReload('support', () => import('./pages/SupportPage').then((module) => ({ default: module.SupportPage })));
const ProfilePage = lazyWithChunkReload('profile', () => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const AboutPage = lazyWithChunkReload('about', () => import('./pages/AboutPage').then((module) => ({ default: module.AboutPage })));
const LegalPage = lazyWithChunkReload('legal', () => import('./pages/LegalPage').then((module) => ({ default: module.LegalPage })));
const AccessControlsPage = lazyWithChunkReload('access-controls', () => import('./pages/AccessControlsPage').then((module) => ({ default: module.AccessControlsPage })));
// Branches UI is being consolidated into Projects. Keep the page file for now
// but do not lazy-load it here — we will redirect branch routes to projects.
const AuthCallbackPage = lazyWithChunkReload('auth-callback', () => import('./pages/AuthCallbackPage').then((module) => ({ default: module.AuthCallbackPage })));

const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/branches', label: 'Branches', icon: MapPinned },
  { to: '/map', label: 'Map', icon: Map },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/settings', label: 'Settings', icon: Shield },
];

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/projects': 'Projects',
  '/branches': 'Branches',
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

class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Route render failed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-[2rem] border border-red-400/20 bg-red-500/10 p-6 text-sm text-red-100 shadow-soft">
          <p className="font-semibold">The page hit an unexpected error.</p>
          <p className="mt-2 text-red-200/90">The app has switched to a safe fallback view. Refresh the page to retry.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

// No redirect — branches are now a first-class workspace hub.

function AppRoutes() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [supabaseStatus, setSupabaseStatus] = useState<string | null>(null);

  useEffect(() => {
    const matchedRoute = location.pathname.startsWith('/projects/')
      ? '/projects'
      : location.pathname.startsWith('/branches/')
        ? '/branches'
        : location.pathname;
    const pageTitle = routeTitles[matchedRoute] ?? productBrand.description;
    document.title = `${pageTitle} | ${productBrand.name}`;
  }, [location.pathname]);

  useEffect(() => {
    let isMounted = true;

    async function refreshSupabaseStatus() {
      if (!supabase) {
        if (isMounted) {
          setSupabaseStatus('Supabase is not configured. Add your project URL and publishable key to load live workspace data.');
        }
        return;
      }

      if (!user) {
        if (isMounted) {
          setSupabaseStatus(null);
        }
        return;
      }

      const result = await checkSupabaseReachability();
      if (!isMounted) {
        return;
      }

      if (result.level === 'ok') {
        setSupabaseStatus(result.message);
        return;
      }

      setSupabaseStatus(result.message);
    }

    refreshSupabaseStatus();

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

  // Show login/auth pages without AppShell, regardless of auth state
  if (location.pathname === '/login') {
    if (user) {
      return <Navigate to="/" replace />;
    }
    return <LoginPage />;
  }

  if (location.pathname === '/auth/callback') {
    return <AuthCallbackPage />;
  }

  // Protect all other routes - require authentication
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const visibleNavigation = navigation.filter((item) => canAccessRoute(user, item.to));

  return (
    <AppShell
      navigation={visibleNavigation}
      statusBanner={
        supabaseStatus ? (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm shadow-soft ${
              supabaseStatus.toLowerCase().includes('unreachable') || supabaseStatus.toLowerCase().includes('not configured') || supabaseStatus.toLowerCase().includes('failed')
                ? 'border-red-400/30 bg-red-500/10 text-red-100'
                : 'border-slate-600 bg-slate-200 text-slate-900 font-medium'
            }`}
          >
            {supabaseStatus}
          </div>
        ) : null
      }
    >
      <Suspense fallback={<RouteLoading />}>
        <RouteErrorBoundary>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/branches" element={<BranchesPage />} />
            <Route path="/branches/:branchId" element={<BranchDetailPage />} />
            <Route path="/users" element={canAccessRoute(user, '/users') ? <UsersPage /> : <Navigate to="/" replace />} />
            <Route path="/access-controls" element={canAccessRoute(user, '/access-controls') ? <AccessControlsPage /> : <Navigate to="/" replace />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RouteErrorBoundary>
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SaveFeedbackProvider>
        <AppRoutes />
      </SaveFeedbackProvider>
    </AuthProvider>
  );
}
