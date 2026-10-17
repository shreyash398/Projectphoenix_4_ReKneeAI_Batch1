import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import { Profile, UserRole } from '../types/database';
import { repository } from '../lib/supabase/repository';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole;
  isLoading: boolean;
  signIn: (email: string, password?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  switchDemoRole: (newRole: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => repository.getCurrentProfile());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      // 1. Fetch current active session from Supabase
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          loadProfile(session.user.id);
        } else {
          setIsLoading(false);
        }
      });

      // 2. Listen to ongoing auth changes (login, logout, token refresh)
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          loadProfile(session.user.id);
        } else {
          setProfile(null);
          setIsLoading(false);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      // Offline / Demo fallback: profile initialized from repository
      setProfile(repository.getCurrentProfile());
      setIsLoading(false);
    }
  }, []);

  const loadProfile = async (userId: string) => {
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
        // Fallback to local profile structure if not yet in database
        setProfile(repository.getCurrentProfile());
      }
    } catch (err) {
      console.warn('Error fetching profile from Supabase:', err);
      setProfile(repository.getCurrentProfile());
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password?: string) => {
    if (isSupabaseConfigured && supabase) {
      if (password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email });
        return { error };
      }
    }

    // Demo / Offline sign-in handling
    const role: UserRole = email.includes('clinician') ? 'clinician' : 'patient';
    const updated = repository.switchUserRole(role);
    setProfile(updated);
    return { error: null };
  };

  const signOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const switchDemoRole = (newRole: UserRole) => {
    const updated = repository.switchUserRole(newRole);
    setProfile(updated);
  };

  const role: UserRole = profile?.role ?? 'patient';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isLoading,
        signIn,
        signOut,
        switchDemoRole,
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
