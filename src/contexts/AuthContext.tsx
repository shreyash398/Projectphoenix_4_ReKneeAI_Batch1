import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import { Profile, UserRole } from '../types/database';
import { repository } from '../lib/supabase/repository';
import { DEMO_PATIENT_ID, DEMO_CLINICIAN_ID } from '../lib/supabase/mockStore';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  signIn: (email: string, password?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  switchDemoRole: (newRole: UserRole) => void;
  simulateSessionExpired: () => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data as Profile);
      } else {
        setProfile(repository.getCurrentProfile());
      }
    } catch (err) {
      console.warn('Error fetching profile from Supabase:', err);
      setProfile(repository.getCurrentProfile());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      // 1. Fetch current active session from Supabase
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) {
          setAuthError('Session expired or invalid. Please sign in again.');
          setIsLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          loadProfile(session.user.id);
        } else {
          // If no active Supabase Auth user is logged in, check if local/demo session is active
          const current = repository.getCurrentProfile();
          setProfile(current);
          setIsLoading(false);
        }
      });

      // 2. Listen to ongoing auth changes (login, logout, token refresh, token expired)
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && !newSession) {
          // Token refresh failure = expired session
          setSession(null);
          setUser(null);
          setProfile(null);
          setAuthError('Your session has expired. Please sign in again.');
          setIsLoading(false);
        } else if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
          loadProfile(newSession.user.id);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      // Offline / Demo fallback: Check if demo store has an active user session
      const current = repository.getCurrentProfile();
      setProfile(current);
      setIsLoading(false);
    }
  }, [loadProfile]);

  const signIn = async (email: string, password?: string): Promise<{ error: Error | null }> => {
    setIsLoading(true);
    setAuthError(null);

    const trimmedEmail = email.toLowerCase().trim();
    const isDemoEmail =
      trimmedEmail.includes('demo') ||
      trimmedEmail.includes('patient@') ||
      trimmedEmail.includes('clinician@');

    if (isSupabaseConfigured && supabase && password) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data?.user) {
          setSession(data.session);
          setUser(data.user);
          await loadProfile(data.user.id);
          setIsLoading(false);
          return { error: null };
        }
        if (!isDemoEmail && error) {
          setIsLoading(false);
          setAuthError(error.message);
          return { error };
        }
      } catch (err) {
        if (!isDemoEmail) {
          setIsLoading(false);
          const error = err instanceof Error ? err : new Error('Authentication failed');
          setAuthError(error.message);
          return { error };
        }
      }
    }

    // Demo / Offline Mode Sign-In
    if (trimmedEmail.includes('clinician')) {
      const p = repository.setActiveUserId(DEMO_CLINICIAN_ID);
      setProfile(p);
      setIsLoading(false);
      return { error: null };
    } else if (trimmedEmail.includes('patient') || trimmedEmail.length > 0) {
      const p = repository.setActiveUserId(DEMO_PATIENT_ID);
      setProfile(p);
      setIsLoading(false);
      return { error: null };
    }

    setIsLoading(false);
    return { error: new Error('Invalid email or password.') };
  };

  const signOut = async () => {
    setIsLoading(true);
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Error during Supabase signOut:', err);
      }
    }
    repository.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setAuthError(null);
    setIsLoading(false);
  };

  const switchDemoRole = (newRole: UserRole) => {
    const updated = repository.switchUserRole(newRole);
    setProfile(updated);
  };

  const simulateSessionExpired = () => {
    repository.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setAuthError('Your session has expired. Please sign in to continue.');
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const role: UserRole = profile?.role ?? 'patient';
  const isAuthenticated = Boolean(profile || session);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isAuthenticated,
        isLoading,
        authError,
        signIn,
        signOut,
        switchDemoRole,
        simulateSessionExpired,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
