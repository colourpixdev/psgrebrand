import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Role, UserRecord } from '../types/domain';
import { loadSessionUser, sessionToUser, signInWithEmailPassword, signOutSession } from '../services/authService';
import { updateOwnProfileIdentity } from '../services/userService';
import { supabase } from '../lib/supabase';
import { roleLabels } from '../constants/portal';
import { enrichWorkspaceAccess, platformOwnerEmail } from '../constants/workspaces';
import { saveProfileIdentity, type EditableProfileIdentity } from '../utils/profileIdentity';

interface AuthContextValue {
  user: UserRecord | null;
  isLoading: boolean;
  roleLabel: string;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  signInAs: (role: Role) => void;
  updateProfileIdentity: (identity: EditableProfileIdentity) => Promise<'supabase' | 'local'>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));

  useEffect(() => {
    let isMounted = true;

    if (!supabase) {
      setIsLoading(false);
      return;
    }

    loadSessionUser().then((sessionUser) => {
      if (isMounted) {
        setUser(sessionUser);
        setIsLoading(false);
      }
    }).catch(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_, session) => {
      void sessionToUser(session).then((sessionUser) => {
        if (isMounted) {
          setUser(sessionUser);
        }
      });
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    roleLabel: user ? roleLabels[user.role] : 'Guest',
    signInWithEmailPassword: async (email, password) => {
      const sessionUser = await signInWithEmailPassword(email, password);
      setUser(sessionUser);
    },
    signInAs: (role) => {
      setUser(enrichWorkspaceAccess({
        name: roleLabels[role],
        role,
        email: role === 'colourpix_admin' ? platformOwnerEmail : '',
      }));
    },
    updateProfileIdentity: async (identity) => {
      if (!user) {
        return 'local';
      }

      saveProfileIdentity(user, identity);

      if (!supabase) {
        setUser(enrichWorkspaceAccess({
          ...user,
          name: identity.displayName.trim(),
          company: identity.company.trim() || undefined,
          profileTitle: identity.title.trim() || undefined,
          avatarUrl: identity.avatarUrl.trim() || undefined,
          logoUrl: identity.logoUrl.trim() || undefined,
        }));
        return 'local';
      }

      const updatedUser = await updateOwnProfileIdentity(user.email, identity);
      saveProfileIdentity(updatedUser, identity);
      setUser(updatedUser);
      return 'supabase';
    },
    signOut: async () => {
      await signOutSession();
      setUser(null);
    },
  }), [isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
