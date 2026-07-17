import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Role, UserRecord } from '../types/domain';
import { loadSessionUser, sessionToUser, signInWithEmailPassword, signOutSession } from '../services/authService';
import { supabase } from '../lib/supabase';
import { roleLabels } from '../constants/portal';

interface AuthContextValue {
  user: UserRecord | null;
  roleLabel: string;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  signInAs: (role: Role) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!supabase) {
      return;
    }

    loadSessionUser().then((sessionUser) => {
      if (isMounted) {
        setUser(sessionUser);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_, session) => {
      if (isMounted) {
        setUser(sessionToUser(session));
      }
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    roleLabel: user ? roleLabels[user.role] : 'Guest',
    signInWithEmailPassword: async (email, password) => {
      const sessionUser = await signInWithEmailPassword(email, password);
      setUser(sessionUser);
    },
    signInAs: (role) => {
      setUser({
        name: roleLabels[role],
        role,
        email: '',
      });
    },
    signOut: async () => {
      await signOutSession();
      setUser(null);
    },
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
