'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import SplashLoading from '@/components/layout/SplashLoading';

interface AuthCtx {
  user: User | null;
  role: 'admin' | 'viewer' | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, role: null, loading: true, signOut: async () => { } });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const role = (user?.user_metadata?.role as 'admin' | 'viewer') ?? null;

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <Ctx.Provider value={{ user, role, loading, signOut }}>
      {loading ? <SplashLoading /> : children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
